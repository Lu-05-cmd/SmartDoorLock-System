# Face Recognition Door Lock (ESP32-CAM)

Edge AI access control system that performs on-device face recognition and actuates a physical door lock in real time.

## Overview

This project is an embedded AI/ML system for secure physical access control using ESP32-CAM.
It is engineered as an end-to-end product pipeline, not only a face model demo.

It focuses on:
- On-device inference for privacy-preserving identity verification
- Real-time control flow from camera stream to relay actuation
- Persistent identity enrollment and management in flash memory

Primary use cases:
- Smart home and apartment entrance control
- Small office or lab room access management
- Low-cost edge access nodes where cloud inference is not acceptable

## Architecture

The system is split into an Android operator app and an ESP32-CAM hardware/firmware project. The Android app wraps the device's existing browser interface and connects over the local Wi-Fi network.

## Project Structure

- `app/`: Android Studio project and the downloadable APK workflow.
- `hardware/esp32-camera/`: ESP32-CAM firmware, device web interface, and Wi-Fi credential template.
- `hardware/assets/`: circuit files, setup guide, and architecture diagram.
- `tools/laptop-demo/`: optional laptop webcam demo; it does not control the ESP32 relay.

Runtime architecture flow:
- Android App or Browser Client <-> ESP32-CAM Node: sends commands and receives status/events over WebSocket
- Camera Capture -> Face Detection -> Face Recognition: real-time on-device vision pipeline
- Face Recognition <-> Flash Identity Store: enrolled identities are read/written in persistent flash
- Decision Logic -> Door Lock Actuator: recognition outcomes are translated into access decisions
- Door Lock Actuator -> Relay -> Unlock Timer + Auto-Lock Behavior: physical unlock is time-bounded and reset automatically

Design intent:
- Keep biometric processing and access decisions on-device for low latency and privacy
- Separate identity persistence from decision execution for predictable state recovery after reboot
- Isolate actuation timing logic to reduce lock-state errors in real deployments

## Architecture Diagram

![Face Recognition Door Lock Architecture](hardware/assets/Face%20Recognition%20Door%20Lock%20Architecture.png)

This diagram is placed directly under the architecture section so reviewers can understand system boundaries before implementation details.

Diagram description:
- Top-right block: Browser Client controls the system and receives runtime feedback.
- Center block: ESP32-CAM Node orchestrates all edge processing and control.
- Mid-layer blocks: Camera Capture, Face Detection, Face Recognition, Flash Identity Store, and Decision Logic represent the core runtime modules.
- Control branch: Decision Logic drives Door Lock Actuator for authorize/deny outcomes.
- Device branch: Door Lock Actuator fans out to Relay control and WebSocket event signaling.
- Safety branch: Relay state transitions are constrained by Unlock Timer and Auto-Lock Behavior.

## Features

- On-device face recognition with no cloud dependency
- Multi-mode operation: camera stream, face detect, user enroll, and access control
- Enrollment workflow with repeated confirmation samples for stability
- Persistent face database in flash (supports identity delete and full reset)
- Real-time browser feedback for detection and recognition states
- Relay-based door unlock with automatic timeout re-lock

## Technical Highlights

- Edge-first design: inference and access decisions execute directly on ESP32-CAM to reduce latency and protect biometric data
- Deterministic control logic: explicit finite-state transitions for reliable mode changes
- Resource-aware camera configuration: adapts frame settings when PSRAM is available
- Durable identity lifecycle: enrollment, lookup, single-delete, and delete-all operations integrated with flash persistence
- Safety-oriented door control: relay is auto-reset after a fixed unlock interval (`5000 ms`)
- Practical enrollment constraints: configurable identity capacity and confirmation count (`FACE_ID_SAVE_NUMBER`, `ENROLL_CONFIRM_TIMES`)

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Device Firmware | Arduino (C/C++) on ESP32-CAM |
| Vision/ML | ESP face detection and recognition modules (`fd_forward`, `fr_forward`, `fr_flash`) |
| Communication | HTTP server + WebSocket server |
| App | Android WebView controller for the ESP32-CAM interface |
| Device UI | Embedded HTML/CSS/JavaScript web interface |
| Hardware | ESP32-CAM (AI Thinker), OV2640 camera, relay module, electric door lock |
| Persistence | ESP32 flash storage for face identity records |

## Getting Started

### Hardware

- ESP32-CAM development board (AI Thinker)
- USB-to-TTL adapter (for flashing)
- Relay module (5V) and electric door lock
- Power supply and supporting components as defined in `hardware/assets/Circuit.fzz`

