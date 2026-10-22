#include <stddef.h>
#include <string.h>
#include "stm32f103xb.h"
#include "../include/header/OLED.h"

#define OLED_WIDTH 128U
#define OLED_PAGES 8U

static uint8_t oled_address;
static uint8_t framebuffer[OLED_WIDTH * OLED_PAGES];

static uint8_t I2C_Wait(uint32_t flag)
{
    uint32_t timeout = 100000U;
    while((I2C1->SR1 & flag) == 0U && timeout > 0U)
    {
        if((I2C1->SR1 & I2C_SR1_AF) != 0U)
        {
            I2C1->SR1 &= ~I2C_SR1_AF;
            return 0U;
        }
        timeout--;
    }
    return timeout != 0U;
}

static uint8_t I2C_Start(uint8_t address)
{
    uint32_t timeout = 100000U;
    while((I2C1->SR2 & I2C_SR2_BUSY) != 0U && timeout > 0U)
    {
        timeout--;
    }
    if(timeout == 0U)
    {
        return 0U;
    }

    I2C1->CR1 |= I2C_CR1_START;
    if(!I2C_Wait(I2C_SR1_SB))
    {
        return 0U;
    }
    I2C1->DR = (uint8_t)(address << 1U);
    if(!I2C_Wait(I2C_SR1_ADDR))
    {
        I2C1->CR1 |= I2C_CR1_STOP;
        return 0U;
    }
    (void)I2C1->SR1;
    (void)I2C1->SR2;
    return 1U;
}

static uint8_t I2C_WriteByte(uint8_t value)
{
    I2C1->DR = value;
    return I2C_Wait(I2C_SR1_TXE);
}

static uint8_t I2C_Write(uint8_t control, const uint8_t *data,
                         uint16_t length)
{
    if(!I2C_Start(oled_address) || !I2C_WriteByte(control))
    {
        I2C1->CR1 |= I2C_CR1_STOP;
        return 0U;
    }

    for(uint16_t i = 0U; i < length; i++)
    {
        if(!I2C_WriteByte(data[i]))
        {
            I2C1->CR1 |= I2C_CR1_STOP;
            return 0U;
        }
    }
    if(!I2C_Wait(I2C_SR1_BTF))
    {
        I2C1->CR1 |= I2C_CR1_STOP;
        return 0U;
    }

    I2C1->CR1 |= I2C_CR1_STOP;
    return 1U;
}

static uint8_t OLED_Command(uint8_t command)
{
    return I2C_Write(0x00U, &command, 1U);
}

static void OLED_Clear(void)
{
    memset(framebuffer, 0, sizeof(framebuffer));
}

static const uint8_t *OLED_Glyph(char character)
{
    static const uint8_t digits[10][5] = {
        {0x3EU,0x51U,0x49U,0x45U,0x3EU}, {0x00U,0x42U,0x7FU,0x40U,0x00U},
        {0x42U,0x61U,0x51U,0x49U,0x46U}, {0x21U,0x41U,0x45U,0x4BU,0x31U},
        {0x18U,0x14U,0x12U,0x7FU,0x10U}, {0x27U,0x45U,0x45U,0x45U,0x39U},
        {0x3CU,0x4AU,0x49U,0x49U,0x30U}, {0x01U,0x71U,0x09U,0x05U,0x03U},
        {0x36U,0x49U,0x49U,0x49U,0x36U}, {0x06U,0x49U,0x49U,0x29U,0x1EU}
    };
    static const uint8_t letters[26][5] = {
        {0x7EU,0x11U,0x11U,0x11U,0x7EU}, {0x7FU,0x49U,0x49U,0x49U,0x36U},
        {0x3EU,0x41U,0x41U,0x41U,0x22U}, {0x7FU,0x41U,0x41U,0x22U,0x1CU},
        {0x7FU,0x49U,0x49U,0x49U,0x41U}, {0x7FU,0x09U,0x09U,0x09U,0x01U},
        {0x3EU,0x41U,0x49U,0x49U,0x7AU}, {0x7FU,0x08U,0x08U,0x08U,0x7FU},
        {0x00U,0x41U,0x7FU,0x41U,0x00U}, {0x20U,0x40U,0x41U,0x3FU,0x01U},
        {0x7FU,0x08U,0x14U,0x22U,0x41U}, {0x7FU,0x40U,0x40U,0x40U,0x40U},
        {0x7FU,0x02U,0x0CU,0x02U,0x7FU}, {0x7FU,0x04U,0x08U,0x10U,0x7FU},
        {0x3EU,0x41U,0x41U,0x41U,0x3EU}, {0x7FU,0x09U,0x09U,0x09U,0x06U},
        {0x3EU,0x41U,0x51U,0x21U,0x5EU}, {0x7FU,0x09U,0x19U,0x29U,0x46U},
        {0x46U,0x49U,0x49U,0x49U,0x31U}, {0x01U,0x01U,0x7FU,0x01U,0x01U},
        {0x3FU,0x40U,0x40U,0x40U,0x3FU}, {0x1FU,0x20U,0x40U,0x20U,0x1FU},
        {0x3FU,0x40U,0x38U,0x40U,0x3FU}, {0x63U,0x14U,0x08U,0x14U,0x63U},
        {0x07U,0x08U,0x70U,0x08U,0x07U}, {0x61U,0x51U,0x49U,0x45U,0x43U}
    };
    static const uint8_t colon[5] = {0x00U,0x36U,0x36U,0x00U,0x00U};
    static const uint8_t greater_than[5] = {0x00U,0x41U,0x22U,0x14U,0x08U};
    static const uint8_t slash[5] = {0x20U,0x10U,0x08U,0x04U,0x02U};
    static const uint8_t hyphen[5] = {0x08U,0x08U,0x08U,0x08U,0x08U};
    static const uint8_t star[5] = {0x14U,0x08U,0x3EU,0x08U,0x14U};
    static const uint8_t blank[5] = {0U,0U,0U,0U,0U};

    if(character >= '0' && character <= '9')
    {
        return digits[character - '0'];
    }
    if(character >= 'A' && character <= 'Z')
    {
        return letters[character - 'A'];
    }
    switch(character)
    {
        case ':': return colon;
        case '>': return greater_than;
        case '/': return slash;
        case '-': return hyphen;
        case '*': return star;
        default: return blank;
    }
}

