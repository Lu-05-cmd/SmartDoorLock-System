#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include "stm32f103xb.h"
#include "../include/header/keypad.h"
#include "../include/header/delay.h"
#include "../include/header/ReedSwtich.h"
#include "../include/header/RC522.h"
#include "../include/header/OLED.h"

#define CONFIG_FLASH_ADDRESS 0x0800FC00UL
#define CONFIG_MAGIC 0x53444C31UL
#define MAX_CARDS 10U
#define PIN_LENGTH 6U
#define UI_SLEEP_TICKS 3000U
#define RFID_POLL_TICKS 5U
#define CARD_RELEASE_POLLS 20U
#define DOOR_OPEN_TICKS 500U
#define KEY_DEBOUNCE_TICKS 2U
#define SERVO_FRAME_US 20000U
#define SERVO_MIN_PULSE_US 500U
#define SERVO_MAX_PULSE_US 2500U

typedef struct
{
    uint8_t length;
    uint8_t uid[10];
} CardRecord_t;

typedef struct
{
    uint32_t magic;
    uint8_t card_count;
    uint8_t reserved[3];
    uint32_t pin_hash;
    CardRecord_t cards[MAX_CARDS];
    uint32_t checksum;
} AccessConfig_t;

typedef enum
{
    UI_HOME,
    UI_PIN,
    UI_SETUP_PIN,
    UI_CONFIRM_PIN,
    UI_MENU,
    UI_ADD_CARD,
    UI_CARD_LIST
} UI_Screen_t;

typedef enum
{
    KEYPAD_IDLE,
    KEYPAD_DEBOUNCE_PRESS,
    KEYPAD_WAIT_RELEASE,
    KEYPAD_DEBOUNCE_RELEASE
} KeypadState_t;

static volatile uint32_t system_ticks;
static AccessConfig_t access_config;
static UI_Screen_t current_screen = UI_HOME;
static uint8_t oled_ready;
static uint8_t rfid_ready;
static uint8_t display_awake = 1U;
static uint8_t menu_selection;
static uint8_t pin_digits;
static uint8_t pin_input[PIN_LENGTH];
static uint8_t pending_pin[PIN_LENGTH];
static uint8_t pending_admin_uid[10];
static uint8_t pending_admin_uid_length;
static uint8_t initial_setup;
static uint8_t card_list_selection;
static uint8_t card_latched;
static uint8_t card_miss_count;
static KeypadState_t keypad_state;
static uint8_t last_uid[10];
static uint8_t last_uid_length;
static uint8_t last_uid_valid;
static uint8_t servo_is_open;
static uint8_t servo_ready;
static uint32_t last_activity_tick;
static uint32_t last_rfid_poll_tick;
static uint32_t door_open_tick;
static uint32_t keypad_state_tick;

void Config_RCC(void);
void Config_GPIO(void);
void Config_EXTI(void);

void SysTick_Handler(void)
{
    system_ticks++;
}

static uint8_t TickElapsed(uint32_t now, uint32_t start, uint32_t duration)
{
    return (int32_t)(now - start) >= (int32_t)duration;
}

static uint8_t ValidUidLength(uint8_t length)
{
    return length == 4U || length == 7U || length == 10U;
}

static uint32_t HashPin(const uint8_t pin[PIN_LENGTH])
{
    uint32_t hash = 2166136261UL;
    for(uint8_t i = 0U; i < PIN_LENGTH; i++)
    {
        hash = (hash ^ pin[i]) * 16777619UL;
    }
    return hash;
}

static uint32_t ConfigChecksum(const AccessConfig_t *config)
{
    const uint8_t *bytes = (const uint8_t *)config;
    uint32_t checksum = 2166136261UL;
    for(size_t i = 0U; i < offsetof(AccessConfig_t, checksum); i++)
    {
        checksum = (checksum ^ bytes[i]) * 16777619UL;
    }
    return checksum;
}

