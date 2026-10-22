PIO ?= pio
ESP32_PROJECT := esp32-camera
STM32_PROJECT := stm32-bluepill

.PHONY: help esp32-build esp32-debug esp32-upload esp32-monitor \
	stm32-build stm32-elf stm32-hex stm32-debug stm32-upload stm32-monitor

help:
	@echo "Targets:"
	@echo "  esp32-build    Build ESP32-CAM firmware"
	@echo "  esp32-debug    Start ESP32-CAM debug session"
	@echo "  esp32-upload   Upload firmware to ESP32-CAM"
	@echo "  esp32-monitor  Open ESP32-CAM serial monitor"
	@echo "  stm32-build    Build STM32F103C8T6 firmware"
	@echo "  stm32-elf      Build STM32F103C8T6 ELF firmware"
	@echo "  stm32-hex      Build STM32F103C8T6 HEX firmware"
	@echo "  stm32-debug    Start interactive STM32F103C8T6 GDB session via ST-Link"
	@echo "  stm32-upload   Upload firmware to STM32F103C8T6 via ST-Link"
	@echo "  stm32-monitor  Open STM32F103C8T6 serial monitor"

esp32-build:
	$(PIO) run -d $(ESP32_PROJECT)

esp32-debug:
	$(PIO) debug -d $(ESP32_PROJECT)

esp32-upload:
	$(PIO) run -d $(ESP32_PROJECT) -t upload

esp32-monitor:
	$(PIO) device monitor -d $(ESP32_PROJECT)

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

clean:
	rm -d $(STM32_PROJECT)/.pio/build/genericSTM32F103C8/firmware.elf 	\
		  $(STM32_PROJECT)/.pio/build/genericSTM32F103C8/firmware.bin	\
		  $(STM32_PROJECT)/.pio/build/genericSTM32F103C8/firmware.hex
