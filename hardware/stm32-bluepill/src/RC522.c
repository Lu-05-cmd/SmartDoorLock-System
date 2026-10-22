#include <stddef.h>
#include "stm32f103xb.h"
#include "../include/header/RC522.h"
#include "../include/header/delay.h"

#define RC522_CS_PIN  GPIO_ODR_ODR15_Msk
#define RC522_RST_PIN GPIO_ODR_ODR4_Msk

#define RC522_COMMAND_REG      0x01U
#define RC522_COM_IRQ_REG      0x04U
#define RC522_DIV_IRQ_REG      0x05U
#define RC522_ERROR_REG        0x06U
#define RC522_FIFO_DATA_REG    0x09U
#define RC522_FIFO_LEVEL_REG   0x0AU
#define RC522_CONTROL_REG      0x0CU
#define RC522_BIT_FRAMING_REG  0x0DU
#define RC522_MODE_REG         0x11U
#define RC522_TX_CONTROL_REG   0x14U
#define RC522_RX_CONFIG_REG    0x26U
#define RC522_TX_ASK_REG       0x15U
#define RC522_CRC_RESULT_H_REG 0x21U
#define RC522_CRC_RESULT_L_REG 0x22U
#define RC522_T_MODE_REG       0x2AU
#define RC522_T_PRESCALER_REG  0x2BU
#define RC522_T_RELOAD_H_REG   0x2CU
#define RC522_T_RELOAD_L_REG   0x2DU
#define RC522_VERSION_REG      0x37U

#define RC522_CMD_IDLE       0x00U
#define RC522_CMD_CALC_CRC   0x03U
#define RC522_CMD_TRANSCEIVE 0x0CU
#define RC522_CMD_SOFT_RESET 0x0FU

#define PICC_CMD_WUPA         0x52U
#define PICC_CMD_ANTICOLL_CL1 0x93U
#define PICC_CMD_ANTICOLL_CL2 0x95U
#define PICC_CMD_ANTICOLL_CL3 0x97U
#define PICC_CMD_SELECT       0x70U
#define PICC_CASCADE_TAG      0x88U

static uint8_t spi_error;

static uint8_t SPI1_Transfer(uint8_t value)
{
    uint32_t timeout = 20000U;
    while((SPI1->SR & SPI_SR_TXE) == 0U && timeout > 0U)
    {
        timeout--;
    }
    if(timeout == 0U)
    {
        spi_error = 1U;
        return 0xFFU;
    }

    *(__IO uint8_t *)&SPI1->DR = value;
    timeout = 20000U;
    while((SPI1->SR & SPI_SR_RXNE) == 0U && timeout > 0U)
    {
        timeout--;
    }
    if(timeout == 0U)
    {
        spi_error = 1U;
        return 0xFFU;
    }
    return *(__IO uint8_t *)&SPI1->DR;
}

static void RC522_WriteRegister(uint8_t reg, uint8_t value)
{
    GPIOA->BRR = RC522_CS_PIN;
    (void)SPI1_Transfer((uint8_t)((reg << 1U) & 0x7EU));
    (void)SPI1_Transfer(value);
    GPIOA->BSRR = RC522_CS_PIN;
}

static uint8_t RC522_ReadRegister(uint8_t reg)
{
    uint8_t value;
    GPIOA->BRR = RC522_CS_PIN;
    (void)SPI1_Transfer((uint8_t)(((reg << 1U) & 0x7EU) | 0x80U));
    value = SPI1_Transfer(0U);
    GPIOA->BSRR = RC522_CS_PIN;
    return value;
}

static uint8_t RC522_CalculateCRC(const uint8_t *data, uint8_t length,
                                  uint8_t *crc)
{
    uint32_t timeout = 20000U;
    RC522_WriteRegister(RC522_COMMAND_REG, RC522_CMD_IDLE);
    RC522_WriteRegister(RC522_DIV_IRQ_REG, 0x04U);
    RC522_WriteRegister(RC522_FIFO_LEVEL_REG, 0x80U);
    for(uint8_t i = 0U; i < length; i++)
    {
        RC522_WriteRegister(RC522_FIFO_DATA_REG, data[i]);
    }
    RC522_WriteRegister(RC522_COMMAND_REG, RC522_CMD_CALC_CRC);

    while((RC522_ReadRegister(RC522_DIV_IRQ_REG) & 0x04U) == 0U &&
          timeout > 0U)
    {
        timeout--;
    }
    RC522_WriteRegister(RC522_COMMAND_REG, RC522_CMD_IDLE);
    if(timeout == 0U)
    {
        return 0U;
    }

    crc[0] = RC522_ReadRegister(RC522_CRC_RESULT_L_REG);
    crc[1] = RC522_ReadRegister(RC522_CRC_RESULT_H_REG);
    return 1U;
}