static uint8_t ConfigIsValid(const AccessConfig_t *config)
{
    if(config->magic != CONFIG_MAGIC ||
       config->card_count == 0U ||
       config->card_count > MAX_CARDS ||
       config->checksum != ConfigChecksum(config))
    {
        return 0U;
    }

    for(uint8_t i = 0U; i < config->card_count; i++)
    {
        if(!ValidUidLength(config->cards[i].length))
        {
            return 0U;
        }
    }
    return 1U;
}

static uint8_t FlashWaitReady(void)
{
    uint32_t timeout = 1000000U;
    while((FLASH->SR & FLASH_SR_BSY) != 0U && timeout > 0U)
    {
        timeout--;
    }
    return timeout != 0U;
}

static uint8_t ConfigSave(AccessConfig_t *config)
{
    volatile uint16_t *destination;
    const uint8_t *bytes = (const uint8_t *)config;
    uint8_t success = 1U;

    config->magic = CONFIG_MAGIC;
    config->checksum = ConfigChecksum(config);
    FLASH->KEYR = 0x45670123UL;
    FLASH->KEYR = 0xCDEF89ABUL;
    FLASH->SR = FLASH_SR_EOP | FLASH_SR_PGERR | FLASH_SR_WRPRTERR;

    if(!FlashWaitReady())
    {
        success = 0U;
    }
    if(success != 0U)
    {
        FLASH->CR |= FLASH_CR_PER;
        FLASH->AR = CONFIG_FLASH_ADDRESS;
        FLASH->CR |= FLASH_CR_STRT;
        success = FlashWaitReady();
        FLASH->CR &= ~FLASH_CR_PER;
        if((FLASH->SR & (FLASH_SR_PGERR | FLASH_SR_WRPRTERR)) != 0U)
        {
            success = 0U;
        }
    }

    destination = (volatile uint16_t *)CONFIG_FLASH_ADDRESS;
    for(size_t i = 0U; success != 0U && i < sizeof(*config); i += 2U)
    {
        uint16_t word = bytes[i];
        if(i + 1U < sizeof(*config))
        {
            word |= (uint16_t)bytes[i + 1U] << 8U;
        }
        FLASH->SR = FLASH_SR_EOP | FLASH_SR_PGERR | FLASH_SR_WRPRTERR;
        FLASH->CR |= FLASH_CR_PG;
        destination[i / 2U] = word;
        success = FlashWaitReady();
        FLASH->CR &= ~FLASH_CR_PG;
        if((FLASH->SR & (FLASH_SR_PGERR | FLASH_SR_WRPRTERR)) != 0U ||
           destination[i / 2U] != word)
        {
            success = 0U;
        }
    }

    FLASH->CR |= FLASH_CR_LOCK;
    return success != 0U &&
           memcmp((const void *)CONFIG_FLASH_ADDRESS, config,
                  sizeof(*config)) == 0;
}

static uint8_t ConfigLoad(void)
{
    const AccessConfig_t *stored =
        (const AccessConfig_t *)CONFIG_FLASH_ADDRESS;
    if(!ConfigIsValid(stored))
    {
        memset(&access_config, 0, sizeof(access_config));
        return 0U;
    }
    memcpy(&access_config, stored, sizeof(access_config));
    return 1U;
}

static void Servo_SetAngle(uint16_t angle)
{
    if(servo_ready == 0U)
    {
        return;
    }
    if(angle > 180U)
    {
        angle = 180U;
    }
    TIM3->CCR2 = (uint16_t)(SERVO_MIN_PULSE_US +
        (((SERVO_MAX_PULSE_US - SERVO_MIN_PULSE_US) * angle) / 180U));
}

