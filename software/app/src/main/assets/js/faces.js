(function () {
  const maxFaces = 7;
  const sampleCount = 5;
  let elements = null;
  let socket = null;
  let selectedDevice = null;
  let discoveredDevices = [];
  let frameUrl = null;
  let connected = false;
  let enrolling = false;
  let enrolledNames = new Set();
  let apiUsers = new Map();
  let apiUsersLoaded = false;
  let enrollmentName = '';
  let enrollmentFaceId = '';
  let cancelPending = false;
  const pendingApiSync = new Set();
  let refreshInProgress = false;

  function getElements() {
    const ids = [
      'face-sensor-state', 'face-device-name', 'face-camera-badge',
      'face-memory-count', 'face-memory-bar', 'face-memory-summary',
      'face-memory-summary-bar',       'face-storage-state', 'face-device-list',
      'face-connect-camera', 'face-refresh-devices', 'face-camera-status',
      'face-camera-image', 'face-camera-placeholder', 'face-carousel',
      'carousel-counter', 'face-saved-count', 'face-person-name', 'face-enrollment-id',
      'face-enroll-button', 'face-cancel-enrollment', 'face-progress-label',
      'face-progress-value', 'face-sample-bar', 'face-scan-ring',
      'face-mode-esp32', 'face-mode-phone', 'face-esp32-panel', 'face-phone-panel',
      'face-phone-biometric-status', 'face-phone-biometric-register',
      'face-phone-biometric-test', 'face-phone-biometric-remove'
    ];
    const found = {};
    for (const id of ids) {
      found[id] = document.getElementById(id);
      if (!found[id]) throw new Error(`Face ID view is missing #${id}.`);
    }
    return found;
  }

  function setStatus(message, isError = false) {
    if (!elements) return;
    elements['face-camera-status'].textContent = message;
    elements['face-camera-status'].classList.toggle('is-error', isError);
  }

  function setPhoneBiometricStatus(message, isError = false) {
    const status = elements['face-phone-biometric-status'];
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  async function updatePhoneBiometricState() {
    const registerButton = elements['face-phone-biometric-register'];
    const testButton = elements['face-phone-biometric-test'];
    const removeButton = elements['face-phone-biometric-remove'];
    try {
      const authenticated = localStorage.getItem('face-door-authenticated') === 'true';
      const savedCredential = window.smartDoorBiometric.getSavedCredential();
      const available = await window.smartDoorBiometric.isAvailable();
      const belongsToCurrentUser = savedCredential
        && savedCredential.loginEmail === localStorage.getItem('face-door-login-email');
      if (!available) {
        setPhoneBiometricStatus(
          'Sinh trắc học cần thiết bị có hỗ trợ passkey và kết nối HTTPS hoặc localhost. Dữ liệu khuôn mặt trên điện thoại không được gửi đến khóa.'
        );
      } else if (!authenticated) {
        setPhoneBiometricStatus('Hãy đăng nhập vào ứng dụng trước khi đăng ký sinh trắc học.');
      } else if (savedCredential && !belongsToCurrentUser) {
        setPhoneBiometricStatus('Thiết bị đã liên kết với tài khoản khác. Hãy gỡ liên kết trước khi đăng ký tài khoản này.', true);
      } else if (savedCredential) {
        setPhoneBiometricStatus(`Đã liên kết Face ID hoặc vân tay cho ${savedCredential.loginEmail}.`);
      } else {
        setPhoneBiometricStatus('Chưa đăng ký Face ID hoặc vân tay trên thiết bị này.');
      }
      registerButton.disabled = !available || !authenticated || Boolean(savedCredential);
      testButton.hidden = !savedCredential || !belongsToCurrentUser;
      testButton.disabled = !available || !authenticated;
      removeButton.hidden = !savedCredential;
      removeButton.disabled = !authenticated;
    } catch (error) {
      setPhoneBiometricStatus(
        error.message || 'Không thể đọc cấu hình sinh trắc học trên thiết bị.',
        true
      );
      registerButton.disabled = true;
      testButton.disabled = true;
      removeButton.disabled = true;
    }
  }

  function setFaceMode(mode) {
    const usePhone = mode === 'phone';
    if (usePhone && connected) {
      closeCamera('Đã ngắt camera khóa khi chuyển sang xác thực điện thoại.');
    }
    const activeButton = usePhone
      ? elements['face-mode-phone']
      : elements['face-mode-esp32'];
    const inactiveButton = usePhone
      ? elements['face-mode-esp32']
      : elements['face-mode-phone'];
    activeButton.setAttribute('aria-selected', 'true');
    inactiveButton.setAttribute('aria-selected', 'false');
    activeButton.classList.add(
      'bg-surface-container-lowest',
      'text-on-surface',
      'shadow-sm',
      'font-semibold'
    );
    activeButton.classList.remove('text-on-surface-variant');
    inactiveButton.classList.remove(
      'bg-surface-container-lowest',
      'text-on-surface',
      'shadow-sm',
      'font-semibold'
    );
    inactiveButton.classList.add('text-on-surface-variant');
    elements['face-esp32-panel'].hidden = usePhone;
    elements['face-esp32-panel'].classList.toggle('hidden', usePhone);
    elements['face-phone-panel'].hidden = !usePhone;
    elements['face-phone-panel'].classList.toggle('hidden', !usePhone);
    if (usePhone) updatePhoneBiometricState();
  }

  function setProgress(sample, label) {
    const bounded = Math.min(sampleCount, Math.max(0, sample));
    const percentage = Math.round((bounded / sampleCount) * 100);
    elements['face-progress-label'].textContent = label;
    elements['face-progress-value'].textContent = `${bounded} / ${sampleCount}`;
    elements['face-sample-bar'].style.width = `${percentage}%`;
    elements['face-scan-ring'].setAttribute('stroke-dashoffset', `${289 - (289 * percentage / 100)}`);
  }

  function setFrame(blob) {
    if (frameUrl) URL.revokeObjectURL(frameUrl);
    frameUrl = URL.createObjectURL(blob);
    elements['face-camera-image'].src = frameUrl;
    elements['face-camera-image'].hidden = false;
    elements['face-camera-placeholder'].hidden = true;
  }

  function clearFrame() {
    if (frameUrl) URL.revokeObjectURL(frameUrl);
    frameUrl = null;
    elements['face-camera-image'].removeAttribute('src');
    elements['face-camera-image'].hidden = true;
    elements['face-camera-placeholder'].hidden = false;
  }

  function updateSummary() {
    const count = enrolledNames.size;
    elements['face-memory-count'].textContent = `${count} / ${maxFaces}`;
    elements['face-memory-bar'].style.width = `${(count / maxFaces) * 100}%`;
    elements['face-memory-summary'].textContent = `${count} / ${maxFaces}`;
    elements['face-memory-summary-bar'].style.width = `${(count / maxFaces) * 100}%`;
    elements['face-storage-state'].textContent = connected ? 'ĐÃ KẾT NỐI' : 'OFFLINE';
    elements['carousel-counter'].textContent = `${count} / ${maxFaces}`;
    elements['face-saved-count'].textContent = `Đã lưu (${count})`;
    const canEnroll = connected && count < maxFaces && !enrolling && !cancelPending;
    elements['face-enroll-button'].disabled = !canEnroll;
    elements['face-person-name'].disabled = !canEnroll;
    elements['face-enrollment-id'].disabled = !canEnroll;
    elements['face-cancel-enrollment'].disabled = !connected || !enrolling;
  }

  function createButton(text, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.addEventListener('click', onClick);
    return button;
  }

  function renderDevices() {
    const container = elements['face-device-list'];
    container.replaceChildren();
    if (discoveredDevices.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.className = 'rounded-xl bg-surface-container-low p-space-sm font-body-sm text-body-sm text-on-surface-variant';
      emptyState.textContent = 'Chưa tìm thấy ESP32-CAM. Hãy bật thiết bị trên cùng mạng với API rồi quét lại.';
      container.append(emptyState);
      return;
    }

    for (const device of discoveredDevices) {
      const isSelected = selectedDevice?.device_id === device.device_id;
      const card = document.createElement('div');
      card.className = `flex items-center gap-3 rounded-xl border p-space-sm ${
        isSelected ? 'border-primary bg-primary-container/30' : 'border-outline-variant/50 bg-surface-container-low'
      }`;

      const details = document.createElement('div');
      details.className = 'min-w-0 flex-1';
      const name = document.createElement('p');
      name.className = 'truncate font-label-md text-label-md font-semibold text-on-surface';
      name.textContent = device.device_id;
      const address = document.createElement('p');
      address.className = 'truncate font-body-sm text-body-sm text-on-surface-variant';
      address.textContent = device.ip_address || 'Chưa nhận được địa chỉ IP';
      details.append(name, address);

      const status = document.createElement('span');
      status.className = 'shrink-0 rounded-full bg-surface-container px-2 py-1 font-label-caps text-label-caps text-on-surface-variant';
      status.textContent = device.status === 'online' ? 'ONLINE' : 'OFFLINE';

      const selectButton = createButton(
        isSelected ? 'Đã chọn' : 'Chọn',
        'face-action-button face-secondary-button shrink-0',
        () => {
          if (!device.ip_address) {
            setStatus('Thiết bị chưa gửi địa chỉ IP. Kiểm tra kết nối mạng rồi quét lại.', true);
            return;
          }
          if (connected) closeCamera('Đã ngắt camera để đổi thiết bị.');
          selectedDevice = {
            device_id: device.device_id,
            ip_address: device.ip_address
          };
          enrolledNames = new Set();
          apiUsers = new Map();
          apiUsersLoaded = false;
          elements['face-device-name'].textContent = selectedDevice.device_id;
          elements['face-connect-camera'].disabled = false;
          elements['face-connect-camera'].textContent = 'Kết nối camera đã chọn';
          setStatus(`Đã chọn ${selectedDevice.device_id}.`);
          renderDevices();
          renderFaces();
        }
      );
      selectButton.disabled = isSelected || !device.ip_address;
      card.append(details, status, selectButton);
      container.append(card);
    }
  }

  function renderFaces() {
    updateSummary();
    const container = elements['face-carousel'];
    container.replaceChildren();

    if (enrolledNames.size === 0) {
      const empty = document.createElement('p');
      empty.className = 'face-empty-state';
      empty.textContent = connected
        ? 'Chưa có khuôn mặt nào trên camera này.'
        : 'Kết nối camera để tải danh sách khuôn mặt.';
      container.append(empty);
      return;
    }

    for (const faceId of enrolledNames) {
      const user = apiUsers.get(faceId);
      const card = document.createElement('article');
      card.className = 'face-profile-card';

      const heading = document.createElement('h3');
      heading.className = 'face-profile-name';
      heading.textContent = user?.display_name || faceId;
      card.append(heading);

      const identifier = document.createElement('p');
      identifier.className = 'face-profile-id';
      identifier.textContent = `Mã camera: ${faceId}`;
      card.append(identifier);

      const actions = document.createElement('div');
      actions.className = 'face-profile-actions';
      if (user) {
        const accessButton = createButton(
          user.face_enabled ? 'Tắt quyền mở cửa' : 'Cho phép mở cửa',
          'face-action-button face-secondary-button',
          async () => {
            accessButton.disabled = true;
            try {
              const updated = await window.smartDoorApi.updateFaceUser(
                user.user_id,
                { face_enabled: !user.face_enabled }
              );
              apiUsers.set(faceId, updated.user);
              renderFaces();
            } catch (error) {
              setStatus(error.message, true);
              accessButton.disabled = false;
            }
          }
        );
        actions.append(accessButton);
      }
      actions.append(createButton('Xóa khuôn mặt', 'face-action-button face-danger-button', async () => {
        if (!connected || !socket || socket.readyState !== WebSocket.OPEN) {
          setStatus('Kết nối camera trước khi xóa khuôn mặt.', true);
          return;
        }
        const removeButton = actions.querySelector('.face-danger-button');
        removeButton.disabled = true;
        try {
          if (user) {
            const updated = await window.smartDoorApi.updateFaceUser(
              user.user_id,
              { face_enabled: false }
            );
            apiUsers.set(faceId, updated.user);
          }
          socket.send(`remove:${faceId}`);
          setStatus(`Đã gửi yêu cầu xóa khuôn mặt ${faceId}.`);
        } catch (error) {
          setStatus(error.message, true);
          removeButton.disabled = false;
        }
      }));
      card.append(actions);
      container.append(card);
    }
  }

  function scheduleRender() {
    if (scheduleRender.timer) clearTimeout(scheduleRender.timer);
    scheduleRender.timer = setTimeout(renderFaces, 120);
  }

  async function syncUnknownFaces() {
    if (!apiUsersLoaded || !selectedDevice) return;
    for (const faceId of enrolledNames) {
      if (apiUsers.has(faceId)) continue;
      if (pendingApiSync.has(faceId)) continue;
      try {
        const result = await window.smartDoorApi.syncFaceUser(selectedDevice.device_id, faceId);
        apiUsers.set(faceId, result.user);
      } catch (error) {
        setStatus(`Đã tải danh sách nhưng đồng bộ API thất bại: ${error.message}`, true);
      }
    }
    renderFaces();
  }

  function processMessage(data) {
    if (data instanceof Blob) {
      setFrame(data);
      return;
    }
    if (data instanceof ArrayBuffer) {
      setFrame(new Blob([data], { type: 'image/jpeg' }));
      return;
    }
    if (typeof data !== 'string') return;

    if (data === 'delete_faces') {
      enrolledNames = new Set();
      scheduleRender();
      return;
    }
    if (data.startsWith('listface:')) {
      const faceId = data.slice('listface:'.length).trim();
      if (faceId) {
        enrolledNames.add(faceId);
        scheduleRender();
        syncUnknownFaces();
      }
      return;
    }
    if (data === 'CAPTURING') {
      if (cancelPending) return;
      enrolling = true;
      setProgress(0, 'Giữ khuôn mặt ở giữa khung hình.');
      renderFaces();
      return;
    }
    const sample = data.match(/^SAMPLE NUMBER\s+(\d+)\s+FOR\s+(.+)$/);
    if (sample) {
      if (cancelPending) return;
      enrolling = true;
      const current = Number(sample[1]);
      setProgress(current, enrollmentName
        ? `Đang quét ${enrollmentName}...`
        : `Đang quét ${sample[2].trim()}...`);
      renderFaces();
      return;
    }
    const captured = data.match(/^FACE CAPTURED FOR\s+(.+)$/);
    if (captured) {
      const faceId = captured[1].trim();
      if (!faceId) return;
      const displayName = enrollmentFaceId === faceId ? enrollmentName : '';
      enrolledNames.add(faceId);
      enrolling = false;
      cancelPending = false;
      setProgress(sampleCount, 'Đăng ký khuôn mặt thành công.');
      setStatus(`Đã đăng ký khuôn mặt ${faceId}; đang đồng bộ dữ liệu...`);
      pendingApiSync.add(faceId);
      renderFaces();
      (async () => {
        try {
          const result = await window.smartDoorApi.syncFaceUser(
            selectedDevice.device_id,
            faceId,
            displayName || undefined
          );
          apiUsers.set(faceId, result.user);
          renderFaces();
          setStatus(`Đã đăng ký và đồng bộ khuôn mặt ${faceId}.`);
        } catch (error) {
          setStatus(`Đã đăng ký trên camera nhưng đồng bộ API thất bại: ${error.message}`, true);
        } finally {
          pendingApiSync.delete(faceId);
          if (enrollmentFaceId === faceId) {
            enrollmentName = '';
            enrollmentFaceId = '';
          }
        }
      })();
      return;
    }
    if (data === 'STREAMING' || data === 'DETECTING') {
      elements['face-sensor-state'].textContent = 'Đã kết nối';
      if (cancelPending) {
        cancelPending = false;
        enrollmentName = '';
        enrollmentFaceId = '';
        renderFaces();
      }
      if (!enrolling) setProgress(0, 'Camera sẵn sàng để quét.');
      return;
    }
    if (data === 'NO FACE DETECTED' && enrolling) {
      setProgress(0, 'Đưa khuôn mặt vào trước camera.');
    }
  }

  function closeCamera(message = 'Đã ngắt kết nối camera.', isError = false) {
    if (enrolling && socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send('stream');
      } catch (error) {
        message = `Đã ngắt kết nối camera nhưng không thể hủy lệnh quét: ${error.message}`;
      }
    }
    connected = false;
    enrolling = false;
    cancelPending = false;
    enrollmentName = '';
    enrollmentFaceId = '';
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
      socket = null;
    }
    clearFrame();
    elements['face-camera-badge'].textContent = 'OFFLINE';
    elements['face-sensor-state'].textContent = 'Chưa kết nối';
    elements['face-device-name'].textContent = selectedDevice?.device_id || 'Chọn camera';
    elements['face-connect-camera'].textContent = 'Kết nối camera đã chọn';
    elements['face-connect-camera'].disabled = !selectedDevice?.ip_address;
    setProgress(0, 'Chờ camera sẵn sàng');
    setStatus(message, isError);
    renderDevices();
    renderFaces();
  }

  function connectCamera() {
    if (!selectedDevice || !selectedDevice.ip_address) {
      setStatus('Trước tiên, hãy chọn camera có địa chỉ IP.', true);
      return;
    }
    if (location.protocol === 'https:') {
      setStatus('Firmware camera dùng WebSocket không mã hóa. Hãy mở ứng dụng qua HTTP trên cùng mạng nội bộ.', true);
      return;
    }
    closeCamera('Đang kết nối camera...');
    const host = selectedDevice.ip_address.includes(':')
      ? `[${selectedDevice.ip_address}]`
      : selectedDevice.ip_address;
    const url = `ws://${host}:82/`;
    try {
      socket = new WebSocket(url);
    } catch (error) {
      setStatus(`Không thể mở kết nối camera: ${error.message}`, true);
      return;
    }
    elements['face-connect-camera'].disabled = true;
    socket.binaryType = 'blob';
    socket.onopen = async () => {
      if (!socket) return;
      connected = true;
      elements['face-connect-camera'].disabled = false;
      apiUsers = new Map();
      apiUsersLoaded = false;
      elements['face-camera-badge'].textContent = 'ONLINE';
      elements['face-sensor-state'].textContent = 'Đã kết nối';
      elements['face-device-name'].textContent = selectedDevice.device_id;
      elements['face-connect-camera'].textContent = 'Ngắt kết nối';
      setStatus(`Đã kết nối ${selectedDevice.device_id}. Đang tải khuôn mặt...`);
      socket.send('stream');
      renderFaces();
      try {
        const users = await window.smartDoorApi.getFaceUsers(selectedDevice.device_id);
        apiUsers = new Map(users.map(user => [user.face_id, user]));
        apiUsersLoaded = true;
        await syncUnknownFaces();
      } catch (error) {
        setStatus(`Camera đã kết nối nhưng đồng bộ API thất bại: ${error.message}`, true);
      }
    };
    socket.onmessage = event => processMessage(event.data);
    socket.onerror = () => {
      if (socket) {
        closeCamera('Kết nối camera thất bại. Hãy kiểm tra IP thiết bị và Wi-Fi.', true);
      }
    };
    socket.onclose = () => {
      if (socket) closeCamera('Kết nối camera đã đóng.');
    };
  }

  async function loadCameras() {
    if (refreshInProgress) return;
    refreshInProgress = true;
    if (connected) closeCamera('Đang tải lại danh sách camera.');
    elements['face-refresh-devices'].disabled = true;
    elements['face-connect-camera'].disabled = true;
    setStatus('Đang quét ESP32-CAM từ API nội bộ...');
    try {
      const status = await window.smartDoorApi.getStatus();
      const devices = Array.isArray(status.devices) ? status.devices : [];
      discoveredDevices = devices.filter(device => device && device.device_id);
      if (discoveredDevices.length === 0) {
        const hadSelectedDevice = selectedDevice !== null;
        selectedDevice = null;
        elements['face-device-name'].textContent = 'Chọn camera';
        enrolledNames = new Set();
        apiUsers = new Map();
        apiUsersLoaded = false;
        if (hadSelectedDevice) renderFaces();
        elements['face-connect-camera'].disabled = true;
        renderDevices();
        setStatus('Chưa có ESP32-CAM đăng ký với API nội bộ.', true);
      } else {
        const priorDeviceId = selectedDevice?.device_id;
        const selected = discoveredDevices.find(device => device.device_id === priorDeviceId)
          || discoveredDevices.find(device => device.ip_address)
          || null;
        selectedDevice = {
          device_id: selected?.device_id || '',
          ip_address: selected?.ip_address || ''
        };
        if (!selected) selectedDevice = null;
        elements['face-device-name'].textContent = selectedDevice?.device_id || 'Chọn camera';
        elements['face-connect-camera'].disabled = !selectedDevice?.ip_address;
        elements['face-connect-camera'].textContent = 'Kết nối camera đã chọn';
        if (priorDeviceId !== selectedDevice?.device_id) {
          enrolledNames = new Set();
          apiUsers = new Map();
          apiUsersLoaded = false;
          renderFaces();
        }
        renderDevices();
        setStatus(`Đã quét thấy ${discoveredDevices.length} thiết bị ESP32-CAM.`);
      }
    } catch (error) {
      selectedDevice = null;
      discoveredDevices = [];
      enrolledNames = new Set();
      apiUsers = new Map();
      apiUsersLoaded = false;
      elements['face-connect-camera'].disabled = true;
      elements['face-device-name'].textContent = 'Chọn camera';
      renderDevices();
      renderFaces();
      setStatus(error.message, true);
    } finally {
      elements['face-refresh-devices'].disabled = false;
      refreshInProgress = false;
    }
  }

  function handleEnroll() {
    const displayName = elements['face-person-name'].value.trim();
    const faceId = elements['face-enrollment-id'].value.trim();
    if (!displayName || displayName.length > 80) {
      setStatus('Nhập họ và tên hiển thị (tối đa 80 ký tự).', true);
      elements['face-person-name'].focus();
      return;
    }
    if (!/^[a-zA-Z0-9_-]{1,9}$/.test(faceId)) {
      setStatus('Mã khuôn mặt cần có 1–9 ký tự ASCII: chữ không dấu, số, gạch ngang hoặc gạch dưới.', true);
      elements['face-enrollment-id'].focus();
      return;
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setStatus('Kết nối camera trước khi đăng ký khuôn mặt.', true);
      return;
    }
    if (enrolling || cancelPending) {
      setStatus('Đang có một lượt quét. Hãy hoàn tất hoặc hủy lượt quét đó.', true);
      return;
    }
    if (enrolledNames.has(faceId)) {
      setStatus('Mã khuôn mặt này đã có trên camera. Hãy chọn mã khác.', true);
      return;
    }
    enrollmentName = displayName;
    enrollmentFaceId = faceId;
    cancelPending = false;
    try {
      socket.send(`capture:${faceId}`);
      enrolling = true;
      setProgress(0, 'Đang bắt đầu quét khuôn mặt...');
      renderFaces();
      setStatus('Giữ khuôn mặt trước camera và làm theo hướng dẫn.');
    } catch (error) {
      enrollmentName = '';
      enrollmentFaceId = '';
      setStatus(`Không thể bắt đầu quét: ${error.message}`, true);
    }
  }

  function initFacesView() {
    elements = getElements();
    if (initFacesView.initialized) {
      loadCameras();
      return;
    }
    initFacesView.initialized = true;

    elements['face-mode-esp32'].addEventListener('click', () => setFaceMode('esp32'));
    elements['face-mode-phone'].addEventListener('click', () => setFaceMode('phone'));
    elements['face-phone-biometric-register'].addEventListener('click', async () => {
      const accountName = localStorage.getItem('face-door-account-name') || 'Admin';
      const loginEmail = localStorage.getItem('face-door-login-email') || '';
      const button = elements['face-phone-biometric-register'];
      button.disabled = true;
      try {
        await window.smartDoorBiometric.register(accountName, loginEmail);
        setPhoneBiometricStatus('Đã đăng ký sinh trắc học. Lần đăng nhập sau, chọn Face ID / vân tay.');
      } catch (error) {
        setPhoneBiometricStatus(
          error.message || 'Không thể đăng ký sinh trắc học trên thiết bị.',
          true
        );
      } finally {
        await updatePhoneBiometricState();
      }
    });
    elements['face-phone-biometric-test'].addEventListener('click', async () => {
      const button = elements['face-phone-biometric-test'];
      button.disabled = true;
      try {
        const credential = await window.smartDoorBiometric.authenticate();
        if (credential.loginEmail !== localStorage.getItem('face-door-login-email')) {
          throw new Error('Passkey thuộc một tài khoản khác trên thiết bị này.');
        }
        setPhoneBiometricStatus('Xác thực Face ID / vân tay thành công.');
      } catch (error) {
        setPhoneBiometricStatus(
          error.message || 'Không thể xác thực bằng sinh trắc học.',
          true
        );
      } finally {
        await updatePhoneBiometricState();
      }
    });
    elements['face-phone-biometric-remove'].addEventListener('click', () => {
      window.smartDoorBiometric.clearRegistration();
      setPhoneBiometricStatus('Đã gỡ liên kết passkey khỏi ứng dụng trên thiết bị này.');
      updatePhoneBiometricState();
    });
    elements['face-refresh-devices'].addEventListener('click', loadCameras);
    elements['face-connect-camera'].addEventListener('click', () => {
      if (connected) closeCamera();
      else connectCamera();
    });
    elements['face-enroll-button'].addEventListener('click', handleEnroll);
    elements['face-cancel-enrollment'].addEventListener('click', () => {
      if (socket?.readyState !== WebSocket.OPEN) {
        setStatus('Camera đã ngắt kết nối; không thể hủy lượt quét.', true);
        return;
      }
      try {
        socket.send('stream');
      } catch (error) {
        setStatus(`Không thể hủy lượt quét: ${error.message}`, true);
        return;
      }
      enrolling = false;
      cancelPending = true;
      setProgress(0, 'Đã hủy quét.');
      setStatus('Đã hủy quét.');
      renderFaces();
    });
    renderFaces();
    loadCameras();
  }

  function pauseFacesView() {
    if (socket) closeCamera('Đã ngắt camera khi rời Face ID.');
  }

  window.initFacesView = initFacesView;
  window.pauseFacesView = pauseFacesView;
})();
