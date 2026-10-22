#include "stm32f103xb.h"
#include "../include/header/delay.h"

void delay_init(void)
{
    /* Stop timer */
    TIM2->CR1 = 0;

    /* Timer clock = 72 MHz
       Prescaler = 72 - 1
       Counter clock = 1 MHz => 1 count = 1 us
    */
    TIM2->PSC = 72 - 1;
    TIM2->ARR = 0xFFFF;

    /* Load prescaler and reset counter */
    TIM2->EGR = TIM_EGR_UG;
    TIM2->SR = 0;
    TIM2->CNT = 0;

    /* Enable counter */
    TIM2->CR1 |= TIM_CR1_CEN;
}

void delay_us(uint16_t us)
{
    TIM2->CNT = 0;

    while (TIM2->CNT < us)
    {
        /* Wait for timer */
    }
}

void delay_ms(uint32_t ms)
{
    while (ms > 0)
    {
        delay_us(1000);
        ms--;
    }
}