static uint8_t Servo_Init(void)
{
    uint32_t timer_clock = SystemCoreClock;
    uint32_t apb1_prescaler =
        (RCC->CFGR & RCC_CFGR_PPRE1) >> RCC_CFGR_PPRE1_Pos;
    if(apb1_prescaler >= 4U)
    {
        timer_clock >>= (apb1_prescaler - 3U);
        timer_clock *= 2U;
    }

    uint32_t prescaler_divider =
        (timer_clock + 500000U) / 1000000U;
    if(prescaler_divider == 0U || prescaler_divider > 65536U)
    {
        return 0U;
    }

    GPIOA->CRL = (GPIOA->CRL &
                  ~(GPIO_CRL_MODE7_Msk | GPIO_CRL_CNF7_Msk)) |
                 GPIO_CRL_MODE7_1 |
                 GPIO_CRL_CNF7_1;
    TIM3->CR1 = 0U;
    TIM3->PSC = prescaler_divider - 1U;
    TIM3->ARR = SERVO_FRAME_US - 1U;
    TIM3->CCR2 = SERVO_MIN_PULSE_US;
    TIM3->CCMR1 = (TIM3->CCMR1 &
                   ~(TIM_CCMR1_CC2S_Msk | TIM_CCMR1_OC2M_Msk)) |
                  TIM_CCMR1_OC2M_2 | TIM_CCMR1_OC2M_1 |
                  TIM_CCMR1_OC2PE;
    TIM3->CCER = (TIM3->CCER & ~TIM_CCER_CC2P) | TIM_CCER_CC2E;
    TIM3->EGR = TIM_EGR_UG;
    TIM3->SR = 0U;
    TIM3->CR1 = TIM_CR1_ARPE | TIM_CR1_CEN;
    servo_ready = 1U;
    return 1U;
}

static uint8_t Servo_Open(void)
{
    if(servo_ready == 0U)
    {
        return 0U;
    }
    Servo_SetAngle(180U);
    servo_is_open = 1U;
    door_open_tick = system_ticks;
    return 1U;
}

static uint8_t UIDMatches(const CardRecord_t *card,
                          const uint8_t *uid, uint8_t uid_length)
{
    return card->length == uid_length &&
           memcmp(card->uid, uid, uid_length) == 0;
}

static int8_t FindCard(const uint8_t *uid, uint8_t uid_length)
{
    for(uint8_t i = 0U; i < access_config.card_count; i++)
    {
        if(UIDMatches(&access_config.cards[i], uid, uid_length))
        {
            return (int8_t)i;
        }
    }
    return -1;
}

static void UI_ShowHome(void)
{
    if(access_config.card_count == 0U)
    {
        OLED_ShowActionScreen("DOOR LOCK SETUP",
                              "SCAN FIRST ADMIN",
                              "CARD TO CONTINUE");
    }
    else
    {
        OLED_ShowActionScreen("DOOR LOCK", "TAP CARD TO OPEN",
                              ReedSwitch_GetStatus() != 0U ?
                                  "REED: OPEN" : "REED: CLOSED");
    }
}

static void UI_ShowPin(void)
{
    OLED_ShowPinPrompt("PIN OPEN ADMIN MENU", pin_digits);
}

static void UI_ShowSetupPin(void)
{
    OLED_ShowPinPrompt(initial_setup != 0U ? "SET ADMIN PIN" :
                       "CHANGE ADMIN PIN", pin_digits);
}

static void UI_ShowMenu(void)
{
    OLED_ShowSystemMenu(menu_selection);
}

static void UI_ShowUIDText(const uint8_t *uid, uint8_t uid_length,
                           char *text, size_t text_size)
{
    static const char hex[] = "0123456789ABCDEF";
    size_t position = 0U;
    if(text_size == 0U)
    {
        return;
    }
    for(uint8_t i = 0U; i < uid_length && position + 2U < text_size; i++)
    {
        text[position++] = hex[uid[i] >> 4U];
        text[position++] = hex[uid[i] & 0x0FU];
    }
    text[position] = '\0';
}

