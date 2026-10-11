# SmartDoorLock System

Dự án khóa cửa thông minh sử dụng nhận diện khuôn mặt trên ESP32-CAM, tích hợp với ứng dụng Android/WebView và API nội bộ để quản lý thiết bị và sự kiện trong mạng LAN.

## Tổng quan

SmartDoorLock System là một dự án cá nhân nhằm thử nghiệm giải pháp khóa cửa thông minh với các thành phần chính:

- ESP32-CAM xử lý nhận diện khuôn mặt và điều khiển relay khóa cửa
- Ứng dụng Android/WebView hiển thị giao diện điều khiển và trạng thái cửa
- API Python cục bộ theo dõi thiết bị, heartbeat và sự kiện
- Demo webcam trên laptop để kiểm tra luồng nhận diện bằng OpenCV/LBPH mà không cần phần cứng thực

Điểm nổi bật của hệ thống là nhận diện và quyết định mở khóa được thực hiện trực tiếp trên thiết bị nhúng, không gửi ảnh hoặc dữ liệu sinh trắc học lên dịch vụ đám mây.

## Tính năng chính

- Nhận diện khuôn mặt trên ESP32-CAM
- Đăng ký và lưu mẫu khuôn mặt trực tiếp trên flash của camera
- Điều khiển relay khóa cửa tự động sau thời gian giới hạn
- Theo dõi thiết bị và sự kiện qua API local SQLite bridge
- Giao diện web Android/WebView hỗ trợ login, dashboard, activity, settings
- Hỗ trợ đa ngôn ngữ: Tiếng Việt và English
- Demo trên webcam laptop để kiểm tra nhận diện mà không cần camera thật

## Kiến trúc hệ thống

```text
ESP32-CAM ──> Nhận diện khuôn mặt ──> Điều khiển relay
   │
   └── HTTP heartbeat + event metadata ──> Local API (Python + SQLite)
                                             │
                                             ├── Android/WebView app
                                             └── Management UI / local monitor
```

## Cấu trúc repository

```text
app/                         Ứng dụng Android / WebView
hardware/
  Makefile                   Lệnh build/debug/nạp riêng từng board
  esp32-camera/               PlatformIO project cho ESP32-CAM
  stm32-bluepill/             PlatformIO project cho STM32F103C8T6
hardware/assets/            Sơ đồ mạch, ảnh kiến trúc và tài liệu phần cứng
tools/local-api/            Local API + SQLite bridge
tools/laptop-demo/          Demo webcam trên laptop
LICENSE                     MIT License
README.md                   Tài liệu dự án
```

## Phần cứng đề xuất

- ESP32-CAM AI Thinker
- Camera OV2640
- Module relay
- Khóa điện và nguồn cung cấp phù hợp
- USB-to-TTL để nạp firmware

Sơ đồ và tài liệu liên quan:

- [Circuit.jpg](hardware/assets/Circuit.jpg)
- [Circuit.fzz](hardware/assets/Circuit.fzz)
- [Face Recognition Door Lock Architecture.png](hardware/assets/Face%20Recognition%20Door%20Lock%20Architecture.png)

## Khởi chạy nhanh

### 1) Cấu hình firmware ESP32-CAM

1. Cài PlatformIO Core hoặc PlatformIO IDE extension cho VS Code. Để dùng `Makefile` trên Windows, cài GNU Make (ví dụ qua MSYS2 hoặc Git Bash) và chạy lệnh từ thư mục `hardware/`.
2. Sao chép file cấu hình mẫu:

```powershell
Copy-Item hardware/esp32-camera/include/secrets.h.example hardware/esp32-camera/include/secrets.h
```

3. Chỉnh sửa `hardware/esp32-camera/include/secrets.h` và điền thông tin Wi-Fi, API token và địa chỉ API local.
4. Dùng `Makefile` trong `hardware/` để build riêng firmware ESP32-CAM:

```powershell
make -C hardware esp32-build
```

5. Kết nối USB-to-TTL, sau đó nạp firmware:

```powershell
make -C hardware esp32-upload
```

Nếu PlatformIO không tự nhận cổng serial, thêm `upload_port = COMx` vào môi trường `[env:esp32cam]` trong `platformio.ini`.
Mở Serial Monitor ở baud `115200` để kiểm tra địa chỉ IP:

```powershell
make -C hardware esp32-monitor
```

### 2) Build/debug/nạp STM32 Blue Pill