static uint8_t RC522_Transceive(const uint8_t *tx, uint8_t tx_length,
                                uint8_t tx_last_bits, uint8_t *rx,
                                uint8_t *rx_length, uint8_t *rx_valid_bits)
{
    uint8_t irq;
    uint8_t fifo_length;
    uint32_t timeout = 20000U;

    RC522_WriteRegister(RC522_COMMAND_REG, RC522_CMD_IDLE);
    RC522_WriteRegister(RC522_COM_IRQ_REG, 0x7FU);
    RC522_WriteRegister(RC522_FIFO_LEVEL_REG, 0x80U);
    for(uint8_t i = 0U; i < tx_length; i++)
    {
        RC522_WriteRegister(RC522_FIFO_DATA_REG, tx[i]);
    }

    RC522_WriteRegister(RC522_BIT_FRAMING_REG, tx_last_bits);
    RC522_WriteRegister(RC522_COMMAND_REG, RC522_CMD_TRANSCEIVE);
    RC522_WriteRegister(RC522_BIT_FRAMING_REG,
                        (uint8_t)(tx_last_bits | 0x80U));

    do
    {
        irq = RC522_ReadRegister(RC522_COM_IRQ_REG);
        timeout--;
    } while((irq & 0x31U) == 0U && timeout > 0U);

    RC522_WriteRegister(RC522_BIT_FRAMING_REG, tx_last_bits);
    if(timeout == 0U || spi_error != 0U ||
       (RC522_ReadRegister(RC522_ERROR_REG) & 0x1BU) != 0U)
    {
        return 0U;
    }

    fifo_length = RC522_ReadRegister(RC522_FIFO_LEVEL_REG);
    if(fifo_length > *rx_length)
    {
        return 0U;
    }
    for(uint8_t i = 0U; i < fifo_length; i++)
    {
        rx[i] = RC522_ReadRegister(RC522_FIFO_DATA_REG);
    }

    *rx_length = fifo_length;
    *rx_valid_bits = (uint8_t)(RC522_ReadRegister(RC522_CONTROL_REG) & 0x07U);
    return (irq & 0x20U) != 0U;
}

static uint8_t RC522_SelectCascade(uint8_t cascade_command,
                                  const uint8_t cascade_data[5],
                                  uint8_t *sak)
{
    uint8_t frame[9];
    uint8_t response[3];
    uint8_t response_length = sizeof(response);
    uint8_t valid_bits = 0U;

    frame[0] = cascade_command;
    frame[1] = PICC_CMD_SELECT;
    for(uint8_t i = 0U; i < 5U; i++)
    {
        frame[i + 2U] = cascade_data[i];
    }
    if(!RC522_CalculateCRC(frame, 7U, &frame[7]) ||
       !RC522_Transceive(frame, sizeof(frame), 0U, response,
                         &response_length, &valid_bits) ||
       response_length != sizeof(response))
    {
        return 0U;
    }

    *sak = response[0];
    return 1U;
}

static uint8_t RC522_ReadCascade(uint8_t cascade_command, uint8_t *uid,
                                 uint8_t uid_length, uint8_t *sak)
{
    uint8_t request[2] = {cascade_command, 0x20U};
    uint8_t response[5];
    uint8_t response_length = sizeof(response);
    uint8_t valid_bits = 0U;

    if(!RC522_Transceive(request, sizeof(request), 0U, response,
                         &response_length, &valid_bits) ||
       response_length != sizeof(response) || valid_bits != 0U ||
       (uint8_t)(response[0] ^ response[1] ^ response[2] ^
                 response[3]) != response[4] ||
       !RC522_SelectCascade(cascade_command, response, sak))
    {
        return 0U;
    }

    if(response[0] == PICC_CASCADE_TAG)
    {
        if(uid_length > 7U)
        {
            return 0U;
        }
        uid[uid_length] = response[1];
        uid[uid_length + 1U] = response[2];
        uid[uid_length + 2U] = response[3];
        return 3U;
    }

    if(uid_length > 6U)
    {
        return 0U;
    }
    for(uint8_t i = 0U; i < 4U; i++)
    {
        uid[uid_length + i] = response[i];
    }
    return 4U;
}