static void UI_ShowCardList(void)
{
    if(access_config.card_count == 0U)
    {
        OLED_ShowRfidCard("NO CARDS", "SCAN ADMIN CARD");
        return;
    }

    char card_label[21];
    char uid_text[21];
    const CardRecord_t *card = &access_config.cards[card_list_selection];
    (void)snprintf(card_label, sizeof(card_label), "%c%02u %s %u/%u",
                   '>', (unsigned int)(card_list_selection + 1U),
                   card_list_selection == 0U ? "ADMIN" : "USER",
                   (unsigned int)(card_list_selection + 1U),
                   (unsigned int)access_config.card_count);
    UI_ShowUIDText(card->uid, card->length, uid_text, sizeof(uid_text));
    OLED_ShowRfidCard(card_label, uid_text);
}

static void UI_HandleKey(char key);

static void ProcessCard(const uint8_t *uid, uint8_t uid_length)
{
    int8_t card_index;
    if(initial_setup != 0U &&
       (current_screen == UI_SETUP_PIN ||
        current_screen == UI_CONFIRM_PIN))
    {
        return;
    }

    last_activity_tick = system_ticks;
    memcpy(last_uid, uid, uid_length);
    last_uid_length = uid_length;
    last_uid_valid = 1U;

    if(display_awake == 0U && oled_ready != 0U)
    {
        OLED_DisplayPower(1U);
        display_awake = 1U;
    }

    if(access_config.card_count == 0U)
    {
        memcpy(pending_admin_uid, uid, uid_length);
        pending_admin_uid_length = uid_length;
        initial_setup = 1U;
        memset(pin_input, 0, sizeof(pin_input));
        pin_digits = 0U;
        current_screen = UI_SETUP_PIN;
        if(oled_ready != 0U)
        {
            UI_ShowSetupPin();
        }
        return;
    }

    if(current_screen == UI_ADD_CARD)
    {
        card_index = FindCard(uid, uid_length);
        if(card_index >= 0)
        {
            if(oled_ready != 0U)
            {
                OLED_ShowActionScreen("CARD ALREADY",
                                      "THIS CARD IS SAVED",
                                      "SCAN ANOTHER CARD");
            }
            return;
        }
        if(access_config.card_count >= MAX_CARDS)
        {
            if(oled_ready != 0U)
            {
                OLED_ShowActionScreen("CARD LIST FULL",
                                      "MAX 10 CARDS",
                                      "REMOVE NOT SUPPORTED");
            }
            return;
        }

        AccessConfig_t updated = access_config;
        CardRecord_t *new_card = &updated.cards[updated.card_count];
        new_card->length = uid_length;
        memcpy(new_card->uid, uid, uid_length);
        updated.card_count++;
        if(ConfigSave(&updated))
        {
            access_config = updated;
            if(oled_ready != 0U)
            {
                OLED_ShowActionScreen("CARD REGISTERED",
                                      "SCAN NEXT CARD",
                                      "MAX 10 CARDS");
            }
        }
        else if(oled_ready != 0U)
        {
            OLED_ShowActionScreen("FLASH SAVE ERROR",
                                  "CARD NOT SAVED",
                                  "CHECK FLASH CONFIG");
        }
        return;
    }

    if(FindCard(uid, uid_length) >= 0)
    {
        if(Servo_Open() != 0U)
        {
            if(current_screen != UI_MENU && oled_ready != 0U)
            {
                OLED_ShowActionScreen("ACCESS GRANTED",
                                      "DOOR OPEN",
                                      "LOCKS IN 5 SECONDS");
            }
        }
        else if(oled_ready != 0U)
        {
            OLED_ShowActionScreen("CARD AUTHORIZED",
                                  "SERVO PWM ERROR",
                                  "CHECK PA7 / TIM3");
        }
    }
    else if(oled_ready != 0U)
    {
        OLED_ShowActionScreen("ACCESS DENIED",
                              "CARD NOT REGISTERED",
                              "ASK ADMIN");
    }
}