Reference assets:
- Circuit image: [hardware/assets/Circuit.jpg](hardware/assets/Circuit.jpg)
- Wiring source file: [hardware/assets/Circuit.fzz](hardware/assets/Circuit.fzz)
- Setup walkthrough: [hardware/assets/Getting Started.pdf](hardware/assets/Getting%20Started.pdf)

![Hardware Wiring Diagram](hardware/assets/Circuit.jpg)

### Software Prerequisites

- Arduino IDE
- ESP32 board package installed in Arduino IDE
- Required libraries used by the sketch (WebSocket and ESP32 camera/face stack)

### Build and Flash

```bash
git clone https://github.com/kershrita/Face-Recognition-Door-Lock.git
cd Face-Recognition-Door-Lock
```

1. Copy `hardware/esp32-camera/secrets.h.example` to `hardware/esp32-camera/secrets.h` and set your Wi-Fi credentials. The local credentials file is ignored by Git.
2. Open `hardware/esp32-camera/FaceDoorEntryESP32Cam.ino` in Arduino IDE.
3. Select ESP32-CAM board profile and correct upload port.
4. Flash firmware and open Serial Monitor at `115200` baud.
5. Copy the printed device IP and open it in a browser.

### Android App and APK

Open the `app/` directory in Android Studio and build the `app` debug variant, or push the repository to GitHub. The **Android APK** workflow builds `app-debug.apk` on every push and makes it available under the workflow run's **Artifacts** for 30 days. To attach an APK to a permanent GitHub Release, push a version tag such as `v1.0.0`; the workflow publishes the APK as a release asset.

```bash
git tag v1.0.0
git push origin v1.0.0
```

Install the APK on a phone connected to the same Wi-Fi network as the ESP32-CAM. Enter the device IP printed in Serial Monitor; the app remembers it and opens the firmware's existing control interface. This is a debug-signed APK intended for sideloading, not a Play Store release.

### Laptop Webcam Recognition Test

This standalone Python demo under `tools/laptop-demo/` uses the laptop webcam and OpenCV LBPH for local face enrollment and recognition. It does not connect to the ESP32-CAM or control the door relay. Recognition data is stored locally under `face_test_data/`; that directory is ignored by Git because it contains biometric data.

Install the test dependency and enroll a person:

```bash
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r tools/laptop-demo/requirements-laptop-test.txt
.\.venv\Scripts\python.exe tools/laptop-demo/laptop_camera_test.py --enroll "Person name"
```

After enrollment, run live recognition:

```bash
.\.venv\Scripts\python.exe tools/laptop-demo/laptop_camera_test.py
```

Press `q` in the webcam window to stop either mode. Enrollment takes 30 samples by default; use `--samples 40` to request a different number. LBPH is a basic demonstration recognizer and its match threshold may need tuning for the camera and lighting. Do not use this laptop demo as the sole mechanism for securing a physical door.

### Local Web Demo

To use the laptop camera from a browser, start the loopback-only web demo:

```powershell
.\.venv\Scripts\python.exe tools/laptop-demo/laptop_camera_web.py
```

Open `http://127.0.0.1:8765`. Enter a person's name and select **Đăng ký khuôn mặt**, then keep their face in the camera frame until enrollment completes. Select **Bật quét nhận diện** to simulate access for enrolled faces; the on-screen lock re-locks after five seconds. This local demo has no admin login and is intended only for use on the laptop; it does not drive a physical lock or relay. Face samples are stored locally in `face_test_data/web_data.npz`, which is ignored by Git.

### Runtime Workflow

1. Start camera stream from the UI.
2. Enroll authorized users with `ADD USER`.
3. Switch to `ACCESS CONTROL` mode.
4. Present a registered face to trigger unlock.

## Results

Current implementation delivers system-level outcomes:

- End-to-end on-device recognition and access decision pipeline
- Identity enrollment requiring multiple confirmation captures (`ENROLL_CONFIRM_TIMES = 5`)
- Configured identity capacity per device (`FACE_ID_SAVE_NUMBER = 7`)
- Automatic door re-lock after configured unlock window (`interval = 5000 ms`)
- Face identities remain available after reboot via flash persistence

Benchmark note:
- This repository currently demonstrates operational performance and deployment behavior.
- Standardized dataset metrics (accuracy, FAR/FRR, latency distributions) are not yet packaged in this repo.

## License

Released under the [MIT License](LICENSE)."# SmartDoorLock-System" 
