# Phần cứng và firmware

Thư mục này chứa các project firmware PlatformIO, cấu hình build/debug/nạp dùng chung và sơ đồ phần cứng. ESP32-CAM và STM32 là hai project độc lập; firmware STM32 điều khiển OLED, keypad, RC522 và servo, không thay thế chức năng nhận diện khuôn mặt của ESP32-CAM.

## Cấu trúc

```text
hardware/
  Makefile
  README.md
  assets/
    Circuit.fzz
    Circuit.jpg
    Face Recognition Door Lock Architecture.png
  esp32-camera/
    platformio.ini
    include/
      camera_index.h
      camera_pins.h
      secrets.h.example
    src/
      main.cpp
  stm32-bluepill/
    platformio.ini
    src/
      main.cpp
```

## Công cụ cần thiết

- PlatformIO Core (lệnh `pio`) hoặc PlatformIO IDE extension cho VS Code.
- GNU Make để gọi các lệnh rút gọn trong Makefile.
- Windows: chạy `make` trong MSYS2 hoặc Git Bash. Nếu dùng PowerShell thuần, có thể gọi `pio` trực tiếp như các ví dụ bên dưới.
- Phần cứng tương ứng và driver/cáp nạp phù hợp để upload hoặc debug.

Hai project ESP32 và STM32 ở đây được quản lý bằng PlatformIO, không cần chọn CMake generator trong VS Code. `CMakeLists.txt` của ESP32-CAM được ESP-IDF/PlatformIO sử dụng khi build firmware; không mở riêng file này bằng CMake Tools. Cấu hình workspace đã tắt tự động cấu hình CMake cho các thư mục board.

Kiểm tra các công cụ đã sẵn sàng:

```powershell
pio --version
make --version
```

## ESP32 DevKit + OV2640

Project tại `hardware/esp32-camera/` dùng framework ESP-IDF native, ESP-WHO/ESP-DL nhánh tương thích IDF 4.4 và camera OV2640 rời. Board mục tiêu là ESP32 classic, flash 4 MB và PSRAM; không phải board AI Thinker ESP32-CAM. ESP-WHO và các thư viện con được ghim trong Git submodule `esp-who`.

### Chuẩn bị cấu hình riêng

Tạo cấu hình cục bộ từ template:

```powershell
Copy-Item hardware/esp32-camera/include/secrets.h.example hardware/esp32-camera/include/secrets.h
```

Điền Wi-Fi, địa chỉ local API, API token và device ID vào `hardware/esp32-camera/include/secrets.h`. File này chỉ có trên máy phát triển và không được commit. Khi chưa cấu hình local API, nhận diện khuôn mặt sẽ không mở relay (fail-closed).

### Pinout OV2640

Firmware dùng pinout của module camera rời do dự án cung cấp:

| Tín hiệu | GPIO ESP32 |
| --- | ---: |
| XCLK | 4 |
| SIOD / SIOC | 21 / 22 |
| D0–D7 (Y2–Y9) | 32, 36, 33, 39, 26, 34, 14, 35 |
| VSYNC / HREF / PCLK | 25 / 23 / 27 |
| PWDN / RESET | Không nối / nối EN |

Đảm bảo dây camera đúng với bảng trên và module PSRAM đã hoạt động. Relay vẫn dùng GPIO2, active-low; khi khởi động relay được đặt ở trạng thái khóa.

### Build, nạp và monitor

Chạy từ thư mục gốc repository:

```powershell
pio run -d hardware\esp32-camera
pio run -d hardware\esp32-camera -t upload
pio device monitor -d hardware\esp32-camera
```

PlatformIO sẽ cài ESP-IDF 4.4.7 được cấu hình trong `platformio.ini` nếu package chưa có, rồi build firmware native. Board USB-UART CH340 có thể nạp trực tiếp qua USB-C; nếu không tự nhận cổng, đặt `upload_port = COMx` trong `[env:esp32cam]`. Serial Monitor chạy ở `115200` baud.

Trên Windows này, lệnh `pio` đang dùng Python 3.14 thiếu `pkg_resources`, mà ESP-IDF builder cần. Dùng Python của PlatformIO đã có sẵn để build/nạp/monitor:

```powershell
$pioPython = Join-Path $env:USERPROFILE '.platformio\penv\Scripts\python.exe'
& $pioPython -m platformio run -d hardware\esp32-camera
& $pioPython -m platformio run -d hardware\esp32-camera -t upload
& $pioPython -m platformio device monitor -d hardware\esp32-camera
```

Giao thức WebSocket tương thích với ứng dụng trên cổng 82: `stream`, `detect`, `capture:<faceId>`, `recognise`, `remove:<faceId>` và `delete_all`. Đăng ký yêu cầu 5 khung hình có đúng một khuôn mặt; firmware lấy trung bình embedding rồi lưu một face ID trong partition `fr`, tối đa 7 ID. Nhận diện chạy tự động; `stream` đồng thời bật preview WebSocket. Cổng HTTP 80 cung cấp trang trạng thái và endpoint JSON `/status`.

