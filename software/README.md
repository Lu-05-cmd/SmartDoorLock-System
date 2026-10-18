# Software

Thư mục này chứa ứng dụng Android/WebView và local API của SmartDoorLock.

## Cấu trúc

```text
software/
  app/          Android app, Java activity và giao diện WebView
  local-api/    Python API, SQLite bridge, tài liệu và integration tests
```

Để xem kiến trúc tổng thể, hướng dẫn phần cứng và các lưu ý an toàn, xem [README gốc](../README.md). Firmware, cấu hình board và sơ đồ được mô tả trong [hardware/README.md](../hardware/README.md).

## Android app

Ứng dụng chứa dashboard, quản lý khuôn mặt, sự kiện và cấu hình kết nối thiết bị. Các trang WebView nằm trong `app/src/main/assets`.

### Yêu cầu

- JDK 17
- Android SDK Platform 35
- Gradle hoặc Android Studio

Mở PowerShell tại thư mục gốc repository. Ví dụ cấu hình JDK và Android SDK trên Windows (thay các đường dẫn theo máy của bạn):

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'
$env:ANDROID_HOME = 'D:\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version
Test-Path "$env:ANDROID_HOME\platforms\android-35"
```

Nếu lệnh `Test-Path` trả về `False`, hãy cài Android SDK Platform 35 hoặc trỏ `ANDROID_HOME` tới SDK đã có platform này.

### Build APK

Nếu Gradle đã có trong `PATH`:

```powershell
gradle --no-daemon -p software/app assembleDebug
```

Nếu Gradle chưa có trong `PATH` nhưng đã được tải vào cache Gradle, có thể tìm và chạy bản cache:

```powershell
$gradle = Get-ChildItem "$env:USERPROFILE\.gradle\wrapper\dists" -Filter gradle.bat -File -Recurse |
    Select-Object -First 1 -ExpandProperty FullName
if (-not $gradle) { throw 'Không tìm thấy Gradle trong cache; dùng Android Studio hoặc cấu hình Gradle đã có trên máy.' }
& $gradle --no-daemon -p software/app assembleDebug
```

Thêm `--rerun-tasks` để yêu cầu Gradle chạy lại toàn bộ tác vụ build. APK được tạo tại:

```text
software/app/build/outputs/apk/debug/FaceDoorControl-debug.apk
```

Kiểm tra file trên Windows:

```powershell
Test-Path software\app\build\outputs\apk\debug\FaceDoorControl-debug.apk
```

#### Build bằng Android Studio

Mở thư mục `software/app/` trong Android Studio, đặt **Gradle JDK** là JDK 17 tại **Settings > Build, Execution, Deployment > Build Tools > Gradle**, cài SDK Platform 35 nếu được nhắc, rồi chọn **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

#### Cài APK debug

APK debug được ký bằng chứng chỉ debug, không phải chứng chỉ nhà phát hành đã xác minh trên Google Play. Android hoặc Play Protect có thể cảnh báo ứng dụng chưa được nhận diện; việc ký APK không tự loại bỏ cảnh báo đó.

Chỉ cài APK lấy trực tiếp từ nguồn bạn tin cậy. Giữ Play Protect bật và để hệ thống quét APK. Nếu Play Protect báo ứng dụng có hại hoặc chặn cài đặt, không tắt Play Protect để vượt chặn; hãy kiểm tra nguồn APK. Để phát hành cho người dùng, dùng Google Play (ví dụ kênh kiểm thử nội bộ) để Google xác minh ứng dụng. APK release có ký tên riêng là cần thiết nhưng tự nó không làm ứng dụng được Play Protect tin cậy.

### Preview giao diện WebView qua LAN

Có thể phục vụ giao diện web mà không cần build APK:

```powershell
python -m http.server 8001 --bind 0.0.0.0 --directory software/app/src/main
```

Mở `http://127.0.0.1:8001/assets/login.html` trên máy chạy server hoặc `http://<ip-laptop>:8001/assets/login.html` trên thiết bị cùng mạng. Cấu trúc này giữ nguyên tiền tố `/assets/` mà ứng dụng Android dùng, tránh lỗi 404 khi tải trang hoặc tài nguyên tương đối. Cổng `8001` dành cho preview; local API mặc định dùng cổng `8766`. Nếu được hỏi, chỉ cho phép Python truy cập mạng Private trong Windows Firewall. Đây là preview thử nghiệm, không phải cơ chế xác thực production.

## Local API

API dùng Python và SQLite để theo dõi thiết bị, heartbeat, sự kiện và metadata người dùng. Chạy API từ thư mục gốc repository:

```powershell
$token = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$env:SMARTDOOR_API_TOKEN = $token
python software/local-api/server.py
```

Mặc định API lắng nghe trên `0.0.0.0:8766`; cơ sở dữ liệu được lưu tại `software/local-api/smartdoor.sqlite3`. Dùng cùng API token trong phần **Settings → Device connection** của ứng dụng và cấu hình ESP32-CAM. Hướng dẫn API, cấu hình firmware và endpoint được ghi trong [tài liệu Local API](local-api/README.md).

API dùng HTTP và chỉ phù hợp cho prototype trên mạng LAN tin cậy. Không mở cổng API ra Internet. Token trong app được lưu trong WebView local storage; token firmware được biên dịch vào thiết bị.

## Kiểm thử Local API

Chạy integration tests từ thư mục gốc:

```powershell
python -m unittest discover -s software/local-api -v
```

Các bài test dùng SQLite tạm và server loopback; không kết nối phần cứng hoặc mạng LAN.

## Quyền sử dụng

Dự án dùng giấy phép [MIT](../LICENSE). Font Material Symbols có giấy phép và thông báo riêng tại [app/src/main/assets/icons](app/src/main/assets/icons).