static void HandleCardScan(void)
{
    uint8_t uid[10];
    uint8_t uid_length = sizeof(uid);
    if(RC522_ReadUID(uid, &uid_length) != 0U &&
       ValidUidLength(uid_length))
    {
        card_miss_count = 0U;
        if(card_latched == 0U ||
           uid_length != last_uid_length ||
           memcmp(uid, last_uid, uid_length) != 0)
        {
            card_latched = 1U;
            ProcessCard(uid, uid_length);
        }
    }
    else if(card_miss_count < CARD_RELEASE_POLLS)
    {
        card_miss_count++;
        if(card_miss_count >= CARD_RELEASE_POLLS)
        {
            card_latched = 0U;
        }
    }
}

static void UI_HandlePinKey(char key)
{
    if(key >= '0' && key <= '9' && pin_digits < PIN_LENGTH)
    {
        pin_input[pin_digits++] = (uint8_t)key;
    }
    else if(key == 'A' && pin_digits > 0U)
    {
        pin_input[--pin_digits] = 0U;
    }
    else if(key == 'B')
    {
        current_screen = UI_HOME;
        pin_digits = 0U;
        UI_ShowHome();
        return;
    }
    else if(key == 'D' && pin_digits == PIN_LENGTH)
    {
        if(HashPin(pin_input) == access_config.pin_hash)
        {
            pin_digits = 0U;
            current_screen = UI_MENU;
            menu_selection = 0U;
            if(Servo_Open() != 0U)
            {
                UI_ShowMenu();
            }
            else
            {
                OLED_ShowActionScreen("ADMIN PIN OK",
                                      "SERVO PWM ERROR",
                                      "MENU STILL ACTIVE");
            }
            return;
        }
        current_screen = UI_HOME;
        pin_digits = 0U;
        OLED_ShowActionScreen("PIN INCORRECT",
                              "ACCESS DENIED",
                              "TRY AGAIN");
        return;
    }
    UI_ShowPin();
}

static void UI_HandleSetupKey(char key)
{
    if(key >= '0' && key <= '9' && pin_digits < PIN_LENGTH)
    {
        pin_input[pin_digits++] = (uint8_t)key;
    }
    else if(key == 'A' && pin_digits > 0U)
    {
        pin_input[--pin_digits] = 0U;
    }
    else if(key == 'B')
    {
        current_screen = UI_HOME;
        pin_digits = 0U;
        UI_ShowHome();
        return;
    }
    else if(key == 'D' && pin_digits == PIN_LENGTH)
    {
        if(current_screen == UI_SETUP_PIN)
        {
            memcpy(pending_pin, pin_input, PIN_LENGTH);
            memset(pin_input, 0, sizeof(pin_input));
            pin_digits = 0U;
            current_screen = UI_CONFIRM_PIN;
            OLED_ShowPinPrompt("CONFIRM ADMIN PIN", pin_digits);
            return;
        }

        if(memcmp(pending_pin, pin_input, PIN_LENGTH) != 0)
        {
            memset(pin_input, 0, sizeof(pin_input));
            pin_digits = 0U;
            current_screen = UI_SETUP_PIN;
            OLED_ShowActionScreen("PIN DOES NOT MATCH",
                                  "ENTER PIN AGAIN",
                                  "USE 6 DIGITS");
            return;
        }

        AccessConfig_t updated = access_config;
        if(initial_setup != 0U)
        {
            memset(&updated, 0xFF, sizeof(updated));
            updated.card_count = 1U;
            updated.cards[0].length = pending_admin_uid_length;
            memcpy(updated.cards[0].uid, pending_admin_uid,
                   pending_admin_uid_length);
        }
        updated.pin_hash = HashPin(pending_pin);
        if(ConfigSave(&updated))
        {
            access_config = updated;
            current_screen = UI_HOME;
            pin_digits = 0U;
            initial_setup = 0U;
            memset(pin_input, 0, sizeof(pin_input));
            OLED_ShowActionScreen("SETUP SAVED",
                                  "ADMIN READY",
                                  "TAP CARD TO OPEN");
        }
        else
        {
            current_screen = UI_HOME;
            pin_digits = 0U;
            OLED_ShowActionScreen("FLASH SAVE ERROR",
                                  "SETUP NOT SAVED",
                                  "CHECK FLASH");
        }
        return;
    }

    if(current_screen == UI_SETUP_PIN)
    {
        UI_ShowSetupPin();
    }
    else
    {
        OLED_ShowPinPrompt("CONFIRM ADMIN PIN", pin_digits);
    }
}