Để mở khóa, firmware gửi yêu cầu xác thực tới `/api/v1/face/authorize`; relay chỉ kích hoạt khi local API trả quyết định được phép. Heartbeat và sự kiện đăng ký/nhận diện được gửi tới local API. Camera, Wi-Fi, nhận diện và relay vẫn cần được kiểm tra trên bo mạch thực tế sau khi build/nạp.

## STM32F103C8T6 Blue Pill

Project tại `hardware/stm32-bluepill/` dùng board `genericSTM32F103C8` và framework CMSIS. Cấu hình build kiểu debug giữ symbol và thông tin dòng nguồn trong ELF để đặt breakpoint.

Cấu hình dùng ST-Link cho nạp và debug. Nối SWDIO với PA13, SWCLK với PA14, GND chung và chân tham chiếu điện áp 3.3 V của ST-Link với board trước khi chạy:

```powershell
make -C hardware stm32-build
make -C hardware stm32-elf
make -C hardware stm32-hex
make -C hardware stm32-upload
make -C hardware stm32-debug
```

Target `stm32-elf` tạo firmware ELF và `stm32-hex` chuyển ELF sang Intel HEX. Các file được đặt trong `hardware/stm32-bluepill/.pio/build/genericSTM32F103C8/` với tên `firmware.elf` và `firmware.hex`.

Target `stm32-debug` build firmware ở chế độ debug rồi mở phiên GDB tương tác qua ST-Link; `pio debug` không có `--interface gdb` chỉ build firmware và thoát, không khởi động debugger. Phiên debug dừng lần đầu tại `main`. Nhập lệnh GDB như `break src/main.c:12` để đặt breakpoint theo dòng nguồn, sau đó `continue` để chạy tới breakpoint. Breakpoint cần debugger kết nối ST-Link và firmware chạy đúng ELF vừa build. Gõ `quit` để đóng phiên.

Để debug bằng giao diện VS Code, mở thư mục gốc repository, chọn cấu hình **STM32 Blue Pill (ST-Link)** trong Run and Debug rồi nhấn `F5`. Mở file trong `hardware/stm32-bluepill/src/`, nhấp lề trái cạnh số dòng để đặt breakpoint; VS Code sẽ build/nạp firmware và dừng tại breakpoint khi chạy. Không nhập lệnh breakpoint trong terminal GDB. Cấu hình dùng PlatformIO IDE extension và ST-Link.

### RFID RC522 và OLED I2C

Firmware STM32 đọc UID thẻ RC522 qua SPI1 remap và hiển thị UID trên OLED I2C 128x64 SSD1306. Đấu dây:

| Module | Chân STM32 |
| --- | --- |
| RC522 SDA/SS | PA15 |
| RC522 SCK | PB3 |
| RC522 MOSI | PB5 |
| RC522 MISO | PB4 |
| RC522 IRQ | PB0 (không dùng để đánh thức; firmware polling định kỳ) |
| RC522 RST | PA4 |
| OLED SCL | PB8 |
| OLED SDA | PB9 |
| Reed switch signal | PA8 |
| MG996R signal | PA7 (TIM3_CH2) |

RC522 và OLED dùng nguồn tương thích 3.3 V, nối chung GND với STM32. Chân `SDA` trên module RC522 là **CS/SS của SPI**, không phải SDA I2C. OLED tự dò địa chỉ I2C `0x3C` hoặc `0x3D`; firmware mặc định giả định màn SSD1306 128x64. SPI1 remap chiếm PA15/PB3/PB4/PB5, nên firmware tắt JTAG nhưng giữ SWD để ST-Link tiếp tục debug. PB5 không còn dùng cho Reed switch; chuyển dây reed sang PA8.

RC522 được cấu hình SPI mode 0, tốc độ thấp để hỗ trợ dây jumper. Khi khởi động lỗi, OLED hiện `VERSION: xx`: giá trị `00`/`FF` thường có nghĩa là STM32 không đọc được RC522 qua SPI (kiểm tra CS/SS=PA15, SCK=PB3, MOSI=PB5, MISO=PB4, RST=PA4, nguồn 3.3 V và GND). Version thường gặp là `91`/`92`; một số clone trả mã khác. Tần số 13.56 MHz một mình chưa đảm bảo tương thích: RC522 đọc thẻ ISO14443A/MIFARE được hỗ trợ, không đọc mọi loại NFC 13.56 MHz.

