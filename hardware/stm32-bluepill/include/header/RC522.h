#ifndef STM32_RC522_H
#define STM32_RC522_H

#include <stdint.h>

uint8_t RC522_Init(void);
uint8_t RC522_GetVersion(void);
uint8_t RC522_ReadUID(uint8_t *uid, uint8_t *uid_length);

#endif