`hardware/stm32-bluepill/` là PlatformIO project riêng cho STM32F103C8T6, độc lập với firmware ESP32. Firmware mẫu nháy LED tích hợp trên board. Cấu hình mặc định dùng ST-Link cho debug và nạp; kết nối ST-Link trước khi chạy hai lệnh tương ứng.

```powershell
make -C hardware stm32-build
make -C hardware stm32-debug
make -C hardware stm32-upload
```

Để mở serial monitor của STM32 (cần kết nối UART-to-USB phù hợp):

```powershell
make -C hardware stm32-monitor
```

Các lệnh `esp32-*` và `stm32-*` chọn project độc lập; xem toàn bộ target bằng `make -C hardware help`.

### 3) Chạy local API

Tham khảo hướng dẫn chi tiết tại [tools/local-api/README.md](tools/local-api/README.md).

Ví dụ:

```powershell
$token = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$env:SMARTDOOR_API_TOKEN = $token
python tools/local-api/server.py
```

API mặc định lắng nghe trên `0.0.0.0:8766` và lưu dữ liệu SQLite tại `tools/local-api/smartdoor.sqlite3`.

### 4) Build ứng dụng Android

Mở thư mục `app/` bằng Android Studio hoặc build bằng Gradle:

```powershell
gradle --no-daemon -p app assembleDebug
```

APK debug sẽ nằm ở:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Chạy giao diện trên mạng LAN không cần APK

Bạn có thể mở giao diện web trên điện thoại hoặc máy tính cùng mạng Wi-Fi mà không cần build APK.

### Bước 1: khởi động server preview

```powershell
python -m http.server 8001 --bind 0.0.0.0 --directory app/src/main/assets
```

Sau đó, mở trên máy tính:

```text
http://127.0.0.1:8001/
```

Trên điện thoại cùng mạng Wi-Fi, truy cập theo dạng:

```text
http://<ip-laptop>:8001/login.html
```

Ví dụ:

```text
http://192.168.1.135:8001/login.html
```

Lưu ý:

- Cần đặt IP tĩnh hoặc reservation cho laptop trong router để giữ địa chỉ ổn định
- Máy tính và điện thoại phải cùng mạng LAN
- Windows Firewall cần cho phép Python truy cập mạng Private
- Đây là giao diện preview thử nghiệm trên LAN, không phải hệ thống xác thực production

## Demo webcam trên laptop

Dự án có demo sử dụng webcam của máy tính để kiểm tra luồng đăng ký và nhận diện khuôn mặt bằng OpenCV LBPH.

Tạo môi trường ảo Python:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
```

Chạy đăng ký khuôn mặt:

```powershell
.\.venv\Scripts\python.exe tools/laptop-demo/laptop_camera_test.py --enroll "Ten nguoi"
```

Chạy nhận diện:

```powershell
.\.venv\Scripts\python.exe tools/laptop-demo/laptop_camera_test.py
```

Demo web cục bộ:

```powershell
.\.venv\Scripts\python.exe tools/laptop-demo/laptop_camera_web.py
```

Mở:

```text
http://127.0.0.1:8765
```

Dữ liệu khuôn mặt demo được lưu trong `face_test_data/` và không nên commit lên Git.

## Mức độ an toàn và giới hạn hiện tại

Dự án đang ở giai đoạn prototype và có một số giới hạn rõ ràng:

- API local sử dụng HTTP trên mạng nội bộ tin cậy, không phải môi trường production
- `ws://` trên ESP32-CAM chỉ phù hợp với mạng LAN nội bộ
- Preview web không thay thế xác thực người dùng thực tế hoặc đồng bộ phiên phía server
- Demo webcam chỉ mô phỏng luồng nhận diện, không dùng để bảo vệ cửa thật
- Cần kiểm tra kỹ phần cứng, nguồn điện, relay và điều kiện mạng trước khi triển khai thực tế

## Bản quyền

Dự án được phát hành theo giấy phép [MIT License](LICENSE).

Font Material Symbols trong [app/src/main/assets/icons](app/src/main/assets/icons) có giấy phép riêng đi kèm.

## Ghi chú

- Firmware và giao diện camera vẫn giữ dữ liệu sinh trắc học trên thiết bị nhúng
- Đặc điểm ưu tiên của dự án là xác thực cục bộ trên LAN thay vì truyền dữ liệu lên dịch vụ đám mây
- Hướng dẫn chi tiết về API, schema SQLite và cấu hình kết nối: [tools/local-api/README.md](tools/local-api/README.md)