uint8_t RC522_Init(void)
{
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN_Msk |
                    RCC_APB2ENR_IOPBEN_Msk |
                    RCC_APB2ENR_AFIOEN_Msk |
                    RCC_APB2ENR_SPI1EN_Msk;
    AFIO->MAPR = (AFIO->MAPR & ~AFIO_MAPR_SWJ_CFG_Msk) |
                 AFIO_MAPR_SPI1_REMAP |
                 AFIO_MAPR_SWJ_CFG_JTAGDISABLE;

    GPIOA->CRL = (GPIOA->CRL &
                  ~(GPIO_CRL_MODE4_Msk | GPIO_CRL_CNF4_Msk)) |
                 GPIO_CRL_MODE4_1;
    GPIOA->CRH = (GPIOA->CRH &
                  ~(GPIO_CRH_MODE15_Msk | GPIO_CRH_CNF15_Msk)) |
                 GPIO_CRH_MODE15_1;
    GPIOB->CRL = (GPIOB->CRL &
                  ~(GPIO_CRL_MODE0_Msk | GPIO_CRL_CNF0_Msk |
                    GPIO_CRL_MODE3_Msk | GPIO_CRL_CNF3_Msk |
                    GPIO_CRL_MODE4_Msk | GPIO_CRL_CNF4_Msk |
                    GPIO_CRL_MODE5_Msk | GPIO_CRL_CNF5_Msk)) |
                 GPIO_CRL_CNF0_1 |
                 GPIO_CRL_MODE3 | GPIO_CRL_CNF3_1 |
                 GPIO_CRL_CNF4_0 |
                 GPIO_CRL_MODE5 | GPIO_CRL_CNF5_1;

    GPIOA->BSRR = RC522_CS_PIN | RC522_RST_PIN;
    SPI1->CR1 = SPI_CR1_MSTR | SPI_CR1_SSM | SPI_CR1_SSI | SPI_CR1_BR_2;
    SPI1->CR2 = 0U;
    SPI1->CR1 |= SPI_CR1_SPE;

    GPIOA->BRR = RC522_RST_PIN;
    delay_ms(2U);
    GPIOA->BSRR = RC522_RST_PIN;
    delay_ms(50U);
    RC522_WriteRegister(RC522_COMMAND_REG, RC522_CMD_SOFT_RESET);
    delay_ms(50U);

    uint8_t version = RC522_GetVersion();
    if(spi_error != 0U || version == 0U || version == 0xFFU)
    {
        return 0U;
    }

    RC522_WriteRegister(RC522_T_MODE_REG, 0x8DU);
    RC522_WriteRegister(RC522_T_PRESCALER_REG, 0x3EU);
    RC522_WriteRegister(RC522_T_RELOAD_H_REG, 0U);
    RC522_WriteRegister(RC522_T_RELOAD_L_REG, 30U);
    RC522_WriteRegister(RC522_TX_ASK_REG, 0x40U);
    RC522_WriteRegister(RC522_MODE_REG, 0x3DU);
    RC522_WriteRegister(RC522_RX_CONFIG_REG, 0x70U);

    uint8_t antenna = RC522_ReadRegister(RC522_TX_CONTROL_REG);
    if((antenna & 0x03U) != 0x03U)
    {
        RC522_WriteRegister(RC522_TX_CONTROL_REG, (uint8_t)(antenna | 0x03U));
    }
    return 1U;
}

uint8_t RC522_GetVersion(void)
{
    return RC522_ReadRegister(RC522_VERSION_REG);
}

uint8_t RC522_ReadUID(uint8_t *uid, uint8_t *uid_length)
{
    uint8_t request = PICC_CMD_WUPA;
    uint8_t response[2];
    uint8_t response_length = sizeof(response);
    uint8_t valid_bits = 0U;
    uint8_t sak = 0U;
    uint8_t count;

    if(uid == NULL || uid_length == NULL)
    {
        return 0U;
    }
    spi_error = 0U;
    *uid_length = 0U;

    if(!RC522_Transceive(&request, 1U, 7U, response,
                         &response_length, &valid_bits) ||
       response_length != sizeof(response))
    {
        return 0U;
    }

    count = RC522_ReadCascade(PICC_CMD_ANTICOLL_CL1, uid, 0U, &sak);
    if(count == 0U)
    {
        return 0U;
    }
    *uid_length = count;

    if((sak & 0x04U) != 0U)
    {
        count = RC522_ReadCascade(PICC_CMD_ANTICOLL_CL2, uid,
                                  *uid_length, &sak);
        if(count == 0U)
        {
            *uid_length = 0U;
            return 0U;
        }
        *uid_length = (uint8_t)(*uid_length + count);
    }
    if((sak & 0x04U) != 0U)
    {
        count = RC522_ReadCascade(PICC_CMD_ANTICOLL_CL3, uid,
                                  *uid_length, &sak);
        if(count == 0U)
        {
            *uid_length = 0U;
            return 0U;
        }
        *uid_length = (uint8_t)(*uid_length + count);
    }

    return 1U;
}
