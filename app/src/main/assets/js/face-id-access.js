(function exposeFaceIdAccessOverlay() {
  window.initializeFaceIdAccessOverlay = async function initializeFaceIdAccessOverlay(
    overlay,
    { door, onCancel, onConfirm }
  ) {
    const sheet = overlay?.firstElementChild;
    const memberRegion = Array.from(sheet?.children || []).find(element =>
      element.textContent.includes('Thành viên cấp quyền'));
    const memberHeader = memberRegion?.firstElementChild;
    const selectAllButton = memberHeader?.querySelector('span:last-child');
    const addFaceButton = memberRegion?.querySelector('button');
    const actionButtons = Array.from(sheet?.querySelectorAll('button') || []);
    const confirmButton = actionButtons.find(button =>
      button.textContent.includes('Xác nhận & Cấp quyền Face ID'));
    const cancelButton = actionButtons.find(button =>
      button.textContent.includes('Để sau'));
    const registeredFaceCount = Array.from(sheet?.querySelectorAll('span') || [])
      .find(element => element.textContent.includes('/ 5 slot khả dụng'));
    const demoCards = Array.from(memberRegion?.children || []).filter(element =>
      element.classList.contains('p-3')
      && element.classList.contains('flex')
      && element.classList.contains('items-center'));
    let memberCards = [];

    if (!overlay || !memberRegion || !selectAllButton || !addFaceButton
        || !confirmButton || !cancelButton) {
      throw new Error('Giao diện cấp quyền Face ID chưa đầy đủ.');
    }

    function showStatus(message, canRetry = false) {
      let status = memberRegion.querySelector('[data-face-access-status]');
      if (!status) {
        status = document.createElement('div');
        status.dataset.faceAccessStatus = 'true';
        status.className = 'flex items-center justify-between gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        memberHeader.after(status);
      }
      status.replaceChildren();
      const messageText = document.createElement('span');
      messageText.textContent = message;
      status.append(messageText);
      if (canRetry) {
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'shrink-0 font-semibold text-blue-700 underline';
        retryButton.textContent = 'Tải lại';
        retryButton.addEventListener('click', loadFaceUsers);
        status.append(retryButton);
      }
    }

    function selectedFaces() {
      return memberCards.filter(card => card.getAttribute('aria-checked') === 'true')
        .map(card => ({
          deviceId: card.dataset.deviceId,
          faceId: card.dataset.faceId
        }));
    }

    function updateConfirmButton() {
      confirmButton.disabled = selectedFaces().length === 0;
      confirmButton.classList.toggle('opacity-50', confirmButton.disabled);
      confirmButton.classList.toggle('cursor-not-allowed', confirmButton.disabled);
      const allSelected = memberCards.length > 0
        && memberCards.every(card => card.getAttribute('aria-checked') === 'true');
      selectAllButton.textContent = allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả';
    }

    function setSelection(card, selected) {
      card.setAttribute('aria-checked', String(selected));
      card.classList.toggle('bg-blue-50/40', selected);
      card.classList.toggle('border-2', selected);
      card.classList.toggle('border-blue-600', selected);
      card.classList.toggle('bg-white', !selected);
      card.classList.toggle('border', !selected);
      card.classList.toggle('border-slate-200/90', !selected);
      const indicator = card.lastElementChild;
      indicator.className = selected
        ? 'grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white'
        : 'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-slate-300 text-xs text-white';
      indicator.textContent = selected ? '✓' : '';
      updateConfirmButton();
    }

    function makeMemberCard(user) {
      const card = document.createElement('div');
      card.className = 'p-3 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 flex items-center justify-between transition cursor-pointer';
      card.dataset.deviceId = user.device_id;
      card.dataset.faceId = user.face_id;
      card.setAttribute('role', 'checkbox');
      card.setAttribute('aria-checked', 'false');
      card.tabIndex = 0;

      const identity = document.createElement('div');
      identity.className = 'flex items-center space-x-3 min-w-0';
      const avatar = document.createElement('div');
      avatar.className = 'w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0';
      avatar.textContent = (user.display_name || user.face_id).slice(0, 2).toLocaleUpperCase();
      const details = document.createElement('div');
      details.className = 'min-w-0';
      const name = document.createElement('div');
      name.className = 'text-xs font-bold text-slate-900 truncate';
      name.textContent = user.display_name || user.face_id;
      const status = document.createElement('p');
      status.className = 'text-[11px] text-slate-500 mt-0.5 truncate';
      status.textContent = `${user.face_id} · ${user.device_id}`;
      details.append(name, status);
      identity.append(avatar, details);

      const indicator = document.createElement('div');
      indicator.className = 'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-slate-300 text-xs text-white';
      card.append(identity, indicator);
      card.addEventListener('click', () => {
        setSelection(card, card.getAttribute('aria-checked') !== 'true');
      });
      card.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        card.click();
      });
      return card;
    }

    function renderFaceUsers(users) {
      memberCards.forEach(card => card.remove());
      memberCards = users.map(makeMemberCard);
      memberCards.forEach(card => addFaceButton.before(card));

      const savedAccess = Array.isArray(door.faceAccess) ? door.faceAccess : [];
      const saved = new Set(savedAccess.map(face =>
        JSON.stringify([face.deviceId, face.faceId])));
      memberCards.forEach(card => {
        if (saved.has(JSON.stringify([card.dataset.deviceId, card.dataset.faceId]))) {
          setSelection(card, true);
        }
      });
      selectAllButton.hidden = users.length === 0;
      selectAllButton.classList.toggle('hidden', users.length === 0);
      if (registeredFaceCount) {
        registeredFaceCount.textContent = `${users.length} Face ID đã đăng ký`;
      }
      if (users.length === 0) {
        showStatus('Database chưa có Face ID nào. Hãy đăng ký khuôn mặt rồi tải lại danh sách.', true);
      } else {
        showStatus(`Đã tìm thấy ${users.length} Face ID. Chọn khuôn mặt được phép mở khóa.`);
      }
      updateConfirmButton();
    }

    async function loadFaceUsers() {
      confirmButton.disabled = true;
      demoCards.forEach(card => card.remove());
      if (registeredFaceCount) registeredFaceCount.textContent = 'Đang kiểm tra Face ID...';
      showStatus('Đang tải khuôn mặt đã đăng ký...');
      try {
        if (!window.smartDoorApi) throw new Error('API khuôn mặt chưa sẵn sàng.');
        const config = window.smartDoorApi.getConfig();
        if (!config.baseUrl || !config.token) {
          throw new Error('Chưa cấu hình địa chỉ và token API để tải Face ID.');
        }
        const deviceStatus = await window.smartDoorApi.getStatus();
        if (!Array.isArray(deviceStatus.devices)) {
          throw new Error('API không trả về danh sách camera hợp lệ.');
        }
        const devices = deviceStatus.devices.filter(device =>
          device && typeof device.device_id === 'string' && device.device_id);
        const byDevice = await Promise.all(devices.map(async device => ({
          deviceId: device.device_id,
          users: await window.smartDoorApi.getFaceUsers(device.device_id)
        })));
        const users = byDevice.flatMap(({ deviceId, users: registeredUsers }) =>
          registeredUsers
            .filter(user => user && typeof user.face_id === 'string' && user.face_id)
            .map(user => ({
              device_id: deviceId,
              face_id: user.face_id,
              display_name: typeof user.display_name === 'string' ? user.display_name : ''
            })));
        renderFaceUsers(users);
      } catch (error) {
        console.error('Could not load Face IDs for lock access.', error);
        memberCards.forEach(card => card.remove());
        memberCards = [];
        selectAllButton.hidden = true;
        selectAllButton.classList.add('hidden');
        if (registeredFaceCount) registeredFaceCount.textContent = 'Chưa xác định';
        showStatus(`Không tải được danh sách Face ID: ${error.message}`, true);
        updateConfirmButton();
      }
    }

    selectAllButton.addEventListener('click', () => {
      const shouldSelect = memberCards.some(card => card.getAttribute('aria-checked') !== 'true');
      memberCards.forEach(card => setSelection(card, shouldSelect));
    });
    selectAllButton.setAttribute('role', 'button');
    selectAllButton.tabIndex = 0;
    selectAllButton.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      selectAllButton.click();
    });
    confirmButton.disabled = true;
    confirmButton.addEventListener('click', async () => {
      const faces = selectedFaces();
      if (faces.length === 0) {
        showStatus('Hãy chọn ít nhất một khuôn mặt đã quét để cấp quyền.');
        return;
      }
      confirmButton.disabled = true;
      try {
        await onConfirm(faces);
      } catch (error) {
        console.error('Could not save Face ID access for the lock.', error);
        showStatus(`Không thể lưu khóa và quyền Face ID: ${error.message}`);
        updateConfirmButton();
      }
    });
    cancelButton.addEventListener('click', onCancel);
    const description = sheet.children[2]?.querySelector('p');
    if (description) {
      description.textContent = `Cấp quyền nhận diện khuôn mặt cho khóa "${door.name}".`;
    }
    await loadFaceUsers();
  };
})();
