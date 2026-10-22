#ifndef STM32_OLED_H
#define STM32_OLED_H

#include <stdint.h>

uint8_t OLED_Init(void);
void OLED_DisplayPower(uint8_t enabled);
void OLED_ShowMessage(const char *message);
void OLED_ShowLines(const char *line1, const char *line2,
                    const char *line3, const char *line4);
void OLED_ShowActionScreen(const char *title, const char *content1,
                           const char *content2);
void OLED_ShowCenteredMessage(const char *message);
void OLED_ShowSystemMenu(uint8_t selected);
void OLED_ShowPinEntry(uint8_t digits_entered);
void OLED_ShowPinPrompt(const char *title, uint8_t digits_entered,
                        uint8_t show_admin_menu_hint);
void OLED_ShowEnrollCard(void);
void OLED_ShowRfidCard(const char *label, const char *uid);
void OLED_ShowRfidList(const char *last_uid);
void OLED_ShowSecurityAlert(void);
void OLED_ShowUnavailable(const char *feature);
void OLED_ShowUID(const uint8_t *uid, uint8_t uid_length);

#endif