static void OLED_DrawText(uint8_t x, uint8_t y, const char *text)
{
    while(*text != '\0' && x <= OLED_WIDTH - 6U)
    {
        const uint8_t *glyph = OLED_Glyph(*text++);
        for(uint8_t column = 0U; column < 5U; column++)
        {
            for(uint8_t row = 0U; row < 7U; row++)
            {
                if((glyph[column] & (1U << row)) != 0U)
                {
                    uint16_t pixel = (uint16_t)(y + row);
                    framebuffer[(pixel / 8U) * OLED_WIDTH + x + column] |=
                        (uint8_t)(1U << (pixel % 8U));
                }
            }
        }
        x = (uint8_t)(x + 6U);
    }
}

static uint8_t OLED_Refresh(void)
{
    for(uint8_t page = 0U; page < OLED_PAGES; page++)
    {
        if(!OLED_Command((uint8_t)(0xB0U + page)) ||
           !OLED_Command(0x00U) ||
           !OLED_Command(0x10U) ||
           !I2C_Write(0x40U, &framebuffer[page * OLED_WIDTH], OLED_WIDTH))
        {
            return 0U;
        }
    }
    return 1U;
}

uint8_t OLED_Init(void)
{
    static const uint8_t init_commands[] = {
        0xAEU, 0xD5U, 0x80U, 0xA8U, 0x3FU, 0xD3U, 0x00U, 0x40U,
        0x8DU, 0x14U, 0x20U, 0x02U, 0xA1U, 0xC8U, 0xDAU, 0x12U,
        0x81U, 0x7FU, 0xD9U, 0xF1U, 0xDBU, 0x40U, 0xA4U, 0xA6U, 0xAFU
    };

    RCC->APB2ENR |= RCC_APB2ENR_IOPBEN_Msk | RCC_APB2ENR_AFIOEN_Msk;
    RCC->APB1ENR |= RCC_APB1ENR_I2C1EN_Msk;
    AFIO->MAPR |= AFIO_MAPR_I2C1_REMAP;

    GPIOB->CRH = (GPIOB->CRH &
                  ~(GPIO_CRH_MODE8_Msk | GPIO_CRH_CNF8_Msk |
                    GPIO_CRH_MODE9_Msk | GPIO_CRH_CNF9_Msk)) |
                 GPIO_CRH_MODE8_1 | GPIO_CRH_CNF8 |
                 GPIO_CRH_MODE9_1 | GPIO_CRH_CNF9;

    SystemCoreClockUpdate();
    uint32_t pclk1 = SystemCoreClock;
    uint32_t ppre1 = (RCC->CFGR & RCC_CFGR_PPRE1) >> RCC_CFGR_PPRE1_Pos;
    if(ppre1 >= 4U)
    {
        pclk1 >>= (ppre1 - 3U);
    }
    uint32_t pclk1_mhz = pclk1 / 1000000U;
    I2C1->CR1 = I2C_CR1_SWRST;
    I2C1->CR1 = 0U;
    I2C1->CR2 = pclk1_mhz;
    I2C1->OAR1 = 1U << 14U;
    I2C1->CCR = pclk1 / 200000U;
    I2C1->TRISE = pclk1_mhz + 1U;
    I2C1->CR1 = I2C_CR1_PE;

    oled_address = 0x3CU;
    if(!I2C_Start(oled_address))
    {
        oled_address = 0x3DU;
        if(!I2C_Start(oled_address))
        {
            return 0U;
        }
    }
    I2C1->CR1 |= I2C_CR1_STOP;

    for(uint8_t i = 0U; i < sizeof(init_commands); i++)
    {
        if(!OLED_Command(init_commands[i]))
        {
            return 0U;
        }
    }
    OLED_Clear();
    return OLED_Refresh();
}

