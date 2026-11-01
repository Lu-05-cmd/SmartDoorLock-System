# Phần cứng STM32 Blue Pill

Tài liệu này hướng dẫn build, nạp, debug và kết nối phần cứng cho firmware khóa cửa chạy trên board STM32F103C8T6 Blue Pill.

## Cấu trúc project

```text
hardware/
  Makefile
  README.md
  stm32-bluepill/
    platformio.ini
    src/
      main.c
      keypad.c
      RC522.c
      OLED.c
      delay.c
```

## Công cụ cần thiết

- PlatformIO Core (`pio`) hoặc PlatformIO IDE extension cho VS Code.
- GNU Make để dùng các lệnh rút gọn trong Makefile.
- ST-Link để nạp và debug qua giao tiếp SWD.
- USB-to-UART adapter nếu cần dùng Serial Monitor.

Kiểm tra công cụ:

```powershell
pio --version
make --version
```

## Board và firmware

Project tại `hardware/stm32-bluepill/` dùng PlatformIO, board `genericSTM32F103C8` và framework CMSIS. Firmware được build ở chế độ debug để giữ symbol và thông tin dòng nguồn trong ELF.

### Build, tạo file firmware và nạp

Chạy từ thư mục gốc repository:

```powershell
make -C hardware stm32-build
make -C hardware stm32-elf
make -C hardware stm32-hex
make -C hardware stm32-upload
```

Các file `firmware.elf` và `firmware.hex` nằm trong `hardware/stm32-bluepill/.pio/build/genericSTM32F103C8/`. Target `stm32-hex` chuyển ELF thành Intel HEX.

Project cấu hình ST-Link làm công cụ nạp. Nối SWDIO với PA13, SWCLK với PA14, GND chung và chân tham chiếu 3.3 V của ST-Link với board. Mỗi lần upload firmware, cấu hình PIN/RFID trong trang flash dành riêng sẽ bị xóa; sau khi nạp cần thiết lập lại PIN và thẻ.

### Debug

```powershell
make -C hardware stm32-debug
```

Target này build firmware ở chế độ debug rồi mở phiên GDB tương tác qua ST-Link. Phiên debug dừng lần đầu tại `main`; có thể nhập `break src/main.c:12`, sau đó `continue` để chạy tới breakpoint. Gõ `quit` để kết thúc phiên. Cũng có thể mở thư mục gốc trong VS Code, chọn cấu hình **STM32 Blue Pill (ST-Link)** ở Run and Debug rồi nhấn `F5`.

### Serial Monitor

```powershell
make -C hardware stm32-monitor
```

Monitor mặc định dùng tốc độ `115200` baud. Nếu máy có nhiều cổng serial, đặt `monitor_port = COMx` trong `hardware/stm32-bluepill/platformio.ini`.

## Kết nối ngoại vi

| Module / tín hiệu | Chân STM32 |
| --- | --- |
| RC522 SDA/SS | PA15 |
| RC522 SCK | PB3 |
| RC522 MOSI | PB5 |
| RC522 MISO | PB4 |
| RC522 IRQ | PB0 (firmware polling, không dùng để đánh thức MCU) |
| RC522 RST | PA4 |
| OLED SCL | PB8 |
| OLED SDA | PB9 |
| Servo MG996R signal | PA7 (TIM3_CH2) |
| Keypad columns | PA0, PA1, PB10, PB11 |
| Keypad rows | PB12–PB15 |

RC522 và OLED cần nguồn tương thích 3.3 V, cùng GND với STM32. Chân `SDA` trên module RC522 là CS/SS của SPI, không phải SDA I²C. OLED dùng SSD1306 128×64 và firmware tự dò địa chỉ I²C `0x3C` hoặc `0x3D`.

SPI1 remap sử dụng PA15/PB3/PB4/PB5. Firmware tắt JTAG nhưng giữ SWD để ST-Link tiếp tục debug.

## Luồng sử dụng

1. Sau khi nạp firmware, tạo và xác nhận PIN admin 6 chữ số rồi PIN mở cửa 6 chữ số khác. Hai PIN không được trùng nhau.
2. Ở màn hình chính, nhập PIN cửa rồi nhấn `D` để mở servo. Thẻ RFID đã đăng ký cũng mở cửa; thẻ lạ bị từ chối.
3. Nhấn `C`, nhập PIN admin và nhấn `D` để vào menu quản trị.
4. Trong menu, nhấn `1` để thêm thẻ, `2` xem danh sách UID, `3` đổi PIN admin, `4` đổi PIN cửa, `5` thoát. Dùng `2`/`8` để di chuyển, `D` để chọn, `A` xóa một chữ số PIN và `B` quay lại.
5. Tối đa 10 UID RFID được lưu. PIN được băm trước khi lưu trong flash.
6. Sau 30 giây không thao tác, OLED tắt. Keypad đánh thức giao diện; firmware polling RFID định kỳ và xử lý lại thẻ sau khi thẻ rời vùng đọc.

## Servo và nguồn

MG996R cần nguồn ngoài 5–6 V đủ dòng khởi động/stall; không cấp nguồn servo từ chân 3.3 V hoặc nguồn yếu của STM32. Nối chung GND giữa nguồn servo và STM32. Firmware tạo PWM 50 Hz trên PA7, với độ rộng xung mặc định khoảng 0.5 ms ở góc khóa và 2.5 ms ở góc mở; các giá trị này phụ thuộc từng servo.

Thử servo khi chưa gắn cơ cấu cửa, hiệu chỉnh `SERVO_MIN_PULSE_US`/`SERVO_MAX_PULSE_US` và góc quay để tránh ép servo vào chặn cơ khí. Firmware giữ trạng thái mở khoảng 10 giây rồi đưa servo về góc khóa.

## Xử lý sự cố RC522

OLED hiển thị `VERSION: xx` khi khởi tạo RC522. Giá trị `00` hoặc `FF` thường cho biết STM32 không đọc được module qua SPI. Kiểm tra CS/SS=PA15, SCK=PB3, MOSI=PB5, MISO=PB4, RST=PA4, nguồn 3.3 V và GND. RC522 thường trả version `91` hoặc `92`; một số module clone có thể khác. RC522 đọc các thẻ ISO14443A/MIFARE được hỗ trợ, không phải mọi loại NFC 13.56 MHz.

## Giới hạn và an toàn

- Đây là firmware prototype, chưa phải hệ thống kiểm soát truy cập được chứng nhận.
- UID RFID có thể bị sao chép; PIN 6 chữ số và cách lưu hiện tại không thay thế phần cứng xác thực an toàn.
- Reed switch không được firmware hiện tại hỗ trợ.
- Kiểm tra nguồn, dòng tải và cơ cấu servo trước khi lắp lên cửa. Không sử dụng cho cửa thoát hiểm hoặc nơi cần bảo vệ an toàn/tài sản nếu chưa được đánh giá phù hợp.
