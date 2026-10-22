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
#define CONFIG_MAGIC 0x53444C32UL
#define LEGACY_CONFIG_MAGIC 0x53444C31UL
#define MAX_CARDS 10U
#define PIN_LENGTH 6U
#define UI_SLEEP_TICKS 3000U
#define RFID_POLL_TICKS 5U
#define CARD_RELEASE_POLLS 20U
#define DOOR_OPEN_TICKS 1000U
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
    uint8_t door_pin_configured;
    uint8_t reserved[2];
    uint32_t admin_pin_hash;
    uint32_t door_pin_hash;
    CardRecord_t cards[MAX_CARDS];
    uint32_t checksum;
} AccessConfig_t;

typedef struct
{
    uint32_t magic;
    uint8_t card_count;
    uint8_t reserved[3];
    uint32_t admin_pin_hash;
    CardRecord_t cards[MAX_CARDS];
    uint32_t checksum;
} LegacyAccessConfig_t;

typedef enum
{
    UI_HOME,
    UI_PIN,
    UI_ADMIN_PIN,
    UI_SETUP_PIN,
    UI_CONFIRM_PIN,
    UI_SETUP_DOOR_PIN,
    UI_CONFIRM_DOOR_PIN,
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
static uint32_t pending_admin_pin_hash;
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

static uint32_t LegacyConfigChecksum(const LegacyAccessConfig_t *config)
{
    const uint8_t *bytes = (const uint8_t *)config;
    uint32_t checksum = 2166136261UL;
    for(size_t i = 0U; i < offsetof(LegacyAccessConfig_t, checksum); i++)
    {
        checksum = (checksum ^ bytes[i]) * 16777619UL;
    }
    return checksum;
}

static uint8_t ConfigIsValid(const AccessConfig_t *config)
{
    if(config->magic != CONFIG_MAGIC ||
       config->card_count > MAX_CARDS ||
       config->door_pin_configured > 1U ||
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

static uint8_t LegacyConfigIsValid(const LegacyAccessConfig_t *config)
{
    if(config->magic != LEGACY_CONFIG_MAGIC ||
       config->card_count == 0U ||
       config->card_count > MAX_CARDS ||
       config->checksum != LegacyConfigChecksum(config))
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
    if(ConfigIsValid(stored))
    {
        memcpy(&access_config, stored, sizeof(access_config));
        return 1U;
    }

    const LegacyAccessConfig_t *legacy =
        (const LegacyAccessConfig_t *)CONFIG_FLASH_ADDRESS;
    if(LegacyConfigIsValid(legacy))
    {
        memset(&access_config, 0, sizeof(access_config));
        access_config.magic = CONFIG_MAGIC;
        access_config.card_count = legacy->card_count;
        access_config.admin_pin_hash = legacy->admin_pin_hash;
        memcpy(access_config.cards, legacy->cards,
               sizeof(legacy->cards));
        return 1U;
    }

    {
        memset(&access_config, 0, sizeof(access_config));
        return 0U;
    }
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
    if(access_config.magic != CONFIG_MAGIC)
    {
        current_screen = UI_SETUP_PIN;
        OLED_ShowPinPrompt("TAO PIN ADMIN", pin_digits, 0U);
    }
    else
    {
        OLED_ShowPinPrompt("NHAP PIN", 0U, 1U);
    }
}

static void UI_ShowPin(void)
{
    OLED_ShowPinPrompt("NHAP PIN", pin_digits, 1U);
}

static void UI_ShowAdminPin(void)
{
    OLED_ShowPinPrompt("PIN ADMIN", pin_digits, 0U);
}

static void UI_ShowSetupPin(void)
{
    const char *title;
    if(current_screen == UI_SETUP_DOOR_PIN)
    {
        title = initial_setup != 0U ? "TAO PIN MO CUA" :
                "DOI PIN MO CUA";
    }
    else
    {
        title = initial_setup != 0U ? "TAO PIN ADMIN" :
                "DOI PIN ADMIN";
    }
    OLED_ShowPinPrompt(title, pin_digits, 0U);
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
static void UI_HandlePinKey(char key);

static void ProcessCard(const uint8_t *uid, uint8_t uid_length)
{
    int8_t card_index;
    if(initial_setup != 0U &&
       (current_screen == UI_SETUP_PIN ||
        current_screen == UI_CONFIRM_PIN ||
        current_screen == UI_SETUP_DOOR_PIN ||
        current_screen == UI_CONFIRM_DOOR_PIN))
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
                OLED_ShowCenteredMessage("DA MO KHOA");
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
        if(initial_setup != 0U)
        {
            current_screen = UI_SETUP_PIN;
            memset(pin_input, 0, sizeof(pin_input));
            memset(pending_pin, 0, sizeof(pending_pin));
            pin_digits = 0U;
            UI_ShowSetupPin();
            return;
        }
        current_screen = UI_HOME;
        pin_digits = 0U;
        UI_ShowHome();
        return;
    }
    else if(key == 'D' && pin_digits == PIN_LENGTH)
    {
        uint32_t entered_pin_hash = HashPin(pin_input);
        if(current_screen == UI_ADMIN_PIN &&
           entered_pin_hash == access_config.admin_pin_hash)
        {
            pin_digits = 0U;
            current_screen = UI_MENU;
            menu_selection = 0U;
            UI_ShowMenu();
            return;
        }
        if(current_screen == UI_PIN &&
           access_config.door_pin_configured != 0U &&
           entered_pin_hash == access_config.door_pin_hash)
        {
            pin_digits = 0U;
            if(Servo_Open() != 0U)
            {
                current_screen = UI_HOME;
                OLED_ShowCenteredMessage("DA MO KHOA");
            }
            else
            {
                current_screen = UI_HOME;
                OLED_ShowActionScreen("LOI SERVO",
                                      "KIEM TRA PA7 / TIM3", NULL);
            }
            return;
        }
        uint8_t admin_pin_attempt = current_screen == UI_ADMIN_PIN;
        current_screen = UI_HOME;
        pin_digits = 0U;
        OLED_ShowActionScreen(admin_pin_attempt != 0U ?
                              "PIN ADMIN SAI" : "PIN SAI",
                              admin_pin_attempt != 0U ?
                              "KHONG VAO DUOC MENU" :
                              "KHONG DUOC MO KHOA",
                              "NHAP LAI");
        return;
    }
    if(current_screen == UI_ADMIN_PIN)
    {
        UI_ShowAdminPin();
    }
    else
    {
        UI_ShowPin();
    }
}

static void UI_HandleSetupKey(char key)
{
    uint8_t setting_door_pin =
        current_screen == UI_SETUP_DOOR_PIN ||
        current_screen == UI_CONFIRM_DOOR_PIN;

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
        if(current_screen == UI_SETUP_PIN ||
           current_screen == UI_SETUP_DOOR_PIN)
        {
            memcpy(pending_pin, pin_input, PIN_LENGTH);
            memset(pin_input, 0, sizeof(pin_input));
            pin_digits = 0U;
            current_screen = setting_door_pin ?
                             UI_CONFIRM_DOOR_PIN : UI_CONFIRM_PIN;
            OLED_ShowPinPrompt(setting_door_pin ?
                               "XAC NHAN PIN MO CUA" :
                               "XAC NHAN PIN ADMIN", pin_digits, 0U);
            return;
        }

        if(memcmp(pending_pin, pin_input, PIN_LENGTH) != 0)
        {
            memset(pin_input, 0, sizeof(pin_input));
            pin_digits = 0U;
            current_screen = setting_door_pin ?
                             UI_SETUP_DOOR_PIN : UI_SETUP_PIN;
            OLED_ShowActionScreen("PIN KHONG KHOP",
                                  "NHAP LAI PIN",
                                  "DUNG 6 SO");
            return;
        }

        uint32_t new_pin_hash = HashPin(pending_pin);
        uint32_t other_pin_hash = setting_door_pin ?
                                  (initial_setup != 0U ?
                                   pending_admin_pin_hash :
                                   access_config.admin_pin_hash) :
                                  access_config.door_pin_hash;
        if((setting_door_pin || access_config.door_pin_configured != 0U) &&
           new_pin_hash == other_pin_hash)
        {
            memset(pin_input, 0, sizeof(pin_input));
            pin_digits = 0U;
            current_screen = setting_door_pin ?
                             UI_SETUP_DOOR_PIN : UI_SETUP_PIN;
            OLED_ShowActionScreen("HAI PIN PHAI KHAC",
                                  "HAY CHON PIN KHAC", NULL);
            return;
        }

        if(current_screen == UI_CONFIRM_PIN && initial_setup != 0U)
        {
            pending_admin_pin_hash = new_pin_hash;
            memset(pin_input, 0, sizeof(pin_input));
            memset(pending_pin, 0, sizeof(pending_pin));
            current_screen = UI_SETUP_DOOR_PIN;
            pin_digits = 0U;
            UI_ShowSetupPin();
            return;
        }

        AccessConfig_t updated = access_config;
        if(initial_setup != 0U)
        {
            memset(&updated, 0xFF, sizeof(updated));
            updated.card_count = 0U;
            updated.door_pin_configured = 0U;
            updated.reserved[0] = 0U;
            updated.reserved[1] = 0U;
            updated.admin_pin_hash = pending_admin_pin_hash;
        }
        if(setting_door_pin)
        {
            updated.door_pin_hash = new_pin_hash;
            updated.door_pin_configured = 1U;
        }
        else
        {
            updated.admin_pin_hash = new_pin_hash;
        }
        if(ConfigSave(&updated))
        {
            access_config = updated;
            current_screen = UI_HOME;
            pin_digits = 0U;
            initial_setup = 0U;
            memset(pin_input, 0, sizeof(pin_input));
            memset(pending_pin, 0, sizeof(pending_pin));
            pending_admin_pin_hash = 0U;
            OLED_ShowActionScreen("DA LUU CAI DAT",
                                  "HAI PIN DA SAN SANG",
                                  "NHAP PIN MO CUA");
        }
        else
        {
            current_screen = UI_HOME;
            pin_digits = 0U;
            OLED_ShowActionScreen("LOI LUU CAI DAT",
                                  "CHUA LUU PIN",
                                  "KIEM TRA FLASH");
        }
        return;
    }

    if(current_screen == UI_SETUP_PIN ||
       current_screen == UI_SETUP_DOOR_PIN)
    {
        UI_ShowSetupPin();
    }
    else
    {
        OLED_ShowPinPrompt(setting_door_pin ?
                           "XAC NHAN PIN MO CUA" :
                           "XAC NHAN PIN ADMIN", pin_digits, 0U);
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
        if(access_config.magic == CONFIG_MAGIC && key == 'C')
        {
            current_screen = UI_ADMIN_PIN;
            memset(pin_input, 0, sizeof(pin_input));
            pin_digits = 0U;
            UI_ShowAdminPin();
            return;
        }
        if(access_config.magic == CONFIG_MAGIC &&
           (key == 'A' || (key >= '0' && key <= '9')))
        {
            current_screen = UI_PIN;
            memset(pin_input, 0, sizeof(pin_input));
            pin_digits = 0U;
            if(key >= '0' && key <= '9')
            {
                UI_HandlePinKey(key);
            }
            else
            {
                UI_ShowPin();
            }
        }
        return;
    }

    if(current_screen == UI_PIN)
    {
        UI_HandlePinKey(key);
        return;
    }
    if(current_screen == UI_ADMIN_PIN)
    {
        UI_HandlePinKey(key);
        return;
    }
    if(current_screen == UI_SETUP_PIN ||
       current_screen == UI_CONFIRM_PIN ||
       current_screen == UI_SETUP_DOOR_PIN ||
       current_screen == UI_CONFIRM_DOOR_PIN)
    {
        UI_HandleSetupKey(key);
        return;
    }
    if(current_screen == UI_MENU)
    {
        if(key == '2')
        {
            menu_selection = (uint8_t)((menu_selection + 4U) % 5U);
            UI_ShowMenu();
        }
        else if(key == '8')
        {
            menu_selection = (uint8_t)((menu_selection + 1U) % 5U);
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
                case 3U:
                    current_screen = UI_SETUP_DOOR_PIN;
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
    uint8_t config_loaded;

    Config_RCC();
    SystemCoreClockUpdate();
    delay_init();
    Config_GPIO();
    Config_EXTI();
    servo_ready = Servo_Init();
    (void)SysTick_Config(SystemCoreClock / 100U);

    config_loaded = ConfigLoad();
    if(config_loaded == 0U)
    {
        initial_setup = 1U;
        current_screen = UI_SETUP_PIN;
    }
    oled_ready = OLED_Init();
    rfid_ready = RC522_Init();
    if(oled_ready != 0U)
    {
        if(config_loaded == 0U)
        {
            UI_ShowSetupPin();
        }
        else
        {
            UI_ShowHome();
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
                    if(access_config.magic == CONFIG_MAGIC &&
                       (key == 'C' || key == 'A' ||
                        (key >= '0' && key <= '9')))
                    {
                        current_screen = UI_HOME;
                        UI_HandleKey(key);
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
