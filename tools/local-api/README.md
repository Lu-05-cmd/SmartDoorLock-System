# SmartDoorLock local API and SQLite bridge

## Data flow

```text
ESP32-CAM ── HTTP POST + Bearer token ──┐
                                        ├── Local Python API ── SQLite
Android/WebView ── HTTP GET + Bearer ───┘
```

The firmware keeps face enrollment, matching, and relay decisions on the ESP32-CAM. It sends device heartbeats and event metadata to the API; it never uploads face images or biometric templates. The app reads the device and event records from the same API. The existing ESP32 camera/WebSocket interface on port `82` is unchanged.

The API is a local prototype, not a production security boundary. It uses HTTP on a trusted private Wi-Fi network. Do not expose port `8766` to the internet or use this token over a public/untrusted network. The app stores its token in WebView local storage, and the firmware token is compiled into the device. Use TLS, per-device credentials, token rotation, and a hardened identity service before production use.

## Start the server

From the repository root, create a random token with at least 24 characters and set the same value for the API and the ESP32-CAM:

```powershell
$token = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$env:SMARTDOOR_API_TOKEN = $token
python tools/local-api/server.py
```

The server binds to `0.0.0.0:8766` for connections from devices on the LAN. SQLite is created at `tools/local-api/smartdoor.sqlite3` by default and is ignored by Git. Set `SMARTDOOR_DATABASE` to choose another path. Restrict access to the port with Windows Firewall to the trusted Private network profile.

Find the computer's Wi-Fi IPv4 address with `ipconfig`, for example `192.168.1.20`.

## Connect the Android/WebView app

Open **Settings → Device connection** and enter:

- **API address:** `http://<computer-wifi-ip>:8766` (for example `http://192.168.1.20:8766`)
- **Shared API token:** the exact value of `SMARTDOOR_API_TOKEN`

Save the connection and choose **Test connection**. A successful check returns the number of known devices and recent events. The app uses the `appassets.androidplatform.net` secure origin, so the local HTTP connection is allowed in Android WebView compatibility mode; this is intentionally only for a trusted LAN prototype.

## Connect the ESP32-CAM firmware

Copy `hardware/esp32-camera/secrets.h.example` to `hardware/esp32-camera/secrets.h` and configure:

```cpp
#define WIFI_SSID "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"
#define API_BASE_URL "http://192.168.1.20:8766"
#define API_TOKEN "same-random-token-as-the-api"
#define DEVICE_ID "esp32cam-entry"
```

Flash the firmware and verify the serial output. The device reports a heartbeat at startup and every 30 seconds while the main loop runs. Enrollment, successful face recognition, unlock, and rate-limited denied-face events are queued on a FreeRTOS worker so HTTP timeouts do not block the camera loop or relay timing. If the API is unavailable, local recognition and relay behavior continue; telemetry is best-effort.

## API contract (version 1)

All protected routes require:

```http
Authorization: Bearer <SMARTDOOR_API_TOKEN>
Content-Type: application/json
```

### `GET /health`

Public process-health check; returns API status only.

### `POST /api/v1/devices/heartbeat`

```json
{
  "device_id": "esp32cam-entry",
  "ip_address": "192.168.1.30",
  "firmware_version": "1.0.0"
}
```

Upserts a device and marks it online. A new heartbeat updates `last_seen`.

### `POST /api/v1/events`

```json
{
  "device_id": "esp32cam-entry",
  "event_type": "face_recognized",
  "subject": "Admin",
  "result": "authorized"
}
```

Supported event types are `face_recognized`, `face_enrolled`, `face_denied`, and `door_unlocked`. A heartbeat must register the device before it can post events.

### `GET /api/v1/status`

Returns the registered devices and the ten newest event metadata records. `GET /api/v1/devices` and `GET /api/v1/events` return each collection separately.

### Face-user synchronization

`GET /api/v1/users?device_id=<device-id>` returns face-user metadata for one device. The app syncs a completed camera enrollment with `POST /api/v1/users`, including `device_id`, `face_id`, and the optional display name. Supplying a display name updates that user's label without changing its enabled/disabled access setting; omitting it preserves an existing label.

### SQLite schema

- `devices`: `device_id`, IP address, firmware version, online state, last-seen and created timestamps.
- `events`: event ID, device ID, event type, optional subject name, result and creation timestamp.
- Face images and biometric templates are deliberately excluded.

## Verify locally

```powershell
python -m unittest discover -s tools/local-api -v
```

These integration tests use a temporary SQLite database and an ephemeral loopback server; they do not contact hardware or the LAN.
