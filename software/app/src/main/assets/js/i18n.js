(function initializeAppLanguage() {
  const languageStorageKey = 'face-door-language';
  const translations = {
    'Settings': 'Cài đặt',
    'Settings | Face Door Control': 'Cài đặt | Face Door Control',
    'Activity | Face Door Control': 'Hoạt động | Face Door Control',
    'Sign In | Face Door Control': 'Đăng nhập | Face Door Control',
    'Create Account | Face Door Control': 'Tạo tài khoản | Face Door Control',
    'System & Preferences': 'Hệ thống & Tùy chọn',
    'Configure security protocols, door behavior, and device health.': 'Cấu hình bảo mật, hoạt động của cửa và tình trạng thiết bị.',
    'Online': 'Trực tuyến',
    'Account': 'Tài khoản',
    'Main navigation': 'Điều hướng chính',
    'Terminal actions': 'Thao tác hệ thống',
    'Sign in to your account': 'Đăng nhập vào tài khoản',
    'Login': 'Đăng nhập',
    'Log out': 'Đăng xuất',
    'Account verification': 'Xác minh tài khoản',
    'Contact methods': 'Phương thức liên hệ',
    'Email address': 'Địa chỉ email',
    'Phone number': 'Số điện thoại',
    'Not linked': 'Chưa liên kết',
    'Not verified': 'Chưa xác minh',
    'Link email': 'Liên kết email',
    'Link phone': 'Liên kết số điện thoại',
    'Verify email': 'Xác minh email',
    'Verify phone': 'Xác minh số điện thoại',
    'Email and SMS verification are not configured yet. Linked details remain unverified on this device.': 'Chức năng xác minh email và SMS chưa được thiết lập. Thông tin đã liên kết vẫn chưa được xác minh trên thiết bị này.',
    'Link contact': 'Liên kết thông tin liên hệ',
    'Contact': 'Thông tin liên hệ',
    'Close': 'Đóng',
    'Save locally': 'Lưu trên thiết bị',
    'Save email address': 'Lưu địa chỉ email',
    'Save phone number': 'Lưu số điện thoại',
    'Email and SMS code delivery is not configured. This contact remains unverified.': 'Chức năng gửi mã qua email và SMS chưa được thiết lập. Thông tin liên hệ này vẫn chưa được xác minh.',
    'Contact will be stored on this device. It will remain unverified until code delivery is configured.': 'Thông tin liên hệ sẽ được lưu trên thiết bị này và chưa được xác minh cho đến khi chức năng gửi mã được thiết lập.',
    'Privacy & Activity': 'Quyền riêng tư & Hoạt động',
    'Privacy check': 'Kiểm tra quyền riêng tư',
    'Review where account details are stored': 'Xem nơi lưu trữ thông tin tài khoản',
    'On device': 'Trên thiết bị',
    'Privacy center': 'Trung tâm quyền riêng tư',
    'Activity log': 'Nhật ký hoạt động',
    'Content preferences': 'Tùy chọn nội dung',
    'Device connection': 'Kết nối thiết bị',
    'Local API': 'API nội bộ',
    'SQLite database bridge': 'Cầu nối cơ sở dữ liệu SQLite',
    'Lock device': 'Thiết bị khóa',
    'Connect this app and the ESP32-CAM to the local API on the same Wi-Fi network.': 'Kết nối ứng dụng và ESP32-CAM với API nội bộ trên cùng mạng Wi-Fi.',
    'API address': 'Địa chỉ API',
    'Shared API token': 'Mã token API dùng chung',
    'Enter the token configured on the server and ESP32-CAM': 'Nhập token đã cấu hình trên máy chủ và ESP32-CAM',
    'Save connection': 'Lưu kết nối',
    'Test connection': 'Kiểm tra kết nối',
    'Not connected': 'Chưa kết nối',
    'No registered devices yet.': 'Chưa có thiết bị nào được đăng ký.',
    'No events stored yet.': 'Chưa có sự kiện nào được lưu.',
    'face_recognized': 'nhận diện khuôn mặt thành công',
    'face_enrolled': 'đã thêm khuôn mặt',
    'face_denied': 'khuôn mặt bị từ chối',
    'door_unlocked': 'đã mở khóa cửa',
    'authorized': 'được phép',
    'enrolled': 'đã đăng ký',
    'denied': 'bị từ chối',
    'unknown': 'không xác định',
    'Connection settings saved on this device.': 'Đã lưu cấu hình kết nối trên thiết bị này.',
    'Connecting to the local API...': 'Đang kết nối đến API nội bộ...',
    'Enter and save the local API address and token first.': 'Trước tiên, hãy nhập và lưu địa chỉ API nội bộ cùng token.',
    'The API token must contain at least 24 characters.': 'Token API phải có ít nhất 24 ký tự.',
    'Enter only the API origin, for example http://192.168.1.20:8766.': 'Chỉ nhập địa chỉ gốc của API, ví dụ http://192.168.1.20:8766.',
    'Dark mode': 'Chế độ tối',
    'Use a darker appearance across the app': 'Sử dụng giao diện tối cho toàn bộ ứng dụng',
    'Language': 'Ngôn ngữ',
    'Choose the language used throughout the app.': 'Chọn ngôn ngữ hiển thị trong toàn bộ ứng dụng.',
    'Vietnamese': 'Tiếng Việt',
    'Active Device Scope': 'Phạm vi thiết bị đang hoạt động',
    '1 Lock Connected': '1 khóa đang kết nối',
    'Select lock': 'Chọn khóa',
    'Front Door': 'Cửa trước',
    'Back Door': 'Cửa sau',
    'Garage Entry': 'Cửa nhà để xe',
    'Master': 'Chính',
    'Patio': 'Sân hiên',
    'Utility': 'Phụ trợ',
    'Interior': 'Trong nhà',
    'Thread Mesh Online': 'Mạng Thread đang hoạt động',
    '88% Healthy': '88% Bình thường',
    'Authentication Methods': 'Phương thức xác thực',
    'Credentials': 'Thông tin xác thực',
    'Manage Registered Faces (2 Enrolled)': 'Quản lý khuôn mặt đã đăng ký (2)',
    'PIN Password': 'Mã PIN',
    '8-Digit Master PIN (••••••••)': 'Mã PIN chính gồm 8 chữ số (••••••••)',
    'Change': 'Thay đổi',
    'RFID Key Card': 'Thẻ khóa RFID',
    '2 Cards Paired (Family, Guest)': 'Đã ghép nối 2 thẻ (Gia đình, Khách)',
    'Manage': 'Quản lý',
    'Guest Temporary Pass': 'Mã tạm thời cho khách',
    'Create One-Time or Scheduled Code': 'Tạo mã dùng một lần hoặc theo lịch',
    'Door Automation & Behavior': 'Tự động hóa và hoạt động của cửa',
    'Hardware': 'Phần cứng',
    'Auto-Lock': 'Tự động khóa',
    'Engage deadbolt after closing': 'Tự động chốt khóa sau khi cửa đóng',
    'DELAY DURATION': 'THỜI GIAN CHỜ',
    'Passage Mode': 'Chế độ ra vào',
    'Keep unlocked during events or deliveries': 'Giữ khóa mở khi có sự kiện hoặc giao hàng',
    'Forced Entry & Tamper Alarm': 'Cảnh báo đột nhập và phá hoại',
    'Forced Entry and Tamper Alarm': 'Cảnh báo đột nhập và phá hoại',
    'Trigger 90dB internal siren on violent intrusion': 'Kích hoạt còi báo động 90 dB khi phát hiện đột nhập',
    'Notifications & Alerts': 'Thông báo và cảnh báo',
    'Telemetry': 'Dữ liệu thiết bị',
    'Lock & Unlock Events': 'Sự kiện khóa và mở khóa',
    'Lock and Unlock Events': 'Sự kiện khóa và mở khóa',
    'Push updates on manual or digital toggles': 'Gửi thông báo khi khóa được thao tác thủ công hoặc qua ứng dụng',
    'Failed Attempt Alerts': 'Cảnh báo lần thử không hợp lệ',
    'Immediate priority banner after 3 false codes': 'Hiển thị cảnh báo ưu tiên sau 3 lần nhập mã sai',
    'Low Battery Warning': 'Cảnh báo pin yếu',
    'Notify threshold at 20% remaining': 'Thông báo khi pin còn 20%',
    'Hardware Diagnostics': 'Chẩn đoán phần cứng',
    'Specs': 'Thông số',
    'Firmware Version': 'Phiên bản firmware',
    'ESP32-CAM • Connected device': 'ESP32-CAM • Thiết bị đã kết nối',
    'Network': 'Mạng',
    'Local Wi-Fi connection': 'Kết nối Wi-Fi nội bộ',
    'Run Lock Self-Test': 'Kiểm tra khóa',
    'Connected to SQLite API': 'Đã kết nối API SQLite',
    'Reboot Gateway Hub': 'Khởi động lại Gateway',
    'Unpair Door Lock': 'Hủy ghép nối khóa cửa',
    'device(s)': 'thiết bị',
    'recent event(s).': 'sự kiện gần đây.',
    'Testing Actuator...': 'Đang kiểm tra bộ truyền động...',
    'Motor alignment & deadbolt torque nominal.': 'Căn chỉnh mô-tơ và lực chốt khóa bình thường.',
    'PASS': 'ĐẠT',
    'Home': 'Trang chủ',
    'Activity': 'Hoạt động',
    'Perimeter Online': 'Hệ thống an ninh trực tuyến',
    'Hello,': 'Xin chào,',
    'you': 'bạn',
    'House Overview': 'Tổng quan ngôi nhà',
    'Zone A': 'Khu vực A',
    'Perimeter Master': 'Trung tâm an ninh',
    'Dual-band Thread network active across all entry points.': 'Mạng Thread băng tần kép đang hoạt động tại mọi lối vào.',
    'Lock All Doors': 'Khóa tất cả cửa',
    'All Locked': 'Đã khóa tất cả',
    'Nodes': 'Nút mạng',
    'Thread': 'Thread',
    'Mesh OK': 'Ổn định',
    'Power': 'Nguồn điện',
    'Healthy': 'Bình thường',
    'Doors': 'Cửa',
    'Doors - Add Device Modal': 'Cửa - Thêm thiết bị',
    'Sort options': 'Tùy chọn sắp xếp',
    'Status': 'Trạng thái',
    'Add new door lock': 'Thêm khóa cửa mới',
    'Main Entryway': 'Lối vào chính',
    'Garden Access': 'Lối vào vườn',
    'Breezeway Link': 'Lối nối hành lang',
    'Secured': 'Đã khóa',
    'Unlocked': 'Đã mở khóa',
    'Unlock': 'Mở khóa',
    'Lock': 'Khóa',
    'Access': 'Ra vào',
    'Keypad Active': 'Bàn phím đang hoạt động',
    'RFID Card Active': 'Thẻ RFID đang hoạt động',
    'Auto-lock paused • Opened 4m ago': 'Tạm dừng tự động khóa • Đã mở 4 phút trước',
    'Locked automatically at 08:30 AM': 'Đã tự động khóa lúc 08:30',
    'Manually secured just now': 'Vừa khóa thủ công',
    'Unlocked manually just now': 'Vừa mở khóa thủ công',
    'Auto-Lock Perimeter Armed': 'Đã bật tự động khóa toàn bộ cửa',
    'All exterior doors automatically lock after 30s of inactivity.': 'Tất cả cửa bên ngoài sẽ tự động khóa sau 30 giây không hoạt động.',
    'Access Logs & Audit Trail': 'Nhật ký ra vào và lịch sử kiểm tra',
    'Real-time perimeter access verification across all gateways.': 'Xác minh ra vào theo thời gian thực trên tất cả cổng.',
    'Quick Status Overview': 'Tổng quan trạng thái nhanh',
    'Filter events': 'Lọc sự kiện',
    'Activity summary': 'Tổng kết hoạt động',
    'Today': 'Hôm nay',
    'Total events': 'Tổng số sự kiện',
    'Authorized': 'Được phép',
    'Alert': 'Cảnh báo',
    'Security flag': 'Cờ an ninh',
    'Filter activity': 'Lọc hoạt động',
    'All Doors': 'Tất cả cửa',
    'Garage': 'Nhà để xe',
    'Alerts & Denied': 'Cảnh báo và từ chối',
    'Activity timeline': 'Dòng thời gian hoạt động',
    'Today • Oct 24': 'Hôm nay • 24 tháng 10',
    'Yesterday • Oct 23': 'Hôm qua • 23 tháng 10',
    'Unlocked': 'Đã mở khóa',
    'Front Door • Facial Recognition': 'Cửa trước • Nhận diện khuôn mặt',
    'Auto-Lock Paused': 'Tự động khóa đang tạm dừng',
    'Warning': 'Cảnh báo',
    'Back Door held open for 4m': 'Cửa sau đã mở trong 4 phút',
    'Sensor Triggered': 'Cảm biến được kích hoạt',
    'Unknown Face': 'Khuôn mặt không xác định',
    'Denied': 'Bị từ chối',
    '3 failed biometric attempts at Front Door': '3 lần xác thực sinh trắc học không thành công tại cửa trước',
    'Perimeter Flag': 'Cảnh báo an ninh',
    'Security camera snapshot of the front porch': 'Ảnh chụp camera an ninh tại hiên cửa trước',
    'Snapshot Recorded': 'Đã ghi ảnh chụp',
    'HD Lens 1080p • Cam 01': 'Ống kính HD 1080p • Camera 01',
    'Front Door • Auto-Lock schedule': 'Cửa trước • Lịch tự động khóa',
    'Scheduled Protocol': 'Lịch đã đặt',
    'Family Card': 'Thẻ gia đình',
    'Front Door • NFC Keycard #04': 'Cửa trước • Thẻ NFC #04',
    'Locked remotely via iOS App': 'Đã khóa từ xa qua ứng dụng iOS',
    'Mobile Actuator': 'Bộ truyền động di động',
    'PIN Keypad entry • Guest Pass': 'Nhập mã PIN • Mã dành cho khách',
    'One-time Code #992': 'Mã dùng một lần #992',
    'Export 30-Day Audit (.CSV)': 'Xuất nhật ký 30 ngày (.CSV)',
    'Now': 'Vừa xong',
    'Review': 'Xem lại',
    'Viewed': 'Đã xem',
    'Garage Entry • Master PIN Keypad': 'Cửa nhà để xe • Bàn phím mã PIN chính',
    'Pin #1 (Permanent)': 'Mã PIN số 1 (Vĩnh viễn)',
    'Access Denied': 'Từ chối truy cập',
    'Logs': 'Nhật ký',
    'Sign In': 'Đăng nhập',
    'Sign Up': 'Đăng ký',
    'Welcome Back': 'Chào mừng trở lại',
    'Sign in to manage your perimeter and smart door locks.': 'Đăng nhập để quản lý hệ thống an ninh và khóa cửa thông minh.',
    'Demo account': 'Tài khoản dùng thử',
    'Email:': 'Email:',
    'Password:': 'Mật khẩu:',
    'Fill': 'Điền',
    'Email or Vault ID': 'Email hoặc mã Vault',
    'Required': 'Bắt buộc',
    'Master Password': 'Mật khẩu chính',
    'Enter your password': 'Nhập mật khẩu',
    'Show password': 'Hiện mật khẩu',
    'Hide password': 'Ẩn mật khẩu',
    'Remember device': 'Ghi nhớ thiết bị',
    'Forgot Password?': 'Quên mật khẩu?',
    'Log In': 'Đăng nhập',
    'Opening Home...': 'Đang mở trang chủ...',
    'Instant Scan': 'Quét ngay',
    'Security Key': 'Khóa bảo mật',
    'Tap or FIDO2': 'Chạm hoặc dùng FIDO2',
    'Secure Door Control': 'Điều khiển khóa cửa an toàn',
    'Perimeter Secure': 'An ninh chu vi',
    'Demo only • No server authentication': 'Chỉ dùng thử • Chưa có xác thực máy chủ',
    'Enter a valid email address, such as name@example.com.': 'Hãy nhập địa chỉ email hợp lệ, ví dụ name@example.com.',
    'Enter your email address.': 'Hãy nhập địa chỉ email.',
    'Enter your password.': 'Hãy nhập mật khẩu.',
    'Email or password is incorrect. Use the demo account shown above.': 'Email hoặc mật khẩu không chính xác. Hãy dùng tài khoản mẫu ở trên.',
    'Could not save the account on this device. Check browser storage settings.': 'Không thể lưu tài khoản trên thiết bị này. Hãy kiểm tra cài đặt lưu trữ của trình duyệt.',
    'Demo account accepted. Opening Home...': 'Đã chấp nhận tài khoản mẫu. Đang mở trang chủ...',
    'Security Key sign-in is not configured in this demo.': 'Đăng nhập bằng khóa bảo mật chưa được thiết lập trong bản dùng thử này.',
    'Password recovery is not configured in this demo.': 'Chức năng khôi phục mật khẩu chưa được thiết lập trong bản dùng thử này.',
    "Don't have an account?": 'Chưa có tài khoản?',
    'Create Account': 'Tạo tài khoản',
    'Back to sign in': 'Quay lại đăng nhập',
    'Perimeter Enrollment': 'Đăng ký hệ thống an ninh',
    'Set up an administrator profile to manage your smart locks and access settings.': 'Tạo hồ sơ quản trị viên để quản lý khóa thông minh và cài đặt ra vào.',
    'Primary Household Admin': 'Quản trị viên chính',
    'Verified role': 'Vai trò đã xác minh',
    'Tier 0 Security Clearance': 'Cấp độ bảo mật 0',
    'Full Name': 'Họ và tên',
    'Email Address': 'Địa chỉ email',
    'At least 8 characters': 'Ít nhất 8 ký tự',
    'Too short': 'Quá ngắn',
    'Good password': 'Mật khẩu khá',
    'Strong password': 'Mật khẩu mạnh',
    'Create a password': 'Tạo mật khẩu',
    'Confirm Master Password': 'Xác nhận mật khẩu chính',
    'Re-enter your password': 'Nhập lại mật khẩu',
    'Passwords match': 'Mật khẩu khớp',
    'I agree to the Perimeter Security Protocols and End-User License Agreement.': 'Tôi đồng ý với Quy trình bảo mật và Thỏa thuận cấp phép người dùng cuối.',
    'Have a Physical Gateway Hub?': 'Bạn có bộ điều khiển Gateway?',
    'Scan QR Code on Door Lock Box': 'Quét mã QR trên hộp khóa cửa',
    'Already have an account?': 'Đã có tài khoản?',
    'Gateway QR registration is not configured in this demo.': 'Đăng ký bằng mã QR Gateway chưa được thiết lập trong bản dùng thử này.',
    'Account registration is not configured. No account was created.': 'Chức năng đăng ký tài khoản chưa được thiết lập. Chưa có tài khoản nào được tạo.',
    'The passwords do not match.': 'Mật khẩu không khớp.',
    'Accept the security protocols and user agreement to continue.': 'Hãy chấp nhận quy trình bảo mật và thỏa thuận người dùng để tiếp tục.',
    'Use a password with at least 8 characters.': 'Hãy dùng mật khẩu có ít nhất 8 ký tự.',
    'Enter a valid email address.': 'Hãy nhập địa chỉ email hợp lệ.',
    'Add New Lock': 'Thêm khóa mới',
    'Delete': 'Xóa',
    'Delete lock': 'Xóa khóa',
    'Edit': 'Sửa',
    'Edit lock': 'Chỉnh sửa khóa',
    'Edit Lock': 'Chỉnh sửa khóa',
    'Configure New Lock': 'Cấu hình khóa mới',
    'Add a lock to this device.': 'Thêm khóa vào thiết bị này.',
    'Update the lock name and location on this device.': 'Cập nhật tên và vị trí khóa trên thiết bị này.',
    'Add lock': 'Thêm khóa',
    'Save changes': 'Lưu thay đổi',
    'This lock is no longer saved on this device.': 'Khóa này không còn được lưu trên thiết bị này.',
    'Permanently delete this lock?': 'Xác nhận xóa vĩnh viễn khóa này?',
    'This will permanently remove': 'Thao tác này sẽ xóa vĩnh viễn',
    'from this device. This action cannot be undone.': 'khỏi thiết bị này. Hành động này không thể hoàn tác.',
    'Cancel': 'Hủy bỏ',
    'Delete permanently': 'Xác nhận xóa',
    'The lock could not be deleted. Check storage and try again.': 'Không thể xóa khóa. Hãy kiểm tra bộ nhớ rồi thử lại.',
    'No locks added': 'Chưa có khóa nào',
    'No Locks Added': 'Chưa có khóa',
    'Add your first lock': 'Thêm khóa đầu tiên',
    'Tap to configure a new door device': 'Chạm để cấu hình khóa cửa mới',
    'Enter a lock name.': 'Hãy nhập tên khóa.',
    'Choose a location.': 'Hãy chọn vị trí.',
    'Select at least one authentication method.': 'Hãy chọn ít nhất một phương thức xác thực.',
    'PIN setup': 'Thiết lập mã PIN',
    'PIN is required to add a lock.': 'Bắt buộc thiết lập PIN để thêm khóa.',
    'Change saved PIN': 'Đổi mã PIN đã lưu',
    'New PIN (6-8 digits)': 'Mã PIN mới (6-8 chữ số)',
    'Confirm PIN': 'Xác nhận mã PIN',
    'A PIN is already saved. Keep it or choose to change it.': 'PIN đã được lưu. Giữ nguyên hoặc chọn đổi PIN.',
    'Create a 6 to 8 digit PIN to secure this lock.': 'Tạo PIN gồm 6-8 chữ số để bảo vệ khóa.',
    'PIN must contain 6 to 8 digits.': 'PIN phải có 6-8 chữ số.',
    'PIN entries do not match.': 'Hai mã PIN không khớp.',
    'Secure PIN storage is unavailable in this browser.': 'Trình duyệt không hỗ trợ lưu PIN an toàn.',
    'A lock with this name already exists.': 'Đã có khóa trùng tên này.',
    'The lock could not be saved on this device. Check storage and try again.': 'Không thể lưu khóa trên thiết bị này. Hãy kiểm tra bộ nhớ rồi thử lại.',
    'Setup required': 'Cần thiết lập',
    'Added just now': 'Vừa thêm',
    'Front Entrance': 'Cửa chính',
    'Living Room': 'Phòng khách',
    'Office': 'Văn phòng',
    'Bring device close to phone or door frame': 'Đưa thiết bị lại gần điện thoại hoặc khung cửa',
    'Close modal': 'Đóng cửa sổ',
    'Scanning nearby hardware...': 'Đang quét thiết bị phần cứng ở gần...',
    '2 devices ready for authentication': '2 thiết bị sẵn sàng xác thực',
    '2 Found': 'Tìm thấy 2 thiết bị',
    'Available Hardware': 'Thiết bị phần cứng khả dụng',
    'Rescan': 'Quét lại',
    'Smart Lock Series 4': 'Khóa thông minh Series 4',
    'New': 'Mới',
    'BLE Signal: -45 dBm': 'Tín hiệu BLE: -45 dBm',
    'Ready to pair': 'Sẵn sàng ghép nối',
    'Model SL-402': 'Mẫu SL-402',
    'Thread Mesh': 'Mạng Thread',
    'Pair Now': 'Ghép nối ngay',
    'Door Contact Sensor v2': 'Cảm biến tiếp xúc cửa v2',
    'Zigbee 3.0 / Matter': 'Zigbee 3.0 / Matter',
    'Beacon active': 'Đèn hiệu đang hoạt động',
    'Model CS-21': 'Mẫu CS-21',
    'Ultra-Low Power': 'Siêu tiết kiệm điện',
    'Other Onboarding Options': 'Các cách thiết lập khác',
    'Scan QR Setup Code': 'Quét mã thiết lập QR',
    'Scan QR': 'Quét QR',
    'Setup Code': 'mã thiết lập',
    'NFC Tap to Cylinder': 'Chạm NFC vào ổ khóa',
    'NFC Tap': 'Chạm NFC',
    'to Cylinder': 'vào ổ khóa',
    'Enter Code Manually': 'Nhập mã thủ công',
    'Enter Code': 'Nhập mã',
    'Manually': 'thủ công',
    "Can't find your lock? Put lock into": 'Không tìm thấy khóa? Hãy chuyển khóa sang',
    'Pairing Mode': 'Chế độ ghép nối',
    'Done Adding Devices': 'Hoàn tất thêm thiết bị',
    'House Overview • Zone A': 'Tổng quan ngôi nhà • Khu vực A',
    '1 Unlocked': '1 khóa đang mở',
    'Main Entryway • 88% Battery': 'Lối vào chính • Pin 88%'
  };

  const originalTexts = new WeakMap();
  const originalAttributes = new WeakMap();
  const reverseTranslations = new Map(
    Object.entries(translations).map(([english, vietnamese]) => [vietnamese, english])
  );
  let currentLanguage = 'vi';

  function readSavedLanguage() {
    try {
      const savedLanguage = localStorage.getItem(languageStorageKey);
      return savedLanguage === 'en' || savedLanguage === 'vi' ? savedLanguage : 'vi';
    } catch (error) {
      console.error('Could not read the saved language preference.', error);
      return 'vi';
    }
  }

  function translateText(source) {
    if (translations[source]) return translations[source];

    let match = source.match(/^All (\d+) Secured$/);
    if (match) return `Đã khóa an toàn cả ${match[1]} cửa`;
    match = source.match(/^(\d+) Door(s?) Unsecured$/);
    if (match) return `${match[1]} cửa chưa được khóa`;
    match = source.match(/^(\d+) Lock(s?)$/);
    if (match) return `${match[1]} khóa`;
    match = source.match(/^(\d+) Found$/);
    if (match) return `Tìm thấy ${match[1]} thiết bị`;
    match = source.match(/^(\d+) devices ready for authentication$/);
    if (match) return `${match[1]} thiết bị sẵn sàng xác thực`;
    match = source.match(/^(\d+) Logs?$/);
    if (match) return `${match[1]} nhật ký`;
    match = source.match(/^(\d+)m ago$/);
    if (match) return `${match[1]} phút trước`;
    match = source.match(/^(\d+)h ago$/);
    if (match) return `${match[1]} giờ trước`;
    match = source.match(/^(\d+)s ago$/);
    if (match) return `${match[1]} giây trước`;
    match = source.match(/^Verify (email address|phone number)$/);
    if (match) return `Xác minh ${match[1] === 'email address' ? 'địa chỉ email' : 'số điện thoại'}`;
    match = source.match(/^Save (email address|phone number)$/);
    if (match) return `Lưu ${match[1] === 'email address' ? 'địa chỉ email' : 'số điện thoại'}`;
    match = source.match(/^Complete the (.+) field\.$/);
    if (match) return `Hãy điền trường ${translateText(match[1])}.`;
    match = source.match(/^(\d+) failed biometric attempts at Front Door$/);
    if (match) return `${match[1]} lần xác thực sinh trắc học không thành công tại cửa trước`;
    match = source.match(/^Connected to SQLite API • (\d+) device\(s\) • (\d+) recent event\(s\)\.$/);
    if (match) return `Đã kết nối API SQLite • ${match[1]} thiết bị • ${match[2]} sự kiện gần đây.`;
    match = source.match(/^Cannot reach the API at (.+)\. Check the server, Wi-Fi, and firewall\.$/);
    if (match) return `Không thể kết nối API tại ${match[1]}. Hãy kiểm tra máy chủ, Wi-Fi và tường lửa.`;
    match = source.match(/^The API returned an invalid response \(HTTP (\d+)\)\.$/);
    if (match) return `API trả về phản hồi không hợp lệ (HTTP ${match[1]}).`;
    match = source.match(/^Devices: (.+)$/);
    if (match) return `Thiết bị: ${match[1]}`;
    match = source.match(/^Updated (.+)\.$/);
    if (match) return `Đã cập nhật ${match[1]}.`;
    match = source.match(/^Device IDs: (.+)$/);
    if (match) return `Mã thiết bị: ${match[1]}`;
    match = source.match(/^Camera connected: (.+)\. Waiting for video\.\.\.$/);
    if (match) return `Đã kết nối camera ${match[1]}. Đang chờ video...`;
    match = source.match(/^Camera connected: (.+)\. (STREAMING|DETECTING)$/);
    if (match) return `Đã kết nối camera ${match[1]}. ${match[2] === 'STREAMING' ? 'Đang truyền video' : 'Đang nhận diện'}.`;
    match = source.match(/^Connecting to (.+)\.\.\.$/);
    if (match) return `Đang kết nối đến ${match[1]}...`;
    match = source.match(/^Cannot load cameras: (.+)$/);
    if (match) return `Không tải được camera: ${translateText(match[1])}`;
    match = source.match(/^SAMPLE NUMBER (\d+) FOR (.+)$/);
    if (match) return `Mẫu số ${match[1]} cho ${match[2]}`;
    match = source.match(/^FACE CAPTURED FOR (.+)$/);
    if (match) return `Đã đăng ký khuôn mặt cho ${match[1]}`;
    match = source.match(/^Enrollment started for (.+)\. Look at the camera\.$/);
    if (match) return `Bắt đầu đăng ký ${match[1]}. Hãy nhìn vào camera.`;
    match = source.match(/^Removing (.+)\.\.\.$/);
    if (match) return `Đang xóa ${match[1]}...`;
    match = source.match(/^Remove face "(.+)" from this camera\?$/);
    if (match) return `Xóa khuôn mặt "${match[1]}" khỏi camera này?`;
    match = source.match(/^Latest database event: ([^;]+); subject=([^;]+); result=(.+)$/);
    if (match) {
      return `Sự kiện mới nhất trong cơ sở dữ liệu: ${translateText(match[1])}; người dùng=${match[2]}; kết quả=${translateText(match[3])}`;
    }

    return source;
  }

  function translateNode(node) {
    const record = originalTexts.get(node);
    let source = record ? record.source : node.data;
    if (record && node.data !== record.translated && node.data !== record.source) {
      source = node.data;
    }

    const leadingWhitespace = source.match(/^\s*/)?.[0] || '';
    const trailingWhitespace = source.match(/\s*$/)?.[0] || '';
    const content = source.slice(leadingWhitespace.length, source.length - trailingWhitespace.length);
    const translatedContent = currentLanguage === 'vi'
      ? translateText(content)
      : reverseTranslations.get(content) || content;
    const translated = `${leadingWhitespace}${translatedContent}${trailingWhitespace}`;
    originalTexts.set(node, { source, translated });
    if (node.data !== translated) node.data = translated;
  }

  function translateAttribute(element, name) {
    if (!element.hasAttribute(name)) return;
    let records = originalAttributes.get(element);
    if (!records) {
      records = new Map();
      originalAttributes.set(element, records);
    }

    const record = records.get(name);
    const currentValue = element.getAttribute(name);
    let source = record ? record.source : currentValue;
    if (record && currentValue !== record.translated && currentValue !== record.source) {
      source = currentValue;
    }
    const translated = currentLanguage === 'vi' ? translateText(source) : source;
    records.set(name, { source, translated });
    if (currentValue !== translated) element.setAttribute(name, translated);
  }

  function translateSubtree(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      const parent = root.parentElement;
      if (parent && !parent.closest('script, style, code, .material-symbols-outlined, [data-language-ignore]')) {
        const source = root.data.trim();
        if (source) translateNode(root);
      }
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root !== document) return;
    const element = root.nodeType === Node.ELEMENT_NODE ? root : null;
    if (element?.matches('script, style, code, .material-symbols-outlined, [data-language-ignore]')) return;

    if (element) {
      ['aria-label', 'placeholder', 'title'].forEach(name => {
        if (element.hasAttribute(name)) translateAttribute(element, name);
      });
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          return node.parentElement?.closest('script, style, code, .material-symbols-outlined, [data-language-ignore]')
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    let node;
    while ((node = walker.nextNode())) {
      if (node.data.trim()) translateNode(node);
    }

    if (element) {
      element.querySelectorAll('[aria-label], [placeholder], [title]').forEach(child => {
        ['aria-label', 'placeholder', 'title'].forEach(name => {
          if (child.hasAttribute(name)) translateAttribute(child, name);
        });
      });
    } else {
      document.querySelectorAll('[aria-label], [placeholder], [title]').forEach(child => {
        ['aria-label', 'placeholder', 'title'].forEach(name => {
          if (child.hasAttribute(name)) translateAttribute(child, name);
        });
      });
    }
  }

  function updateLanguageControls() {
    document.querySelectorAll('[data-language-select]').forEach(select => {
      select.value = currentLanguage;
      const label = currentLanguage === 'vi' ? 'Chọn ngôn ngữ' : 'Choose language';
      if (select.getAttribute('aria-label') !== label) {
        select.setAttribute('aria-label', label);
      }
    });
  }

  function setLanguage(language) {
    if (language !== 'vi' && language !== 'en') return;
    currentLanguage = language;
    window.appLanguage = language;
    document.documentElement.lang = language;
    try {
      localStorage.setItem(languageStorageKey, language);
    } catch (error) {
      console.error('Could not save the language preference.', error);
    }
    translateSubtree(document);
    updateLanguageControls();
  }

  currentLanguage = readSavedLanguage();
  document.documentElement.lang = currentLanguage;
  window.appLanguage = currentLanguage;
  window.setAppLanguage = setLanguage;

  document.addEventListener('change', event => {
    if (event.target.matches('[data-language-select]')) {
      setLanguage(event.target.value);
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    translateSubtree(document);
    updateLanguageControls();
  });

  new MutationObserver(records => {
    records.forEach(record => {
      if (record.type === 'characterData') {
        translateSubtree(record.target);
      } else if (record.type === 'attributes') {
        translateAttribute(record.target, record.attributeName);
      } else {
        record.addedNodes.forEach(node => translateSubtree(node));
      }
    });
    updateLanguageControls();
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['aria-label', 'placeholder', 'title'],
    characterData: true,
    childList: true,
    subtree: true
  });
})();
