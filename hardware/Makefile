PIO ?= pio
STM32_PROJECT := stm32-bluepill

.PHONY: help stm32-build stm32-elf stm32-hex stm32-debug stm32-upload stm32-monitor

help:
	@echo "Targets:"
	@echo "  stm32-build    Build STM32F103C8T6 firmware"
	@echo "  stm32-elf      Build STM32F103C8T6 ELF firmware"
	@echo "  stm32-hex      Build STM32F103C8T6 HEX firmware"
	@echo "  stm32-debug    Start interactive STM32F103C8T6 GDB session via ST-Link"
	@echo "  stm32-upload   Upload firmware to STM32F103C8T6 via ST-Link"
	@echo "  stm32-monitor  Open STM32F103C8T6 serial monitor"

stm32-build:
	$(PIO) run -d $(STM32_PROJECT)

stm32-elf: stm32-build

stm32-hex: stm32-build
	$(PIO) pkg exec -p toolchain-gccarmnoneeabi -- arm-none-eabi-objcopy \
		-O ihex $(STM32_PROJECT)/.pio/build/genericSTM32F103C8/firmware.elf \
		$(STM32_PROJECT)/.pio/build/genericSTM32F103C8/firmware.hex

stm32-debug:
	$(PIO) debug -d $(STM32_PROJECT) --interface gdb

stm32-upload:
	$(PIO) run -d $(STM32_PROJECT) -t upload

stm32-monitor:
	$(PIO) device monitor -d $(STM32_PROJECT)
