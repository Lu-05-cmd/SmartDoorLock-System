#ifndef STM32_BLUEPIPP_BUTTON
#define STM32_BLUEPIPP_BUTTON

#include <stdint.h>
#include "stm32f103xb.h"


#define ROWS 4
#define COLS 4

extern volatile uint8_t keypad_wake_event;
extern const char keypad_map[ROWS][COLS];


void Keypad_ConfigGPIO();
void Keypad_ConfigEXTI();
void AFIO_Config(void);
void Keypad_SetEXTIEnabled(uint8_t enabled);
char Keypad_Scan();
uint8_t Keypad_IsReleased(void);
void Config_Keypad();

#endif  /* STM32_BLUEPIPP_BUTTON */