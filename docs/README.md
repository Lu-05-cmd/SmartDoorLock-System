# Báo cáo cấu trúc phần cứng và phần mềm SmartDoorLock

## Tóm tắt

Tài liệu trình bày kiến trúc phần cứng, cấu trúc phần mềm và trình tự hoạt động của prototype SmartDoorLock. Nhánh ESP32 dùng camera OV5640 để nhận diện khuôn mặt và điều khiển relay; STM32 Blue Pill là firmware truy cập cửa độc lập, sử dụng PIN, RFID và servo. Ứng dụng Android/WebView và Local API hỗ trợ quản lý thiết bị, metadata người dùng và sự kiện cho nhánh ESP32.

> **Lưu ý tương thích camera:** Firmware chọn cấu hình OV5640 và ESP-WHO đi kèm có driver cho sensor này. Pinout vẫn phụ thuộc vào breakout OV5640 cụ thể; sơ đồ và cấu hình GPIO cần được đối chiếu với module thực tế, sau đó kiểm thử camera trên phần cứng trước khi vận hành.
>
> **Phạm vi:** Hai nhánh ESP32 và STM32 hiện không tích hợp với nhau. Sơ đồ trong báo cáo mô tả kiến trúc logic, không thay thế sơ đồ mạch điện hoặc hướng dẫn kiểm tra an toàn trước khi lắp đặt.

## Mục lục