static void UI_HandleKey(char key)
{
    if(key == '\n')
    {
        return;
    }
    last_activity_tick = system_ticks;

    if(current_screen == UI_HOME)
    {
        if(key == 'A' && access_config.card_count != 0U)
        {
            current_screen = UI_PIN;
            memset(pin_input, 0, sizeof(pin_input));
            pin_digits = 0U;
            UI_ShowPin();
        }
        return;
    }

    if(current_screen == UI_PIN)
    {
        UI_HandlePinKey(key);
        return;
    }
    if(current_screen == UI_SETUP_PIN ||
       current_screen == UI_CONFIRM_PIN)
    {
        UI_HandleSetupKey(key);
        return;
    }
    if(current_screen == UI_MENU)
    {
        if(key == '2')
        {
            menu_selection = (uint8_t)((menu_selection + 3U) % 4U);
            UI_ShowMenu();
        }
        else if(key == '8')
        {
            menu_selection = (uint8_t)((menu_selection + 1U) % 4U);
            UI_ShowMenu();
        }
        else if(key == 'B')
        {
            current_screen = UI_HOME;
            UI_ShowHome();
        }
        else if(key == 'D')
        {
            switch(menu_selection)
            {
                case 0U:
                    current_screen = UI_ADD_CARD;
                    OLED_ShowEnrollCard();
                    break;
                case 1U:
                    current_screen = UI_CARD_LIST;
                    UI_ShowCardList();
                    break;
                case 2U:
                    current_screen = UI_SETUP_PIN;
                    initial_setup = 0U;
                    memset(pin_input, 0, sizeof(pin_input));
                    pin_digits = 0U;
                    UI_ShowSetupPin();
                    break;
                default:
                    current_screen = UI_HOME;
                    UI_ShowHome();
                    break;
            }
        }
        return;
    }
    if(current_screen == UI_ADD_CARD)
    {
        if(key == 'B')
        {
            current_screen = UI_MENU;
            UI_ShowMenu();
        }
        return;
    }
    if(current_screen == UI_CARD_LIST)
    {
        if(key == '2' && access_config.card_count > 0U)
        {
            card_list_selection = (uint8_t)(
                (card_list_selection + access_config.card_count - 1U) %
                access_config.card_count);
            UI_ShowCardList();
        }
        else if(key == '8' && access_config.card_count > 0U)
        {
            card_list_selection = (uint8_t)(
                (card_list_selection + 1U) % access_config.card_count);
            UI_ShowCardList();
        }
        else if(key == 'B')
        {
            current_screen = UI_MENU;
            UI_ShowMenu();
        }
    }
}