Lần chạy đầu, quét thẻ admin, sau đó tạo và xác nhận PIN admin 6 số rồi PIN mở cửa 6 số khác. Cấu hình (UID tối đa 10 thẻ và hai PIN đã băm) được lưu vào trang cuối của flash STM32. Màn hình chính chỉ hiện tiêu đề `PIN` và dòng nhập mã; nhập số trực tiếp hoặc nhấn `A` rồi nhập PIN. PIN mở cửa hợp lệ hoặc thẻ đã đăng ký sẽ mở servo trong 10 giây; thẻ lạ bị từ chối. PIN admin vào menu, PIN mở cửa chỉ mở servo. Trong menu, `1` thêm thẻ, `2` xem danh sách UID, `3` đổi PIN admin, `4` đổi PIN mở cửa, `5` thoát; `2`/`8` di chuyển, `D` chọn/xác nhận, `A` xóa một số PIN và `B` quay lại. Các cấu hình cũ vẫn giữ thẻ và PIN admin; admin cần đặt PIN mở cửa riêng trong menu. OLED ưu tiên nội dung chính, không hiển thị hướng dẫn phím hoặc đường kẻ phân cách.

Sau 30 giây không thao tác, OLED tắt. MCU dùng `WFI` ngắn và thức định kỳ để polling RFID; phím keypad cũng đánh thức ngay. RC522 không được cấu hình để đánh thức MCU đang ngủ sâu khi có thẻ, vì vậy IRQ PB0 hiện không được dùng làm nguồn wake-up. MG996R cần nguồn ngoài 5–6 V đủ dòng khởi động/stall; không cấp nguồn servo từ STM32, và phải nối chung GND với STM32. Firmware cấu hình TIM3_CH2 trên PA7 thành PWM 50 Hz, tự tính prescaler từ clock APB1 để giữ chu kỳ 20 ms; độ rộng xung mặc định khoảng 0.5 ms ở góc khóa và 2.5 ms ở góc mở. Dải xung này thay đổi theo servo: thử khi chưa gắn cơ cấu cửa, hiệu chỉnh `SERVO_MIN_PULSE_US`/`SERVO_MAX_PULSE_US` và góc để tránh ép servo vào chặn cơ khí.

Đây là prototype: UID RFID có thể bị sao chép và băm PIN 6 số không thay thế bộ điều khiển truy cập đã được chứng nhận. Không dùng làm khóa bảo vệ an toàn/tài sản nếu chưa bổ sung xác thực phần cứng phù hợp, kiểm tra nguồn/servo và thử nghiệm fail-safe trên mạch thực.

Có thể chạy PlatformIO trực tiếp:

```powershell
pio run -d hardware/stm32-bluepill
pio run -d hardware/stm32-bluepill -t upload
pio debug -d hardware/stm32-bluepill --interface gdb
```

Serial Monitor mặc định ở `115200` baud và cần một adapter USB-to-UART nối với UART đã chọn trên board:

```powershell
make -C hardware stm32-monitor
```

Nếu máy có nhiều cổng serial, đặt `monitor_port = COMx` trong `[env:bluepill]` của `platformio.ini`.

## Makefile

Makefile nằm ngay trong `hardware/`, mỗi target chỉ thao tác trên một project để tránh build hoặc nạp nhầm board:

| Target | Tác vụ |
| --- | --- |
| `esp32-build`, `esp32-upload`, `esp32-debug`, `esp32-monitor` | Build, nạp, debug hoặc mở serial monitor ESP32-CAM |
| `stm32-build`, `stm32-elf`, `stm32-hex`, `stm32-upload`, `stm32-debug`, `stm32-monitor` | Build firmware, tạo file ELF/HEX, nạp, debug hoặc mở serial monitor STM32 Blue Pill |
| `help` | Liệt kê các target |

Ví dụ xem trợ giúp:

```powershell
make -C hardware help
```

## Tài liệu phần cứng

- [Sơ đồ mạch (JPG)](assets/Circuit.jpg)
- [Sơ đồ mạch gốc (Fritzing)](assets/Circuit.fzz)
- [Sơ đồ kiến trúc hệ thống](assets/Face%20Recognition%20Door%20Lock%20Architecture.png)

## An toàn và giới hạn

- Đây là dự án prototype. Kiểm tra điện áp, dòng tải, cực tính và cách ly relay trước khi đấu khóa điện.
- Không cấp tải khóa trực tiếp từ chân GPIO hoặc nguồn yếu của board; dùng nguồn và tầng relay phù hợp với thông số thiết bị.
- Firmware ESP32 hiện điều khiển relay bằng GPIO2; kiểm tra sơ đồ và cấu hình board trước khi nối phần cứng thực tế.
- HTTP và WebSocket hiện không mã hóa, chỉ nên dùng trong mạng LAN tin cậy.
- Không dùng firmware mẫu hoặc mạch chưa được kiểm định làm hệ thống kiểm soát ra vào an toàn.