1. [Mục tiêu và phạm vi](#1-mục-tiêu-và-phạm-vi)
2. [Tổng quan hệ thống](#2-tổng-quan-hệ-thống)
3. [Thiết kế hệ thống](#3-thiết-kế-hệ-thống)
4. [Thử nghiệm và kết quả](#4-thử-nghiệm-và-kết-quả)
5. [Phần III: Kết luận và kiến nghị](#phần-iii-kết-luận-và-kiến-nghị)
6. [Danh sách từ viết tắt](abbreviations.md)
7. [Tài liệu tham khảo trong repository](#6-tài-liệu-tham-khảo-trong-repository)

## 1. Mục tiêu và phạm vi

### 1.1. Mục tiêu

- Mô tả các khối phần cứng và chức năng của từng thiết bị.
- Giải thích cách ESP32, Local API, SQLite và ứng dụng Android/WebView trao đổi dữ liệu.
- Trình bày quá trình nhận diện, xác thực quyền, điều khiển khóa và ghi nhận sự kiện.
- Phân biệt firmware ESP32 với firmware STM32 độc lập để tránh nhầm lẫn khi tích hợp hoặc đấu nối.

### 1.2. Phạm vi chức năng

- **Nhánh ESP32:** nhận diện khuôn mặt cục bộ, đăng ký face ID, yêu cầu API xác thực quyền, điều khiển relay và gửi metadata.
- **Nhánh ứng dụng/API:** xem thiết bị, sự kiện và metadata khuôn mặt; giao tiếp camera trực tiếp bằng WebSocket để xem stream và quản lý enrollment.
- **Nhánh STM32:** thiết lập và xác thực PIN, xác thực UID thẻ RFID, hiển thị OLED và điều khiển servo. Nhánh này không gửi dữ liệu đến Local API.

## 2. Tổng quan hệ thống

Hệ thống gồm thiết bị đầu cuối, dịch vụ lưu metadata và giao diện quản trị. Camera, nhận diện và quyết định điều khiển relay nằm trên ESP32. API kiểm tra quyền của face ID và lưu thông tin quản trị; ứng dụng kết nối đồng thời tới API và camera theo hai giao thức riêng. STM32 là một nguyên mẫu độc lập sử dụng các cảm biến và phương thức truy cập khác.

![Sơ đồ kiến trúc tổng thể phần mềm SmartDoorLock, nền trắng](diagrams/software-architecture.svg)

*Hình 1. Các thành phần phần mềm và các kênh giao tiếp chính với camera OV5640.*

| Thành phần | Vai trò | Kết nối/chức năng chính |
| --- | --- | --- |
| ESP32 DevKit + OV5640 | Chụp ảnh, phát hiện/nhận diện khuôn mặt, enrollment và điều khiển relay | Wi-Fi; HTTP tới API; WebSocket camera |
| Local API | Kiểm tra quyền truy cập và cung cấp API quản trị | HTTP, mặc định cổng `8766` |
| SQLite | Lưu thiết bị, sự kiện và metadata người dùng khuôn mặt | Được Local API truy cập cục bộ |
| Ứng dụng Android/WebView | Giao diện dashboard, cấu hình API, quản lý khuôn mặt và sự kiện | REST API và WebSocket tới ESP32 |
| STM32 Blue Pill | Firmware mẫu truy cập bằng PIN/RFID và servo | Hoạt động độc lập, không kết nối API |

## 3. Thiết kế hệ thống

### 3.1. Thiết kế phần cứng

### 3.1. Nhánh ESP32 nhận diện khuôn mặt

Firmware sử dụng driver OV5640 để lấy khung hình cho ESP32 DevKit và phát hiện/so khớp khuôn mặt tại thiết bị. Face ID/embedding được lưu trên partition nhận diện của flash. GPIO2 điều khiển đầu vào module relay ở mức active-low; tiếp điểm relay đóng/ngắt mạch cấp nguồn phù hợp cho khóa điện. Pinout cần được xác nhận với breakout OV5640 thực tế trước khi lắp đặt.

![Sơ đồ phần cứng ESP32 và khóa cửa, nền trắng](diagrams/hardware-esp32.svg)

*Hình 2. Kết nối logic giữa camera, ESP32, mạng/API, relay, nguồn và khóa điện.*

**Diễn giải các khối:**

1. **Camera OV5640:** cung cấp khung hình cho firmware. Xác nhận điện áp, pinout và giao tiếp đúng với breakout/module OV5640 cụ thể.
2. **ESP32 DevKit + PSRAM:** chạy camera, phát hiện/nhận diện khuôn mặt, quản lý enrollment và ra quyết định đóng/mở relay sau khi nhận phản hồi xác thực.
3. **Wi-Fi LAN:** làm đường truyền giữa thiết bị với Local API và ứng dụng trong cùng mạng.
4. **Local API:** nhận heartbeat, yêu cầu kiểm tra quyền và metadata sự kiện. API không nhận ảnh camera hoặc embedding khuôn mặt.
5. **Module relay và khóa:** ESP32 chỉ điều khiển chân tín hiệu relay; khóa phải được cấp qua nguồn và tiếp điểm relay phù hợp với thông số tải. Không nối tải khóa trực tiếp vào GPIO.
6. **Reed switch và buzzer:** reed vào GPIO13, buzzer passive PWM ở GPIO19; ESP32 báo khi cửa mở liên tục 10 giây.
7. **Nguồn:** nguồn bo ESP32 và nguồn khóa được chọn theo thiết bị thực tế; sơ đồ thể hiện kết nối nguyên lý, không quy định điện áp/dòng của mọi module.

Chi tiết pinout hiện đang cấu hình, build và trạng thái hỗ trợ cảm biến xem [hardware/README.md](../hardware/README.md#esp32-devkit-camera-module).

### 3.2. Nhánh STM32 Blue Pill độc lập

STM32F103C8T6 thực hiện luồng truy cập cục bộ riêng. Keypad nhập PIN; RC522 đọc UID thẻ qua SPI; OLED hiển thị trạng thái; PWM điều khiển servo. Cấu hình PIN và UID được giữ trong flash MCU. Firmware hiện không hỗ trợ Reed Switch; sơ đồ tập trung vào các ngoại vi đã có trong mã nguồn.

![Sơ đồ phần cứng STM32 Blue Pill, nền trắng](diagrams/hardware-stm32.svg)

*Hình 3. Các thiết bị ngoại vi được firmware STM32 hỗ trợ và kết nối logic với Blue Pill.*

**Diễn giải các khối:**

1. **Keypad 4×4:** nhập PIN và điều hướng các màn hình/cài đặt.
2. **RC522:** đọc UID thẻ RFID; firmware so sánh UID với danh sách đã lưu trên MCU.
3. **STM32F103C8T6:** xử lý trạng thái giao diện, xác thực PIN/UID, lưu cấu hình và điều khiển servo.
4. **OLED SSD1306:** hiển thị trạng thái, hướng dẫn thiết lập và thông báo cấp quyền/từ chối.
5. **Servo MG996R:** nhận PWM trên PA7/TIM3_CH2. Cần nguồn ngoài đủ dòng khởi động và nối chung GND với STM32.
6. **Flash MCU:** lưu PIN đã băm và tối đa 10 UID đã đăng ký.

Reed switch và buzzer thuộc nhánh ESP32, không thuộc firmware STM32. Reed switch dùng GPIO13 với pull-up nội, buzzer passive dùng PWM trên GPIO19 và báo khi cửa mở liên tục 10 giây. Trạng thái/cảnh báo có trong endpoint `/status` của ESP32; xem pinout và hướng dẫn xem camera trực tiếp bằng Python tại [hardware/README.md](../hardware/README.md#esp32-devkit-camera-module).

Chi tiết sơ đồ chân, nguồn servo và quy trình nạp/debug xem [hardware/README.md](../hardware/README.md#stm32f103c8t6-blue-pill).

### 3.3. Thiết kế phần mềm

#### 3.3.1. Thành phần và trách nhiệm

#### Firmware ESP32

- Khởi tạo GPIO relay ở trạng thái khóa, camera, Wi-Fi, tác vụ nhận diện và tác vụ heartbeat.
- Đọc face ID đã đăng ký từ partition `fr`.
- Chạy HTTP server trạng thái trên cổng `80` và WebSocket stream/điều khiển trên cổng `82` sau khi kết nối Wi-Fi.
- Gửi heartbeat, yêu cầu xác thực và sự kiện tới Local API.

#### Local API và SQLite

- Xác thực các yêu cầu API bằng bearer token.
- Lưu trạng thái thiết bị, heartbeat gần nhất, sự kiện, face ID dạng metadata, tên hiển thị và trạng thái `face_enabled`.
- Trả quyết định cho endpoint xác thực khuôn mặt dựa trên trạng thái thiết bị và dữ liệu người dùng.
- Không lưu hình ảnh hoặc embedding sinh trắc.

#### Android/WebView

- Java Activity tải giao diện HTML/CSS/JavaScript đóng gói trong ứng dụng.
- JavaScript gọi REST API để xem trạng thái, sự kiện và metadata người dùng.
- Trang quản lý khuôn mặt mở WebSocket trực tiếp tới địa chỉ IP của ESP32 để nhận luồng camera và gửi lệnh enrollment/xóa.

#### 3.3.2. Sơ đồ luồng xác thực

![Sơ đồ trình tự xác thực khuôn mặt, nền trắng](diagrams/face-access-sequence.svg)

*Hình 4. Trình tự từ khung hình camera đến quyết định relay; trình tự nhận diện chỉ vận hành với cảm biến được firmware hỗ trợ.*

ESP32 thực hiện nhận diện trước khi gửi yêu cầu quyền tới API. Local API kiểm tra thiết bị và người dùng trong SQLite rồi phản hồi `authorized`. Relay chỉ được kích hoạt khi firmware nhận HTTP thành công và phản hồi cho phép. Nhánh lỗi hoặc từ chối giữ trạng thái khóa (fail-closed).

#### 3.3.3. Kênh giao tiếp

| Nguồn | Đích | Giao thức | Mục đích |
| --- | --- | --- | --- |
| ESP32 | Local API | HTTP POST, mặc định API ở `:8766` | Heartbeat, xác thực khuôn mặt và sự kiện |
| Ứng dụng | Local API | REST/HTTP + bearer token | Trạng thái thiết bị, sự kiện, metadata và quyền khuôn mặt |
| Ứng dụng | ESP32 | WebSocket `ws://<IP>:82/` | Preview, lệnh stream/enrollment/xóa |
| ESP32 | Trình duyệt trạng thái | HTTP, cổng `80` | Trang/endpoint trạng thái thiết bị |

### 3.4. Luồng hoạt động chi tiết

#### 3.4.1. Khởi động ESP32 và kết nối hệ thống

1. ESP32 khởi tạo NVS, cấu hình GPIO2 và đặt relay về trạng thái khóa.
2. Firmware khởi tạo camera và các khóa đồng bộ; tác vụ nhận diện nạp face ID từ partition flash `fr`.
3. Firmware cấu hình Wi-Fi station. Khi nhận địa chỉ IP, nó khởi chạy HTTP server trạng thái và WebSocket trên cổng `82`.
4. Tác vụ heartbeat gửi `device_id`, địa chỉ IP và phiên bản firmware tới `POST /api/v1/devices/heartbeat` mỗi 60 giây.
5. Local API cập nhật thiết bị thành `online` trong SQLite. Khi heartbeat cũ hơn 90 giây, API đổi trạng thái thiết bị thành `offline`.
6. Nếu API chưa cấu hình hoặc không truy cập được, thiết bị vẫn có thể chạy camera/nhận diện; tuy nhiên không thể nhận quyết định cho phép để mở relay.

#### 3.4.2. Nhận diện và mở cửa

1. Camera cấp khung hình cho firmware. Firmware phát hiện khuôn mặt và so khớp với dữ liệu trên ESP32.
2. Khi có một khuôn mặt đã nhận diện, ESP32 gửi `device_id` và `face_id` tới `POST /api/v1/face/authorize`.
3. API xác thực token, xác nhận thiết bị đã đăng ký heartbeat và kiểm tra metadata người dùng:
   - Khi thiết bị có người dùng đã đồng bộ, chỉ face ID có bản ghi đang bật `face_enabled = 1` được phép.
   - Khi chưa có bản ghi người dùng nào cho thiết bị, API hiện trả về `authorized = true` với `managed = false`. Đây là hành vi trong mã hiện tại; nếu cần kiểm soát bằng danh sách cho phép, hãy đồng bộ người dùng lên API trước khi dùng chức năng xác thực.
   - Nếu thiết bị chưa đăng ký, người dùng không tồn tại/bị tắt, token sai hoặc API không phản hồi thành công, firmware không kích relay.
4. Khi nhận phản hồi thành công và `authorized = true`, firmware kéo relay theo logic active-low. Timer trả relay về trạng thái khóa sau khoảng 5 giây; nếu không khởi chạy được timer, firmware khóa lại ngay.
5. ESP32 gửi sự kiện nhận diện với kết quả cho phép/từ chối tới API để ghi vào SQLite. Lỗi ghi sự kiện không biến thành kết quả cấp quyền mới.

#### 3.4.3. Đăng ký và quản lý khuôn mặt

1. Người quản trị cấu hình API base URL và token trong phần cài đặt ứng dụng; ứng dụng tải danh sách thiết bị và metadata khuôn mặt qua REST API.
2. Người dùng chọn camera. Ứng dụng kết nối WebSocket trực tiếp tới `ws://<IP-thiết-bị>:82/` và gửi lệnh `stream` để nhận preview.
3. Khi đăng ký, app gửi `capture:<faceId>`. Firmware chỉ lấy mẫu khi phát hiện đúng một khuôn mặt; sau 5 mẫu, firmware tính embedding trung bình, chuẩn hóa và lưu trên partition `fr`. Tối đa 7 face ID được lưu trên ESP32.
4. Sau khi lưu thành công, firmware báo `face_enrolled`; API tạo/cập nhật metadata face ID. Tên hiển thị và trạng thái bật/tắt quyền được quản lý qua API.
5. Lệnh xóa được gửi trực tiếp đến ESP32. Xóa embedding trên camera và chỉnh metadata ở API là hai thay đổi riêng; sau khi xóa cần kiểm tra lại cả hai phía.
6. Tắt `face_enabled` trên API ngăn quyền truy cập ở lần xác thực tiếp theo, nhưng không tự xóa embedding đã có trên thiết bị.

**Ranh giới dữ liệu sinh trắc:** ảnh và embedding được xử lý/lưu trên thiết bị nhận diện. API chỉ nhận các trường định danh và sự kiện cần cho quản trị.

#### 3.4.4. Luồng STM32 Blue Pill

1. Khi khởi động, firmware đọc cấu hình flash. Nếu chưa có cấu hình hợp lệ, OLED hướng dẫn thiết lập PIN admin 6 số và PIN mở cửa 6 số; PIN phải được xác nhận lại và không trùng nhau.
2. Ở chế độ thường, người dùng nhập PIN cửa rồi nhấn `D`, hoặc quét thẻ RC522 đã đăng ký. PIN hợp lệ hoặc UID hợp lệ gọi luồng mở servo; PIN sai/thẻ lạ bị từ chối.
3. Servo nhận PWM từ PA7/TIM3_CH2; firmware giữ trạng thái mở khoảng 10 giây rồi đưa servo về góc khóa.
4. Nhấn `C`, nhập PIN admin rồi `D` để vào menu. Menu cho phép đăng ký thẻ, xem UID và thay đổi PIN. Tối đa 10 UID được lưu.
5. Keypad có cơ chế debounce và đánh thức giao diện; OLED tắt sau khoảng 30 giây không thao tác. RFID được quét định kỳ và cùng một thẻ chỉ được xử lý lại sau khi rời khỏi vùng đọc.
6. Luồng này chạy hoàn toàn trên STM32; không dùng Wi-Fi/API và không chia sẻ danh sách PIN/RFID với ESP32.

### 3.5. Giao thức, dữ liệu và giới hạn

#### 3.5.1. Dữ liệu lưu trữ

| Nơi lưu | Dữ liệu |
| --- | --- |
| ESP32 partition `fr` | Face ID và embedding nhận diện |
| SQLite `devices` | Device ID, IP, phiên bản firmware, trạng thái, thời điểm heartbeat |
| SQLite `events` | Loại sự kiện, device ID, chủ thể, kết quả và thời điểm |
| SQLite `face_users` | Face ID, tên hiển thị, trạng thái cho phép |
| Flash STM32 | Hash PIN, cấu hình và tối đa 10 UID RFID |

#### 3.5.2. Giới hạn và lưu ý an toàn

- Local API dùng HTTP và camera dùng WebSocket không mã hóa; chỉ sử dụng trong LAN tin cậy, không mở các cổng này trực tiếp ra Internet.
- Hành vi `managed = false` cho phép truy cập khi API chưa có metadata khuôn mặt cho thiết bị. Cần hiểu và cấu hình danh sách quản lý trước khi dựa vào API để giới hạn người được phép.
- Sơ đồ là sơ đồ khối logic, không phải sơ đồ đấu dây chính thức. Kiểm tra pinout, điện áp, dòng, cách ly relay và nguồn khóa/servo theo module thực tế.
- Hình Fritzing cũ có thể mô tả cấu hình khác với firmware hiện hành; không dùng riêng hình đó để đấu dây.
- Đây là prototype, không phải hệ thống kiểm soát truy cập đã được chứng nhận an toàn.

## 4. Thử nghiệm và kết quả

### 4.1. Mục tiêu thử nghiệm

Thử nghiệm nhằm xác nhận các chức năng đã triển khai, đo mức độ đáp ứng tiêu chí của hệ thống và làm rõ phần nào mới chỉ được mô tả/triển khai trong mã nguồn nhưng chưa được kiểm chứng trên thiết bị thật. Các mục tiêu cụ thể:

1. Xác nhận Local API hoạt động, bảo vệ endpoint riêng tư bằng token và trao đổi được dữ liệu với SQLite.
2. Kiểm tra heartbeat, trạng thái online/offline, ghi sự kiện và đồng bộ metadata người dùng.
3. Kiểm tra quyết định cho phép/từ chối khuôn mặt, gồm cả người dùng bị vô hiệu hóa và thiết bị chưa được quản lý.
4. Xác định trạng thái kiểm chứng của app Android/WebView, firmware ESP32, firmware STM32 và ngoại vi vật lý.
5. Đối chiếu module OV5640 với driver và pinout thực tế của firmware để xác định các yêu cầu phần cứng còn thiếu.

### 4.2. Môi trường và phương pháp

| Hạng mục | Môi trường/phương pháp |
| --- | --- |
| Local API | Python unittest; HTTP server và SQLite tạm trên loopback |
| Dữ liệu kiểm thử | Cơ sở dữ liệu tạm do từng bài test tạo; không dùng dữ liệu vận hành |
| ESP32/camera/relay | Chưa có kết quả thử nghiệm phần cứng trong lần lập báo cáo này |
| STM32 firmware | Build bằng PlatformIO đã thành công; xác nhận biên dịch, không xác nhận hoạt động ngoại vi |
| STM32/RFID/keypad/OLED/servo | Chưa có kết quả thử nghiệm trên board và ngoại vi thật trong lần lập báo cáo này |
| Android/WebView | Chưa chạy kiểm thử giao diện hoặc kết nối trên thiết bị Android trong lần lập báo cáo này |

Build STM32 được kiểm tra bằng `make -C hardware stm32-build`. Lệnh này biên dịch firmware, không nạp hoặc chạy thử trên board.

Lệnh dùng để chạy bộ kiểm thử Local API từ thư mục gốc:

```powershell
python -m unittest discover -s software\local-api -v
```

### 4.3. Tiêu chí đánh giá

| Mã | Tiêu chí đạt |
| --- | --- |
| TC-01 | Endpoint health trả HTTP 200 và báo trạng thái hoạt động. |
| TC-02 | Endpoint dữ liệu riêng tư từ chối yêu cầu thiếu/sai bearer token. |
| TC-03 | Heartbeat đăng ký/cập nhật thiết bị; thiết bị cũ heartbeat được báo offline. |
| TC-04 | Sự kiện hợp lệ được lưu và đọc lại; sự kiện sai hoặc thiết bị chưa đăng ký bị từ chối. |
| TC-05 | Metadata khuôn mặt đồng bộ lặp lại không tạo bản ghi trùng; tên và quyền truy cập cập nhật đúng. |
| TC-06 | Khuôn mặt bị tắt quyền bị từ chối; hành vi thiết bị chưa quản lý được ghi nhận rõ. |
| TC-07 | OV5640 khởi tạo được, lấy được frame ổn định và feed được pipeline nhận diện. |
| TC-08 | ESP32 chỉ mở relay khi được API cho phép và tự khóa lại theo thời gian cấu hình. |
| TC-09a | Firmware STM32 biên dịch thành công bằng PlatformIO. |
| TC-09b | Xác thực PIN/RFID, OLED và servo hoạt động đúng trên board thật. |
| TC-10 | Ứng dụng kết nối được tới API/camera và luồng quản lý khuôn mặt hoạt động đầu-cuối. |

### 4.4. Kết quả kiểm thử đã thực hiện

Ngày chạy bộ kiểm thử trong môi trường phát triển: **24/10/2026**.

| Mã | Chức năng kiểm tra | Kết quả thực tế | Đánh giá |
| --- | --- | --- | --- |
| TC-01 | Health endpoint | `/health` trả HTTP 200 trong test loopback. | **Đạt** |
| TC-02 | Bearer token | Endpoint riêng tư không có token trả HTTP 401. | **Đạt** |
| TC-03 | Heartbeat và trạng thái thiết bị | Heartbeat lưu thiết bị; heartbeat cũ được báo offline. | **Đạt** |
| TC-04 | Ghi sự kiện và kiểm tra dữ liệu đầu vào | Sự kiện hợp lệ lưu/đọc được; sự kiện không hợp lệ hoặc thiết bị chưa đăng ký bị từ chối. | **Đạt** |
| TC-05 | Đồng bộ face user | Đồng bộ idempotent; tên hiển thị có thể cập nhật mà không làm mất cài đặt quyền. | **Đạt** |
| TC-06 | Quyền truy cập khuôn mặt | Test xác nhận người dùng tắt quyền bị từ chối và trường hợp thiết bị chưa quản lý được trả riêng. | **Đạt theo hành vi hiện tại** |
| TC-09a | Build firmware STM32 | `make -C hardware stm32-build` biên dịch thành công bằng PlatformIO. | **Đạt — build** |
| TC-09b | Xác thực PIN/RFID, OLED và servo trên STM32 | Chưa có kết quả chạy thử trên board và ngoại vi thật. | **Chưa xác minh** |
| TC-07, TC-08, TC-10 | Camera OV5640, relay và ứng dụng trên thiết bị | Không chạy trong bộ kiểm thử API; chưa có bằng chứng thử nghiệm phần cứng/giao diện. | **Chưa xác minh** |

**Tổng hợp:** bộ integration test Local API có **11/11 bài test đạt**, thời gian chạy khoảng **6 giây**. Các bài test tạo SQLite tạm và server loopback, không kết nối Wi-Fi LAN hoặc thiết bị vật lý. Kết quả này chỉ xác nhận logic API trong phạm vi test; không chứng minh độ chính xác nhận diện khuôn mặt, khả năng đóng/mở khóa, độ ổn định camera hay độ an toàn của mạch điện.

### 4.5. Sản phẩm hiện có thể thực hiện những chức năng nào?

Xét theo các thành phần đã có trong repository, sản phẩm hiện được hiện thực ở mức **prototype có firmware, ứng dụng và backend**. Các chức năng dưới đây đã có trong mã nguồn hoặc được API kiểm chứng bằng test; riêng hoạt động trên mạch thật chỉ được xác nhận khi có kết quả thử nghiệm phần cứng tương ứng.

#### A. Khả năng phần cứng

| Phần cứng | Chức năng sản phẩm đã được hiện thực trong firmware/thiết kế | Trạng thái hiện tại |
| --- | --- | --- |
| ESP32 DevKit + camera | Thu khung hình, phát hiện/so khớp khuôn mặt, đăng ký face ID bằng 5 mẫu, lưu tối đa 7 face ID, truyền preview và nhận lệnh quản lý qua WebSocket. | Firmware đã chọn driver OV5640; chưa xác minh camera và pinout trên phần cứng thực tế. |
| ESP32 + relay | Đặt relay ở trạng thái khóa khi khởi động; nhận quyết định cho phép từ API rồi kích relay active-low trong khoảng 5 giây và tự khóa lại. | Đã có xử lý trong firmware; chưa có kết quả đo/kiểm tra tải khóa và relay trên phần cứng trong đợt này. |
| STM32 Blue Pill + keypad/RFID | Thiết lập PIN admin/PIN cửa; xác thực PIN 6 số hoặc UID RFID; menu quản trị cho đăng ký/xem thẻ, đổi PIN; lưu cấu hình trong flash. | Các luồng đã có trong firmware và build thành công; chưa kiểm thử chức năng trên board/ngoại vi thật. Reed Switch chưa được hỗ trợ. |
| STM32 + OLED/servo | Hiển thị trạng thái và hướng dẫn; điều khiển servo bằng PWM để mở trong khoảng 10 giây rồi trả về góc khóa. | Có trong firmware và build thành công; cần kiểm tra nguồn servo, dải PWM, cơ cấu chốt và thời gian hoạt động trên mạch thật. |

Như vậy, phần cứng đã có **thiết kế khối và firmware điều khiển** cho hai hướng nguyên mẫu: khóa bằng nhận diện khuôn mặt/relay trên ESP32 và khóa bằng PIN/RFID/servo trên STM32. Hai hướng này là hai phương án riêng, chưa kết hợp thành một bộ điều khiển duy nhất. Chưa đủ cơ sở gọi hệ thống là sản phẩm phần cứng hoàn thiện cho tới khi chốt camera tương thích, đấu nối theo schematic chính xác, thử nghiệm nguồn/tải và xác nhận trạng thái khóa an toàn.

#### B. Khả năng phần mềm

| Phần mềm | Chức năng sản phẩm đã xây dựng | Mức xác minh |
| --- | --- | --- |
| Local API + SQLite | Quản lý thiết bị/heartbeat, trạng thái online/offline, sự kiện, metadata face user; xác thực token; cho phép/từ chối face user theo trạng thái quản lý. | 11/11 integration test API đã chạy đạt với server loopback và SQLite tạm. |
| Android/WebView | Cung cấp giao diện dashboard, cấu hình địa chỉ/token API, xem thiết bị/sự kiện, quản lý metadata khuôn mặt và kết nối WebSocket tới camera để preview/enrollment. | Mã nguồn giao diện và APK debug có trong repository; chưa có kết quả kiểm thử đầu-cuối trên điện thoại trong đợt này. |
| ESP32 firmware | Kết nối API, gửi heartbeat/sự kiện, yêu cầu xác thực face ID, nhận lệnh camera, enrollment và điều khiển relay. | Đã hiện thực trong mã nguồn; phụ thuộc camera/board thực tế để xác minh toàn luồng. |
| STM32 firmware | Xác thực cục bộ PIN/RFID, lưu cấu hình flash, điều khiển màn hình và servo. | Đã hiện thực và build thành công bằng PlatformIO; chưa tích hợp API/app và chưa xác minh trên board thực tế trong đợt này. |

#### C. Kết quả có thể tuyên bố ở thời điểm báo cáo

- **Đã xây dựng:** kiến trúc hai nhánh phần cứng, firmware ESP32 và STM32, Local API, schema SQLite, giao diện Android/WebView, giao thức trao đổi và tài liệu/sơ đồ báo cáo.
- **Đã kiểm tra bằng phần mềm:** các luồng API về health, bearer token, heartbeat, sự kiện, đồng bộ face user và quyền truy cập — tổng cộng 11/11 integration test đạt.
- **Đã xác nhận build:** firmware STM32 Blue Pill biên dịch thành công; kết quả này chưa xác nhận hoạt động của các ngoại vi trên board thật.
- **Chưa chứng minh bằng thử nghiệm vật lý:** nhận diện trên module OV5640, độ chính xác nhận diện, relay điều khiển khóa thật, chức năng ngoại vi STM32 trên mạch thật, và tích hợp app–camera–API trên mạng/điện thoại thật.
- **Chưa phải sản phẩm triển khai thương mại:** bảo mật đường truyền, xác minh chất lượng nhận diện, độ bền nguồn/cơ cấu khóa, quy trình cập nhật/khôi phục thiết bị và đánh giá an toàn truy cập vẫn cần được hoàn thiện.

### 4.6. Hạng mục đã xây dựng và hạng mục chưa hoàn thành

| Phân hệ | Đã xây dựng/có trong repository | Chưa hoàn thành hoặc chưa kiểm chứng |
| --- | --- | --- |
| ESP32 camera | Pipeline firmware nhận diện, enrollment 5 mẫu, lưu tối đa 7 face ID, WebSocket stream/lệnh, heartbeat và điều khiển relay có timer. | Firmware chọn driver OV5640; chưa xác minh frame, nhận diện, relay và khóa với phần cứng thực tế trong đợt thử này. |
| Local API/SQLite | Endpoint health, heartbeat, sự kiện, trạng thái, face user, xác thực quyền và cập nhật quyền; 11 integration test đạt. | Chưa kiểm thử tải, mạng LAN thực, độ bền khi mất điện hoặc hardening để dùng production. |
| Android/WebView | Giao diện đóng gói và JavaScript cho dashboard, cài đặt API, quản lý mặt/sự kiện, kết nối WebSocket. | Chưa kiểm thử end-to-end trên điện thoại thật trong đợt này; HTTP và WebSocket hiện không mã hóa. |
| STM32 Blue Pill | Firmware PIN/RFID, OLED, lưu cấu hình flash, keypad và servo PWM được triển khai trong mã nguồn; build PlatformIO thành công. | Chưa có kết quả đo/test trên board và ngoại vi; Reed Switch chưa được hỗ trợ; chưa tích hợp với app/API/nhánh ESP32. |
| Tài liệu/sơ đồ | Có sơ đồ phần cứng, kiến trúc, luồng xác thực và mô tả báo cáo. | Sơ đồ khối không phải schematic đấu dây; cần xác nhận pinout theo breakout OV5640 và kiểm tra mạch thật. |

### 4.7. Nhận xét và kế hoạch thử nghiệm tiếp theo

Kết quả hiện có xác nhận lớp API và lưu trữ metadata hoạt động theo các luồng chính đã thiết kế. Bước kiểm chứng tiếp theo nên thực hiện trên từng phân hệ, sau đó mới chạy tích hợp toàn hệ thống:

1. **Camera:** chốt đúng module/breakout OV5640, nguồn và pinout; kiểm tra driver khởi tạo, frame liên tục và pipeline nhận diện trong các điều kiện ánh sáng khác nhau.
2. **ESP32 và relay:** kiểm tra trạng thái relay lúc khởi động, API cho phép/từ chối, API mất kết nối, timer khóa lại và khả năng phục hồi Wi-Fi. Thử ban đầu với tải an toàn thay cho khóa cửa thật.
3. **API và quyền truy cập:** chạy kiểm thử trên LAN, đồng bộ danh sách user trước khi bật enforcement; đánh giá rõ chế độ `managed = false`, token sai, người dùng bị vô hiệu hóa và thiết bị offline.
4. **STM32:** sau khi đã xác nhận firmware build thành công, thử thiết lập/đổi PIN, thẻ hợp lệ/không hợp lệ, lưu flash, phục hồi sau reset, hiển thị OLED và PWM servo bằng nguồn riêng.
5. **Ứng dụng:** kiểm tra cấu hình API, token, đọc dashboard, kết nối WebSocket, enrollment, đồng bộ metadata và lỗi khi thiết bị/API mất kết nối.
6. **Tích hợp và an toàn:** đối chiếu sự kiện app/API với thao tác thực tế; đo nguồn và tải, xác nhận cách ly relay, cơ chế khóa an toàn và các giới hạn bảo mật trước khi cân nhắc triển khai.

## PHẦN III: KẾT LUẬN VÀ KIẾN NGHỊ

### 1. Kết luận về nội dung nghiên cứu đã thực hiện

Báo cáo đã xây dựng mô hình hệ thống khóa cửa thông minh gồm hai nhánh phần cứng độc lập và các thành phần phần mềm hỗ trợ. Nhánh ESP32 được thiết kế để xử lý nhận diện khuôn mặt tại thiết bị, lưu dữ liệu nhận diện cục bộ và điều khiển relay; Local API/SQLite quản lý thiết bị, metadata người dùng, sự kiện và quyết định quyền truy cập; ứng dụng Android/WebView cung cấp giao diện quản trị và kết nối camera. Nhánh STM32 hiện thực luồng truy cập riêng bằng PIN/RFID, OLED và servo; firmware đã build thành công nhưng chưa tích hợp với ESP32/API hoặc kiểm thử trên board thật.

Về kết quả kiểm tra, 11/11 integration test của Local API đạt trong môi trường server loopback và SQLite tạm, xác nhận các luồng API chính như heartbeat, token, sự kiện, đồng bộ metadata và trạng thái quyền. Firmware STM32 cũng đã biên dịch thành công bằng PlatformIO. Đây là các kết quả kiểm tra phần mềm; báo cáo chưa có dữ liệu xác nhận hoạt động trên mạch thật. Firmware ESP32 đã chọn driver OV5640, nhưng camera, pinout breakout và khả năng nhận diện/điều khiển khóa vẫn cần được kiểm thử trên phần cứng thực tế.

### 2. Kiến nghị về ứng dụng và sử dụng kết quả

Kết quả hiện phù hợp để sử dụng làm tài liệu thiết kế, nguyên mẫu học tập, trình diễn trong phòng thí nghiệm và nền tảng tiếp tục phát triển hệ thống kiểm soát cửa quy mô nhỏ trong môi trường thử nghiệm có giám sát. Các sơ đồ khối giúp định hướng kiến trúc, còn firmware/API cung cấp cơ sở để thử nghiệm riêng từng phân hệ. Chưa nên dùng nguyên trạng để bảo vệ cửa hoặc tài sản trong môi trường thực tế, vì camera mục tiêu, mạch relay/khóa, phần cứng STM32 và luồng tích hợp đầu-cuối chưa được xác minh.

Trước khi thử nghiệm trên cửa thật, cần chốt đúng module camera, xác minh điện áp và pinout, tích hợp driver tương thích, kiểm tra relay với tải an toàn và xác nhận cơ chế khóa khi mất nguồn/mất mạng. Cần đồng bộ danh sách người dùng trước khi dựa vào API để giới hạn quyền, vì chế độ `managed = false` hiện cho phép thiết bị chưa có metadata khuôn mặt. API HTTP và WebSocket hiện chưa mã hóa, do đó chỉ nên dùng trong LAN tin cậy và không mở trực tiếp ra Internet.

### 3. Hướng nghiên cứu và phát triển tiếp theo

1. **Hoàn thiện camera OV5640:** xác định chính xác breakout và pinout; kiểm tra khởi tạo cảm biến, tính ổn định của khung hình và khả năng chạy pipeline nhận diện trên ESP32.
2. **Đánh giá hiệu năng nhận diện:** thử với nhiều điều kiện ánh sáng, khoảng cách, góc mặt và người dùng; đo tỷ lệ nhận diện đúng/sai, độ trễ và ảnh hưởng của chất lượng hình ảnh.
3. **Nâng cấp an toàn hệ thống:** chuyển sang giao tiếp mã hóa, quản lý credential riêng cho từng thiết bị, bổ sung cơ chế thay/thu hồi token và rà soát cách xử lý khi API hoặc mạng bị gián đoạn.
4. **Kiểm chứng phần cứng:** thử nghiệm relay, tải khóa, nguồn và cách ly; đo độ ổn định khi đóng/mở lặp lại. Với STM32, kiểm tra keypad, RFID, flash, nguồn servo và cơ cấu chốt trên mạch thực.
5. **Tích hợp và vận hành:** thực hiện kiểm thử đầu-cuối app–API–ESP32 trên LAN, xây dựng quy trình đồng bộ/xóa người dùng và nhật ký, sau đó mới cân nhắc kết nối nhánh STM32 nếu có yêu cầu thống nhất phương thức truy cập.

Sau khi hoàn tất các bước trên, cần cập nhật báo cáo bằng số liệu đo thực tế và kết quả thử nghiệm có thể tái lập. Việc đánh giá độ tin cậy, an toàn điện và an toàn truy cập là điều kiện cần trước khi chuyển nguyên mẫu thành sản phẩm sử dụng thường xuyên.

## 6. Tài liệu tham khảo trong repository

- [Danh sách từ viết tắt và ký hiệu](abbreviations.md)
- [Hướng dẫn phần cứng và pinout ESP32/STM32](../hardware/README.md)
- [Hướng dẫn phần mềm Android và Local API](../software/README.md)
- [Tài liệu Local API, endpoint và schema SQLite](../software/local-api/README.md)
- [Sơ đồ Fritzing hiện có](../hardware/assets/Circuit.jpg)
