#include <stdint.h>
#include "../include/header/keypad.h"
#include "../include/header/delay.h"



volatile uint8_t keypad_wake_event = 0U;
static const uint8_t columns_map[COLS] = {0U, 1U, 10U, 11U};
static const uint8_t rows_map[ROWS] = {12U, 13U, 14U, 15U};
#define KEYPAD_EXTI_MASK (EXTI_IMR_IM0 | EXTI_IMR_IM1 | EXTI_IMR_IM10 | EXTI_IMR_IM11)
#define KEYPAD_ROW_MASK (GPIO_ODR_ODR12_Msk | GPIO_ODR_ODR13_Msk | \
                         GPIO_ODR_ODR14_Msk | GPIO_ODR_ODR15_Msk)
const char keypad_map[ROWS][COLS] = {
        {'1','2','3','A'},
        {'4','5','6','B'},
        {'7','8','9','C'},
        {'F','0','E','D'}};




void AFIO_Config(void)
{
    AFIO->EXTICR[0] &= ~(AFIO_EXTICR1_EXTI0_Msk |
                         AFIO_EXTICR1_EXTI1_Msk);
    AFIO->EXTICR[2] = (AFIO->EXTICR[2] &
                       ~(AFIO_EXTICR3_EXTI10_Msk |
                         AFIO_EXTICR3_EXTI11_Msk)) |
                      AFIO_EXTICR3_EXTI10_PB |
                      AFIO_EXTICR3_EXTI11_PB;
}

void Keypad_ConfigGPIO()
{
    /* Configure PB12-PB15 as 2 MHz push-pull row outputs. */
    GPIOB->CRH = (GPIOB->CRH &
                  ~(GPIO_CRH_MODE12_Msk | GPIO_CRH_CNF12_Msk |
                    GPIO_CRH_MODE13_Msk | GPIO_CRH_CNF13_Msk |
                    GPIO_CRH_MODE14_Msk | GPIO_CRH_CNF14_Msk |
                    GPIO_CRH_MODE15_Msk | GPIO_CRH_CNF15_Msk)) |
                 GPIO_CRH_MODE12_1 | GPIO_CRH_MODE13_1 |
                 GPIO_CRH_MODE14_1 | GPIO_CRH_MODE15_1;

    /* Configure PA0, PA1, PB10 and PB11 as input with pull-ups. */
    GPIOA->CRL = (GPIOA->CRL &
                  ~(GPIO_CRL_MODE0_Msk | GPIO_CRL_CNF0_Msk |
                    GPIO_CRL_MODE1_Msk | GPIO_CRL_CNF1_Msk)) |
                 GPIO_CRL_CNF0_1 | GPIO_CRL_CNF1_1;
    GPIOB->CRH = (GPIOB->CRH &
                  ~(GPIO_CRH_MODE10_Msk | GPIO_CRH_CNF10_Msk |
                    GPIO_CRH_MODE11_Msk | GPIO_CRH_CNF11_Msk)) |
                 GPIO_CRH_CNF10_1 | GPIO_CRH_CNF11_1;

    GPIOA->ODR |= (GPIO_ODR_ODR0_Msk |
                   GPIO_ODR_ODR1_Msk);
    GPIOB->ODR |= (GPIO_ODR_ODR10_Msk |
                   GPIO_ODR_ODR11_Msk);
    GPIOB->BRR = KEYPAD_ROW_MASK;

}

void Keypad_ConfigEXTI()
{
    EXTI->IMR &= ~KEYPAD_EXTI_MASK;
    EXTI->RTSR &= ~(EXTI_RTSR_RT0 |
                    EXTI_RTSR_RT1 |
                    EXTI_RTSR_RT10 |
                    EXTI_RTSR_RT11);
    EXTI->FTSR |= (EXTI_FTSR_FT0 |
                   EXTI_FTSR_FT1 |
                   EXTI_FTSR_FT10 |
                   EXTI_FTSR_FT11);
    EXTI->PR = KEYPAD_EXTI_MASK;

    NVIC_EnableIRQ(EXTI0_IRQn);
    NVIC_EnableIRQ(EXTI1_IRQn);
    NVIC_EnableIRQ(EXTI15_10_IRQn);
    EXTI->IMR |= KEYPAD_EXTI_MASK;
}

void Keypad_SetEXTIEnabled(uint8_t enabled)
{
    if(enabled != 0U)
    {
        EXTI->PR = KEYPAD_EXTI_MASK;
        EXTI->IMR |= KEYPAD_EXTI_MASK;
    }
    else
    {
        EXTI->IMR &= ~KEYPAD_EXTI_MASK;
        EXTI->PR = KEYPAD_EXTI_MASK;
    }
}


static void Keypad_SetRowsHigh()
{
    GPIOB->BSRR = KEYPAD_ROW_MASK;
}

static void Keypad_SetRowsLow(uint8_t row)
{
    GPIOB->BRR = 1U << rows_map[row];
}

uint8_t Keypad_GetStatusColumns(uint8_t columns)
{
    if(columns < 2U)
    {
        return (GPIOA->IDR & (1U << columns_map[columns])) != 0U;
    }
    return (GPIOB->IDR & (1U << columns_map[columns])) != 0U;
}


char Keypad_Scan()
{
    char key = '\n';
    EXTI->IMR &= ~KEYPAD_EXTI_MASK;
    EXTI->PR = KEYPAD_EXTI_MASK;

    for(uint8_t row = 0U; row < ROWS && key == '\n'; row++)
    {
        Keypad_SetRowsHigh();
        Keypad_SetRowsLow(row);
        delay_ms(1);

        for(uint8_t column = 0U; column < COLS; column++)
        {
            if(!Keypad_GetStatusColumns(column))
            {
                key = keypad_map[row][column];
                break;
            }
        }
    }
    GPIOB->BRR = KEYPAD_ROW_MASK;
    EXTI->PR = KEYPAD_EXTI_MASK;
    EXTI->PR = KEYPAD_EXTI_MASK;

    return key;
}

uint8_t Keypad_IsReleased(void)
{
    return (GPIOA->IDR & (GPIO_IDR_IDR0_Msk | GPIO_IDR_IDR1_Msk)) ==
               (GPIO_IDR_IDR0_Msk | GPIO_IDR_IDR1_Msk) &&
           (GPIOB->IDR & (GPIO_IDR_IDR10_Msk | GPIO_IDR_IDR11_Msk)) ==
               (GPIO_IDR_IDR10_Msk | GPIO_IDR_IDR11_Msk);
}

void Config_Keypad()
{
    Keypad_ConfigGPIO();
    AFIO_Config();
    Keypad_ConfigEXTI();
}




void EXTI0_IRQHandler()
{
    if(EXTI->PR & (EXTI_PR_PR0_Msk))
    {
        EXTI->PR = EXTI_PR_PR0_Msk;
        keypad_wake_event = 1U;
    }
}

void EXTI1_IRQHandler()
{
    if(EXTI->PR & (EXTI_PR_PR1_Msk))
    {
        EXTI->PR = EXTI_PR_PR1_Msk;
        keypad_wake_event = 1U;
    }
}


void EXTI15_10_IRQHandler()
{
    uint32_t pending = EXTI->PR & (EXTI_PR_PR10_Msk | EXTI_PR_PR11_Msk);
    if(pending != 0U)
    {
        EXTI->PR = pending;
        keypad_wake_event = 1U;
    }
}
