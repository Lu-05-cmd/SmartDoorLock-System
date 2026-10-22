#ifndef STM32_REEDSWITCH_H
#define STM32_REEDSWITCH_H

#include "stm32f103xb.h"
#include "stdint.h"


void ReedSwitch_ConfigGPIO();
uint8_t ReedSwitch_GetStatus();

#endif /* STM32_REEDSWITCH_H */