int main(void)
{
    Config_RCC();
    SystemCoreClockUpdate();
    delay_init();
    Config_GPIO();
    Config_EXTI();
    servo_ready = Servo_Init();
    (void)SysTick_Config(SystemCoreClock / 100U);

    (void)ConfigLoad();
    oled_ready = OLED_Init();
    rfid_ready = RC522_Init();
    if(oled_ready != 0U)
    {
        if(rfid_ready != 0U && servo_ready != 0U)
        {
            UI_ShowHome();
        }
        else if(rfid_ready == 0U)
        {
            static const char hex[] = "0123456789ABCDEF";
            uint8_t version = RC522_GetVersion();
            char version_line[] = "VERSION: 00";
            version_line[9] = hex[version >> 4U];
            version_line[10] = hex[version & 0x0FU];
            OLED_ShowLines("RC522 INIT ERROR", version_line,
                           "CHECK SPI/3V3/GND", "CS PA15 RST PA4");
        }
        else
        {
            OLED_ShowLines("SERVO PWM ERROR",
                           "CHECK PA7 / TIM3",
                           "CHECK TIMER CLOCK",
                           "RFID STILL ACTIVE");
        }
    }

    last_activity_tick = system_ticks;
    while(1)
    {
        uint32_t now = system_ticks;
        if(keypad_wake_event != 0U && keypad_state == KEYPAD_IDLE)
        {
            keypad_wake_event = 0U;
            Keypad_SetEXTIEnabled(0U);
            keypad_state = KEYPAD_DEBOUNCE_PRESS;
            keypad_state_tick = now;
        }
        else if(keypad_wake_event != 0U)
        {
            keypad_wake_event = 0U;
        }

        now = system_ticks;
        if(keypad_state == KEYPAD_DEBOUNCE_PRESS &&
           TickElapsed(now, keypad_state_tick, KEY_DEBOUNCE_TICKS))
        {
            char key = Keypad_Scan();
            if(key != '\n')
            {
                if(display_awake == 0U)
                {
                    display_awake = 1U;
                    last_activity_tick = system_ticks;
                    if(oled_ready != 0U)
                    {
                        OLED_DisplayPower(1U);
                    }
                    if(access_config.card_count != 0U)
                    {
                        current_screen = UI_PIN;
                        memset(pin_input, 0, sizeof(pin_input));
                        pin_digits = 0U;
                        UI_ShowPin();
                    }
                    else
                    {
                        current_screen = UI_HOME;
                        UI_ShowHome();
                    }
                }
                else
                {
                    UI_HandleKey(key);
                }
            }
            keypad_state = KEYPAD_WAIT_RELEASE;
            keypad_state_tick = now;
        }

        if(keypad_state == KEYPAD_WAIT_RELEASE)
        {
            if(Keypad_IsReleased() != 0U)
            {
                keypad_state = KEYPAD_DEBOUNCE_RELEASE;
                keypad_state_tick = now;
            }
        }
        else if(keypad_state == KEYPAD_DEBOUNCE_RELEASE)
        {
            if(Keypad_IsReleased() == 0U)
            {
                keypad_state = KEYPAD_WAIT_RELEASE;
            }
            else if(TickElapsed(now, keypad_state_tick,
                                KEY_DEBOUNCE_TICKS))
            {
                keypad_state = KEYPAD_IDLE;
                Keypad_SetEXTIEnabled(1U);
            }
        }

        if(rfid_ready != 0U &&
           TickElapsed(now, last_rfid_poll_tick, RFID_POLL_TICKS))
        {
            last_rfid_poll_tick = now;
            HandleCardScan();
        }

        now = system_ticks;
        if(servo_is_open != 0U &&
           TickElapsed(now, door_open_tick, DOOR_OPEN_TICKS))
        {
            Servo_SetAngle(0U);
            servo_is_open = 0U;
            if(display_awake != 0U && current_screen != UI_MENU &&
               oled_ready != 0U)
            {
                current_screen = UI_HOME;
                UI_ShowHome();
            }
        }

        if(display_awake != 0U &&
           TickElapsed(now, last_activity_tick, UI_SLEEP_TICKS))
        {
            current_screen = UI_HOME;
            display_awake = 0U;
            if(oled_ready != 0U)
            {
                OLED_DisplayPower(0U);
            }
        }

        __WFI();
    }
}

void Config_RCC(void)
{
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN_Msk |
                    RCC_APB2ENR_IOPBEN_Msk |
                    RCC_APB2ENR_IOPCEN_Msk |
                    RCC_APB2ENR_AFIOEN_Msk;
    RCC->APB1ENR |= RCC_APB1ENR_TIM2EN |
                    RCC_APB1ENR_TIM3EN |
                    RCC_APB1ENR_I2C1EN_Msk;
}

void Config_GPIO(void)
{
    Keypad_ConfigGPIO();
    ReedSwitch_ConfigGPIO();
}

void Config_EXTI(void)
{
    AFIO_Config();
    Keypad_ConfigEXTI();
}
