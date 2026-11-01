# Danh sách từ viết tắt

Bảng dưới đây tổng hợp các từ viết tắt và thuật ngữ kỹ thuật dùng trong báo cáo SmartDoorLock. Có thể sao chép trực tiếp bảng Markdown vào báo cáo; nếu dán vào Word, dùng chức năng chuyển văn bản thành bảng với dấu `|` làm dấu phân cách.

| Từ viết tắt | Tên đầy đủ | Giải thích / cách dùng trong báo cáo |
| --- | --- | --- |
| API | Application Programming Interface | Giao diện lập trình ứng dụng; cách các phần mềm trao đổi chức năng và dữ liệu. |
| APK | Android Package Kit | Gói cài đặt ứng dụng Android. |
| CSS | Cascading Style Sheets | Ngôn ngữ định dạng giao diện trang web. |
| DC | Direct Current | Dòng điện một chiều; dùng để mô tả nguồn cấp cho mạch. |
| ESP32 | Tên dòng sản phẩm Espressif (không khai triển thành cụm từ) | Dòng vi điều khiển 32-bit của Espressif dùng trong nhánh camera và relay. |
| ESP-DL | Espressif Deep Learning | Thư viện suy luận học sâu cho các thiết bị Espressif. |
| ESP-IDF | Espressif IoT Development Framework | Bộ framework phát triển phần mềm cho vi điều khiển Espressif. |
| ESP-WHO | Tên framework Espressif (không khai triển thành cụm từ) | Bộ framework/thư viện Espressif dùng cho các ứng dụng phát hiện và nhận diện người/khuôn mặt. |
| GND | Ground | Chân mass/đất tham chiếu điện áp; các phần mạch cần nối chung GND theo thiết kế. |
| GPIO | General-Purpose Input/Output | Chân vào/ra đa dụng của vi điều khiển. |
| HTML | HyperText Markup Language | Ngôn ngữ đánh dấu cấu trúc nội dung trang web. |
| HTTP | Hypertext Transfer Protocol | Giao thức truyền tải dữ liệu giữa client và server. |
| ID | Identifier | Mã định danh, ví dụ device ID hoặc face ID. |
| I²C | Inter-Integrated Circuit | Giao tiếp nối tiếp hai dây, dùng trong dự án để kết nối OLED với STM32. |
| IP | Internet Protocol | Giao thức Internet; trong báo cáo thường dùng trong địa chỉ IP của thiết bị. |
| LAN | Local Area Network | Mạng cục bộ, ví dụ mạng Wi-Fi nội bộ dùng để kết nối ESP32, API và ứng dụng. |
| MCU | Microcontroller Unit | Vi điều khiển; trong nhánh STM32 là chip xử lý chính trên board. |
| NVS | Non-Volatile Storage | Bộ lưu trữ không mất dữ liệu khi mất nguồn, được ESP-IDF dùng để lưu cấu hình. |
| OLED | Organic Light-Emitting Diode | Công nghệ màn hình diode phát quang hữu cơ; dự án dùng màn hình OLED để hiển thị trạng thái. |
| PIN | Personal Identification Number | Mã số nhận dạng cá nhân; trong nhánh STM32 là mã số truy cập gồm 6 chữ số. |
| POST | HTTP POST method | Phương thức HTTP dùng để gửi dữ liệu lên server, ví dụ heartbeat và sự kiện. |
| PSRAM | Pseudo-Static Random-Access Memory | Bộ nhớ RAM giả tĩnh; ESP32 dùng để hỗ trợ xử lý ảnh và camera. |
| PWM | Pulse-Width Modulation | Điều chế độ rộng xung; dùng để điều khiển servo trên STM32. |
| REST | Representational State Transfer | Kiểu kiến trúc API thường sử dụng các phương thức HTTP để truy cập tài nguyên. |
| RFID | Radio-Frequency Identification | Nhận dạng bằng sóng vô tuyến; nhánh STM32 sử dụng RC522 để đọc thẻ. |
| SPI | Serial Peripheral Interface | Giao tiếp ngoại vi nối tiếp; dự án dùng để kết nối RC522 với STM32. |
| SQL | Structured Query Language | Ngôn ngữ truy vấn dữ liệu có cấu trúc; dùng với cơ sở dữ liệu SQLite. |
| SQLite | SQLite database engine | Hệ quản trị cơ sở dữ liệu quan hệ nhúng, lưu dữ liệu trong một tệp. “SQLite” là tên sản phẩm, không phải chữ viết tắt cần khai triển. |
| STM32 | Tên dòng vi điều khiển STMicroelectronics | Dòng vi điều khiển 32-bit; dự án dùng board Blue Pill với STM32F103C8T6. |
| UID | Unique Identifier | Mã định danh duy nhất; trong dự án là mã đọc được từ thẻ RFID. |
| URL | Uniform Resource Locator | Địa chỉ xác định vị trí tài nguyên trên mạng, ví dụ địa chỉ Local API. |
| WebSocket | WebSocket Protocol | Giao thức kết nối hai chiều liên tục giữa client và server; ứng dụng dùng để nhận preview và gửi lệnh tới ESP32. |
| Wi-Fi | Wireless Fidelity | Công nghệ mạng không dây cục bộ; cách viết thông dụng, không có tên đầy đủ chính thức duy nhất. |

## Ký hiệu phần cứng và mã định danh

Các mục sau là mã model, mã chân hoặc mã kiểm thử, không phải từ viết tắt có tên đầy đủ cần khai triển:

| Ký hiệu | Ý nghĩa trong dự án |
| --- | --- |
| OV5640 | Mã model cảm biến camera mà firmware ESP32 chọn; driver có trong thư viện camera đi kèm. |
| ESP32 DevKit | Tên board phát triển ESP32 được dùng làm mục tiêu firmware camera. |
| STM32F103C8T6 | Mã model vi điều khiển STM32 trên board Blue Pill. |
| MG996R | Mã model servo trong thiết kế STM32. |
| RC522 | Mã model module RFID dùng trong nhánh STM32. |
| SSD1306 | Mã model bộ điều khiển màn hình OLED. |
| PA7, GPIO2, GPIO13, GPIO19 | Ký hiệu các chân vào/ra trên vi điều khiển. |
| TC-01 … TC-10 | Mã các tiêu chí kiểm thử trong Chương 4; `TC` là Test Case (trường hợp kiểm thử). |