void OLED_DisplayPower(uint8_t enabled)
{
    (void)OLED_Command(enabled != 0U ? 0xAFU : 0xAEU);
}

void OLED_ShowMessage(const char *message)
{
    OLED_Clear();
    OLED_DrawText(0U, 0U, message);
    (void)OLED_Refresh();
}

void OLED_ShowLines(const char *line1, const char *line2,
                    const char *line3, const char *line4)
{
    OLED_Clear();
    if(line1 != NULL) OLED_DrawText(0U, 0U, line1);
    if(line2 != NULL) OLED_DrawText(0U, 16U, line2);
    if(line3 != NULL) OLED_DrawText(0U, 32U, line3);
    if(line4 != NULL) OLED_DrawText(0U, 48U, line4);
    (void)OLED_Refresh();
}

void OLED_ShowActionScreen(const char *title, const char *content1,
                           const char *content2)
{
    OLED_Clear();
    if(title != NULL) OLED_DrawText(0U, 2U, title);
    if(content1 != NULL) OLED_DrawText(0U, 22U, content1);
    if(content2 != NULL) OLED_DrawText(0U, 40U, content2);
    (void)OLED_Refresh();
}

void OLED_ShowSystemMenu(uint8_t selected)
{
    static const char *const menu_items[] = {
        "1 ADD RFID",
        "2 CARD LIST",
        "3 CHANGE PIN",
        "4 EXIT"
    };
    const uint8_t item_count =
        (uint8_t)(sizeof(menu_items) / sizeof(menu_items[0]));
    if(selected >= item_count)
    {
        selected = 0U;
    }

    OLED_Clear();
    OLED_DrawText(0U, 1U, "ADMIN MENU");
    for(uint8_t row = 0U; row < item_count; row++)
    {
        uint8_t y = (uint8_t)(14U + row * 11U);
        OLED_DrawText(0U, y, row == selected ? "> " : "  ");
        OLED_DrawText(12U, y, menu_items[row]);
    }
    (void)OLED_Refresh();
}

void OLED_ShowPinEntry(uint8_t digits_entered)
{
    char pin_line[] = "PIN 0/6: ------";
    if(digits_entered > 6U)
    {
        digits_entered = 6U;
    }
    pin_line[4] = (char)('0' + digits_entered);
    for(uint8_t i = 0U; i < digits_entered; i++)
    {
        pin_line[9U + i] = '*';
    }
    OLED_ShowActionScreen("KEYPAD VERIFY", "ENTER PIN TO UNLOCK",
                          pin_line);
}

void OLED_ShowPinPrompt(const char *title, uint8_t digits_entered)
{
    char pin_line[] = "PIN: ------";
    if(digits_entered > 6U)
    {
        digits_entered = 6U;
    }
    for(uint8_t i = 0U; i < digits_entered; i++)
    {
        pin_line[5U + i] = '*';
    }
    OLED_ShowActionScreen(title, "ENTER 6 DIGIT PIN", pin_line);
}

void OLED_ShowEnrollCard(void)
{
    OLED_ShowActionScreen("ADD RFID CARD", "SCAN NEW CARD",
                          "MAX 10 CARDS");
}

void OLED_ShowRfidCard(const char *label, const char *uid)
{
    OLED_Clear();
    OLED_DrawText(0U, 1U, "RFID CARD LIST");
    if(label != NULL) OLED_DrawText(0U, 22U, label);
    if(uid != NULL) OLED_DrawText(0U, 40U, uid);
    (void)OLED_Refresh();
}

void OLED_ShowRfidList(const char *last_uid)
{
    OLED_ShowActionScreen("RFID CARD LIST",
                          "MAX 10 CARDS",
                          last_uid != NULL ? last_uid : "NO CARD SCANNED");
}

void OLED_ShowSecurityAlert(void)
{
    OLED_ShowActionScreen("SECURITY ALERT",
                          "ADMIN REQUIRED",
                          "PIN NOT CONFIGURED");
}

void OLED_ShowUnavailable(const char *feature)
{
    OLED_ShowActionScreen(feature,
                          "NOT AVAILABLE",
                          "NO CAMERA ON STM32");
}

void OLED_ShowUID(const uint8_t *uid, uint8_t uid_length)
{
    static const char hex[] = "0123456789ABCDEF";
    char text[21];
    uint8_t position = 0U;

    if(uid == NULL || uid_length == 0U || uid_length > 10U)
    {
        return;
    }
    for(uint8_t i = 0U; i < uid_length; i++)
    {
        text[position++] = hex[uid[i] >> 4U];
        text[position++] = hex[uid[i] & 0x0FU];
    }
    text[position] = '\0';

    OLED_Clear();
    OLED_DrawText(0U, 0U, "UID:");
    OLED_DrawText(0U, 24U, text);
    (void)OLED_Refresh();
}
