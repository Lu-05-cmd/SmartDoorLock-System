#include "../include/header/ReedSwtich.h"


void ReedSwitch_ConfigGPIO()
{
    GPIOA->CRH = (GPIOA->CRH &
                  ~(GPIO_CRH_MODE8_Msk | GPIO_CRH_CNF8_Msk)) |
                 GPIO_CRH_CNF8_1;
    GPIOA->ODR |= GPIO_ODR_ODR8_Msk;
}

uint8_t ReedSwitch_GetStatus()
{
    return (GPIOA->IDR & GPIO_IDR_IDR8_Msk) != 0U;
}