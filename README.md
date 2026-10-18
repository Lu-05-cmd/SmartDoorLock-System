# SmartDoorLock System

Dự án prototype khóa cửa thông minh gồm firmware nhận diện khuôn mặt, ứng dụng Android/WebView và local API chạy trong mạng LAN.

## Tổng quan

- **ESP32 DevKit + OV2640:** nhận diện khuôn mặt và điều khiển relay trên thiết bị; gửi heartbeat và metadata sự kiện tới local API.
- **Ứng dụng Android/WebView:** dashboard demo, quản lý khuôn mặt, sự kiện và kết nối thiết bị.
- **Local API:** Python service dùng SQLite để lưu trạng thái thiết bị, sự kiện và metadata khuôn mặt.
- **STM32 Blue Pill:** firmware mẫu nháy LED độc lập, chưa tích hợp với luồng ESP32-CAM.

Ảnh khuôn mặt và mẫu sinh trắc học được xử lý/lưu trên thiết bị nhận diện; API chỉ nhận metadata, không nhận ảnh hay mẫu sinh trắc học.

```text
ESP32 DevKit + OV2640 ──> Nhận diện khuôn mặt ──> Relay khóa cửa
     │
     └── HTTP heartbeat + metadata sự kiện ──> Local API (Python + SQLite)
                                                  └── Android/WebView app

STM32 Blue Pill ──> Firmware mẫu độc lập
```

## Tài liệu

- [Software — ứng dụng Android, Local API, build và kiểm thử](software/README.md)
- [Hardware — firmware, cấu hình board, nạp/debug và sơ đồ](hardware/README.md)
- [Tài liệu chi tiết Local API](software/local-api/README.md)

## Cấu trúc repository

```text
software/
  app/            Android app và giao diện WebView
  local-api/      Python API, SQLite bridge và tests
hardware/
  esp32-camera/   Firmware ESP32 DevKit + OV2640
  stm32-bluepill/ Firmware mẫu STM32F103C8T6
  assets/         Sơ đồ mạch và kiến trúc
  Makefile        Lệnh build/nạp/debug firmware
```

## Bắt đầu nhanh

### Chạy giao diện app local

Từ thư mục gốc repository, chạy preview giao diện WebView:

```powershell
python -m http.server 8001 --bind 0.0.0.0 --directory software/app/src/main
```

Mở `http://127.0.0.1:8001/assets/login.html` trên máy đang chạy server. Thiết bị khác trong cùng mạng có thể dùng `http://<ip-laptop>:8001/assets/login.html`; nếu cần, cho phép Python truy cập mạng Private trong Windows Firewall. Cổng `8001` chỉ phục vụ giao diện preview; Local API sử dụng cổng `8766` và cần chạy riêng. Hướng dẫn build APK và preview có trong [software/README.md](software/README.md).

### Chạy local API

Từ thư mục gốc, khởi chạy API trên Windows PowerShell:

```powershell
$token = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$env:SMARTDOOR_API_TOKEN = $token
python software/local-api/server.py
```

API mặc định lắng nghe trên `0.0.0.0:8766`. Cấu hình đầy đủ và cách kết nối app/ESP32-CAM có trong [software/local-api/README.md](software/local-api/README.md).

### Build firmware

Từ thư mục gốc, có thể dùng GNU Make:

```powershell
make -C hardware help
make -C hardware esp32-build
make -C hardware stm32-build
```

Trước khi build firmware camera, tạo và cấu hình file secrets cục bộ. Xem hướng dẫn phần cứng để biết công cụ, board tương thích, nạp firmware và các lưu ý an toàn.

## Giới hạn và an toàn

- Đây là prototype, không phải hệ thống kiểm soát ra vào production.
- Local API dùng HTTP và luồng camera dùng WebSocket không mã hóa; chỉ sử dụng trong mạng LAN tin cậy, không mở các cổng này ra Internet.
- Giao diện web demo không thay thế xác thực production.
- Kiểm tra nguồn điện, tải relay, cách ly và sơ đồ đấu dây trước khi kết nối khóa điện.

## Bản quyền

Dự án phát hành theo [MIT License](LICENSE). Font Material Symbols có giấy phép và thông báo riêng tại [software/app/src/main/assets/icons](software/app/src/main/assets/icons).
