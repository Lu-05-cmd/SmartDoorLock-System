const smartDoorAppAssetsBaseUrl = new URL(
  '../',
  document.currentScript?.src || document.baseURI
);

window.initSmartLocks = function initSmartLocks() {
  const doorList = document.getElementById('door-list');
  const emptyLockState = document.getElementById('empty-lock-state');
  const lockAllBtn = document.getElementById('lock-all-btn');
  const overviewBadge = document.getElementById('overview-badge');
  const overviewStatusText = document.getElementById('overview-status-text');
  const doorCount = document.getElementById('door-count');
  const lockCount = document.getElementById('lock-count');
  const addDoorButton = document.getElementById('add-door-btn');
  const addDoorLoadError = document.getElementById('add-door-load-error');
  const deleteConfirmDialog = document.getElementById('delete-confirm-dialog');
  const deleteConfirmName = document.getElementById('delete-confirm-name');
  const deleteConfirmError = document.getElementById('delete-confirm-error');
  const confirmDeleteButton = document.getElementById('confirm-lock-delete');
  const cancelDeleteButton = document.getElementById('cancel-lock-delete');
  const addedDoorsStorageKey = 'face-door-added-doors';
  const defaultAuthMethods = ['pin'];
  const authMethodDefinitions = {
    pin: { icon: 'dialpad', label: 'Keypad Active' },
    rfid: { icon: 'contactless', label: 'RFID Card Active' },
    face: { icon: 'face', label: 'Face ID Active' }
  };
  let pendingDelete;
  let editingDoorId;
  if (!doorList || !lockAllBtn || !overviewBadge || !overviewStatusText) return;
  if (doorList.dataset.smartLocksInitialized === 'true') return;
  doorList.dataset.smartLocksInitialized = 'true';

  function getDoorCards() {
    return doorList.querySelectorAll('.door-card');
  }

  function setAuthMethodEnabled(option, enabled) {
    option.setAttribute('aria-pressed', String(enabled));
    option.classList.toggle('border-2', enabled);
    option.classList.toggle('border-blue-600', enabled);
    option.classList.toggle('bg-blue-50', enabled);
    option.classList.toggle('shadow-xs', enabled);
    option.classList.toggle('border', !enabled);
    option.classList.toggle('border-slate-200', !enabled);
    option.classList.toggle('bg-white', !enabled);
    option.classList.toggle('hover:border-slate-300', !enabled);

    const indicator = option.querySelector('.auth-method-indicator');
    if (indicator) {
      indicator.hidden = !enabled;
      indicator.classList.toggle('hidden', !enabled);
    }
  }

  function updatePinSettings(dialog, authMethodOptions, hasSavedPinCredential) {
    const pinEnabled = authMethodOptions.some(option =>
      option.dataset.authMethod === 'pin'
      && option.getAttribute('aria-pressed') === 'true');
    const pinHeading = dialog.querySelector('#pin-credential-heading');
    const pinStatus = dialog.querySelector('#pin-credential-status');
    const pinAction = dialog.querySelector('#open-pin-setup');
    if (!pinEnabled) {
      pinHeading.textContent = 'Mã PIN (không bắt buộc)';
      pinStatus.textContent = 'PIN đang tắt. Chọn phương thức PIN nếu muốn thiết lập.';
      pinAction.hidden = true;
      pinAction.classList.add('hidden');
      return;
    }

    if (hasSavedPinCredential) {
      pinHeading.textContent = 'Mã PIN';
      pinStatus.textContent = 'Mã PIN đã được thiết lập.';
      pinAction.textContent = 'Đổi mã PIN';
      pinAction.hidden = false;
      pinAction.classList.remove('hidden');
      return;
    }

    pinHeading.textContent = 'Mã PIN';
    pinStatus.textContent = 'Sẽ yêu cầu thiết lập mã PIN khi lưu khóa.';
    pinAction.textContent = 'Thêm mã PIN';
    pinAction.hidden = true;
    pinAction.classList.add('hidden');
  }

  function renderAuthMethodIcons(container, authMethods) {
    const selectedMethods = Array.isArray(authMethods) ? authMethods : defaultAuthMethods;
    const definitions = selectedMethods
      .map(method => authMethodDefinitions[method])
      .filter(Boolean);

    container.replaceChildren();
    definitions.forEach((definition, index) => {
      if (index > 0) {
        const separator = document.createElement('span');
        separator.className = 'w-1 h-1 rounded-full bg-outline-variant';
        separator.setAttribute('aria-hidden', 'true');
        container.append(separator);
      }

      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined text-[16px] text-on-surface';
      icon.title = definition.label;
      icon.setAttribute('aria-label', definition.label);
      icon.textContent = definition.icon;
      container.append(icon);
    });
  }

  async function createPinCredential(pin) {
    if (!window.smartDoorPinCrypto) {
      throw new Error('Không tải được mô-đun lưu mã PIN an toàn. Hãy tải lại trang và thử lại.');
    }
    return window.smartDoorPinCrypto.createPinCredential(pin);
  }

  function updateHouseOverview() {
    let lockedCount = 0;
    const doorCards = getDoorCards();
    const total = doorCards.length;

    doorCards.forEach(card => {
      if (card.getAttribute('data-locked') === 'true') {
        lockedCount++;
      }
    });

    if (emptyLockState) {
      emptyLockState.hidden = total > 0;
      emptyLockState.classList.toggle('hidden', total > 0);
    }

    if (total === 0) {
      overviewStatusText.textContent = 'No locks added';
      overviewBadge.className = 'px-2 py-0.5 rounded-full bg-surface-container text-on-surface text-label-md font-label-md flex items-center gap-1';
      overviewBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-outline-variant"></span><span>No locks added</span>';
      lockAllBtn.disabled = true;
      lockAllBtn.classList.add('opacity-50', 'cursor-not-allowed');
      lockAllBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">lock</span><span>No Locks Added</span>';
    } else if (lockedCount === total) {
      lockAllBtn.disabled = false;
      lockAllBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      overviewStatusText.textContent = `All ${total} Secured`;
      overviewBadge.className = 'px-2 py-0.5 rounded-full bg-surface-container text-on-surface text-label-md font-label-md flex items-center gap-1';
      overviewBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-primary"></span><span>All ${total} Secured</span>`;
      lockAllBtn.classList.add('opacity-80');
      lockAllBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]" style="font-variation-settings: \'FILL\' 1;">check_circle</span><span>All Locked</span>';
    } else {
      lockAllBtn.disabled = false;
      lockAllBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      const unsecured = total - lockedCount;
      overviewStatusText.textContent = `${unsecured} ${unsecured === 1 ? 'Door' : 'Doors'} Unsecured`;
      overviewBadge.className = 'px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-label-md font-label-md flex items-center gap-1';
      overviewBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-error animate-pulse"></span><span>${unsecured} ${unsecured === 1 ? 'Door' : 'Doors'} Unsecured</span>`;
      lockAllBtn.classList.remove('opacity-80');
      lockAllBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]" style="font-variation-settings: \'FILL\' 1;">lock</span><span>Lock All Doors</span>';
    }

    if (doorCount) doorCount.textContent = `(${total})`;
    if (lockCount) lockCount.textContent = `${total} ${total === 1 ? 'Lock' : 'Locks'}`;
  }

  function setDoorLockState(card, isLocked) {
    card.setAttribute('data-locked', isLocked ? 'true' : 'false');
    const iconWrapper = card.querySelector('.status-icon-wrapper');
    const doorIcon = card.querySelector('.door-icon');
    const badge = card.querySelector('.status-badge');
    const toggleBtn = card.querySelector('.door-toggle-btn');
    const activityText = card.querySelector('.activity-text');

    if (isLocked) {
      iconWrapper.className = 'status-icon-wrapper w-11 h-11 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface transition-colors';
      doorIcon.textContent = 'lock';
      doorIcon.style.fontVariationSettings = "'FILL' 1";

      badge.className = 'status-badge px-2.5 py-1 rounded-full bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-1.5';
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-primary"></span><span class="badge-text">Secured</span>';

      toggleBtn.className = 'door-toggle-btn h-9 px-4 rounded-lg bg-surface-container text-on-surface font-label-lg text-label-lg active:scale-95 transition-all flex items-center gap-1.5';
      toggleBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">lock_open</span><span class="toggle-text">Unlock</span>';

      if (activityText) {
        activityText.textContent = 'Manually secured just now';
      }
    } else {
      iconWrapper.className = 'status-icon-wrapper unlocked-state-icon w-11 h-11 rounded-lg flex items-center justify-center transition-colors';
      doorIcon.textContent = 'lock_open';
      doorIcon.style.fontVariationSettings = "'FILL' 0";

      badge.className = 'status-badge unlocked-state-badge px-2.5 py-1 rounded-full font-label-md text-label-md flex items-center gap-1.5';
      badge.innerHTML = '<span class="unlocked-state-dot w-1.5 h-1.5 rounded-full animate-pulse"></span><span class="badge-text">Unlocked</span>';

      toggleBtn.className = 'door-toggle-btn h-9 px-4 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg active:scale-95 transition-all flex items-center gap-1.5 shadow-sm';
      toggleBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">lock</span><span class="toggle-text">Lock</span>';

      if (activityText) {
        activityText.textContent = 'Unlocked manually just now';
      }
    }

    updateHouseOverview();
  }

  function bindDoorCard(card) {
    const toggleBtn = card.querySelector('.door-toggle-btn');
    toggleBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      const currentlyLocked = card.getAttribute('data-locked') === 'true';
      setDoorLockState(card, !currentlyLocked);
    });

    let cardShell = card.parentElement;
    if (!cardShell?.classList.contains('door-card-swipe')) {
      cardShell = document.createElement('div');
      cardShell.className = 'door-card-swipe';
      if (card.parentNode) card.before(cardShell);
      cardShell.append(card);
    }

    let deleteButton = cardShell.querySelector('.door-card-delete');
    if (!deleteButton) {
      deleteButton = document.createElement('button');
      deleteButton.className = 'door-card-delete';
      deleteButton.type = 'button';
      deleteButton.tabIndex = -1;
      deleteButton.setAttribute('aria-label', 'Delete lock');
      deleteButton.title = 'Delete lock';
      deleteButton.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">delete</span><span>Delete</span>';
      cardShell.insertBefore(deleteButton, card);
    }

    let editButton = cardShell.querySelector('.door-card-edit');
    if (!editButton) {
      editButton = document.createElement('button');
      editButton.className = 'door-card-edit';
      editButton.type = 'button';
      editButton.tabIndex = -1;
      editButton.setAttribute('aria-label', 'Edit lock');
      editButton.title = 'Edit lock';
      editButton.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">edit</span><span>Edit</span>';
      cardShell.insertBefore(editButton, card);
    }

    let swipeStart;
    const setSwipeActionVisible = action => {
      const showDelete = action === 'delete';
      const showEdit = action === 'edit';
      cardShell.classList.toggle('is-delete-revealed', showDelete);
      cardShell.classList.toggle('is-edit-revealed', showEdit);
      deleteButton.tabIndex = showDelete ? 0 : -1;
      editButton.tabIndex = showEdit ? 0 : -1;
    };

    card.tabIndex = 0;
    card.addEventListener('pointerdown', event => {
      if (event.target.closest('button')) {
        swipeStart = undefined;
        return;
      }
      swipeStart = { x: event.clientX, y: event.clientY };
    });
    card.addEventListener('pointerup', event => {
      if (!swipeStart) return;
      const deltaX = event.clientX - swipeStart.x;
      const deltaY = event.clientY - swipeStart.y;
      swipeStart = undefined;

      if (Math.abs(deltaY) > 40) return;
      const deleteIsVisible = cardShell.classList.contains('is-delete-revealed');
      const editIsVisible = cardShell.classList.contains('is-edit-revealed');
      if (deltaX < -48) {
        setSwipeActionVisible(editIsVisible ? null : 'delete');
      } else if (deltaX > 48) {
        setSwipeActionVisible(deleteIsVisible ? null : 'edit');
      }
    });
    card.addEventListener('pointercancel', () => {
      swipeStart = undefined;
    });
    card.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const action = cardShell.classList.contains('is-edit-revealed') ? null : 'delete';
        setSwipeActionVisible(action);
        if (action) deleteButton.focus();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        const action = cardShell.classList.contains('is-delete-revealed') ? null : 'edit';
        setSwipeActionVisible(action);
        if (action) editButton.focus();
      } else if (event.key === 'Escape') {
        setSwipeActionVisible(null);
      }
    });

    editButton.addEventListener('click', () => {
      try {
        const doorId = card.id.slice('door-card-'.length);
        const door = readAddedDoors().find(savedDoor => savedDoor.id === doorId);
        if (!door) throw new Error('The lock is no longer saved on this device.');
        setSwipeActionVisible(null);
        openAddDoorDialog(door);
      } catch (error) {
        console.error('Could not open the lock editor.', error);
        if (addDoorLoadError) {
          addDoorLoadError.textContent = error.message;
          addDoorLoadError.classList.remove('hidden');
        }
      }
    });

    deleteButton.addEventListener('click', () => {
      if (!deleteConfirmDialog) return;
      pendingDelete = { card, cardShell };
      if (deleteConfirmName) deleteConfirmName.textContent = card.dataset.name || 'this lock';
      if (deleteConfirmError) {
        deleteConfirmError.textContent = '';
        deleteConfirmError.hidden = true;
        deleteConfirmError.classList.add('hidden');
      }
      deleteConfirmDialog.showModal();
      cancelDeleteButton?.focus();
    });

    return cardShell;
  }

  function closeDeleteConfirmation() {
    pendingDelete = undefined;
    deleteConfirmDialog?.close();
  }

  function confirmPendingDelete() {
    if (!pendingDelete) return;

    const { card, cardShell } = pendingDelete;
    try {
      const doorId = card.id.slice('door-card-'.length);
      const updatedDoors = readAddedDoors().filter(door => door.id !== doorId);
      localStorage.setItem(addedDoorsStorageKey, JSON.stringify(updatedDoors));
      pendingDelete = undefined;
      deleteConfirmDialog?.close();
      cardShell.remove();
      updateHouseOverview();
      addDoorButton?.focus();
    } catch (error) {
      console.error('Could not delete the lock.', error);
      if (deleteConfirmError) {
        deleteConfirmError.textContent = 'The lock could not be deleted. Check storage and try again.';
        deleteConfirmError.hidden = false;
        deleteConfirmError.classList.remove('hidden');
      }
    }
  }

  confirmDeleteButton?.addEventListener('click', confirmPendingDelete);
  cancelDeleteButton?.addEventListener('click', closeDeleteConfirmation);
  deleteConfirmDialog?.addEventListener('cancel', () => {
    pendingDelete = undefined;
  });
  deleteConfirmDialog?.addEventListener('click', event => {
    if (event.target === deleteConfirmDialog) closeDeleteConfirmation();
  });

  function createDoorCard(door) {
    const card = document.createElement('article');
    card.className = 'door-card bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm transition-all';
    card.id = `door-card-${door.id}`;
    card.dataset.name = door.name;
    card.dataset.authMethods = JSON.stringify(door.authMethods || defaultAuthMethods);
    card.dataset.locked = 'true';

    const header = document.createElement('div');
    header.className = 'flex items-start justify-between';

    const main = document.createElement('div');
    main.className = 'flex items-center gap-space-sm';

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'status-icon-wrapper w-11 h-11 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface transition-colors';
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined text-[24px] door-icon';
    icon.style.fontVariationSettings = "'FILL' 1";
    icon.textContent = 'lock';
    iconWrapper.append(icon);

    const copy = document.createElement('div');
    const title = document.createElement('h4');
    title.className = 'font-headline-sm text-headline-sm text-on-surface';
    title.textContent = door.name;
    const location = document.createElement('p');
    location.className = 'door-location font-body-sm text-body-sm text-secondary flex items-center gap-1 mt-0.5';
    location.textContent = door.location;
    copy.append(title, location);
    main.append(iconWrapper, copy);

    const badge = document.createElement('span');
    badge.className = 'status-badge px-2.5 py-1 rounded-full bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-1.5';
    badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-primary"></span><span class="badge-text">Secured</span>';
    header.append(main, badge);

    const controls = document.createElement('div');
    controls.className = 'flex items-center justify-between gap-2 pt-1';
    const accessMethods = document.createElement('div');
    accessMethods.className = 'flex items-center gap-2 min-w-0';
    const accessLabel = document.createElement('span');
    accessLabel.className = 'font-label-caps text-label-caps text-secondary uppercase';
    accessLabel.textContent = 'Access';
    const methodIcons = document.createElement('div');
    methodIcons.className = 'door-auth-methods flex items-center gap-1.5 bg-surface-container-low px-2 py-1 rounded-md';
    methodIcons.setAttribute('aria-label', 'Selected access methods');
    renderAuthMethodIcons(methodIcons, door.authMethods);
    accessMethods.append(accessLabel, methodIcons);
    const toggle = document.createElement('button');
    toggle.className = 'door-toggle-btn h-9 px-4 rounded-lg bg-surface-container text-on-surface font-label-lg text-label-lg active:scale-95 transition-all flex items-center gap-1.5';
    toggle.type = 'button';
    toggle.innerHTML = '<span class="material-symbols-outlined text-[18px]">lock_open</span><span class="toggle-text">Unlock</span>';
    controls.append(accessMethods, toggle);

    const activity = document.createElement('div');
    activity.className = 'mt-1 pt-2 bg-surface-container-low/60 rounded-lg px-2.5 py-1.5 flex items-center justify-between';
    const activityText = document.createElement('span');
    activityText.className = 'activity-text font-body-sm text-body-sm text-secondary truncate';
    activityText.textContent = 'Added just now';
    activity.append(activityText);

    card.append(header, controls, activity);
    return bindDoorCard(card);
  }

  function readAddedDoors() {
    const storedDoors = localStorage.getItem(addedDoorsStorageKey);
    if (!storedDoors) return [];

    const doors = JSON.parse(storedDoors);
    if (!Array.isArray(doors) || doors.some(door => (
      !door
      || typeof door.id !== 'string'
      || typeof door.name !== 'string'
      || typeof door.location !== 'string'
    ))) {
      throw new Error('Saved door list is invalid.');
    }
    return doors;
  }

  async function loadAddDoorDialog() {
    const response = await fetch(
      new URL('add-door.html', smartDoorAppAssetsBaseUrl),
      { cache: 'no-store' }
    );
    if (!response.ok) {
      throw new Error(`Không tải được giao diện thêm cửa (HTTP ${response.status}).`);
    }

    const documentTemplate = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );
    const sourceSheet = documentTemplate.querySelector(
      '[data-purpose="add-device-modal-sheet"]'
    );
    const sourcePinDialog = documentTemplate.querySelector(
      '[data-purpose="pin-setup-dialog"]'
    );
    if (!sourceSheet) {
      throw new Error('The add-door sheet is missing from add-door.html.');
    }
    if (!sourcePinDialog) {
      throw new Error('The PIN setup sheet is missing from add-door.html.');
    }

    documentTemplate.querySelectorAll(
      'style[data-purpose="sheet-animations"]'
    ).forEach(sourceStyle => {
      const style = document.createElement('style');
      style.dataset.addDoorStyle = sourceStyle.dataset.purpose;
      style.textContent = sourceStyle.textContent;
      document.head.append(style);
    });

    const dialog = document.createElement('dialog');
    dialog.id = 'add-door-dialog';
    dialog.className = 'account-dialog add-door-sheet-dialog';
    dialog.setAttribute('aria-label', 'Add New Lock');
    dialog.append(document.importNode(sourceSheet, true));
    document.body.append(dialog);
    document.body.append(document.importNode(sourcePinDialog, true));
    return dialog;
  }

  function bindAddDoorDialog(dialog) {
    let faceAccessOverlay;
    let isClosingAddDoor = false;
    let isClosingPinSetup = false;
    let faceAccessClosePromise;
    let pinSetupClosePromise;
    const addDoorSheet = dialog.querySelector('[data-purpose="add-device-modal-sheet"]');

    function waitForExitAnimation(element, animationName, duration) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return Promise.resolve();
      }
      return new Promise(resolve => {
        const timeout = window.setTimeout(finish, duration + 100);
        function finish(event) {
          if (event && (event.target !== element || event.animationName !== animationName)) return;
          window.clearTimeout(timeout);
          element.removeEventListener('animationend', finish);
          resolve();
        }
        element.addEventListener('animationend', finish);
      });
    }

    async function closeAddDoorDialog() {
      if (!dialog.open || isClosingAddDoor) return;
      isClosingAddDoor = true;
      dialog.classList.add('is-closing');
      await waitForExitAnimation(addDoorSheet, 'add-door-sheet-exit', 620);
      dialog.classList.remove('is-closing');
      dialog.close();
      isClosingAddDoor = false;
    }

    dialog.addEventListener('close', () => {
      editingDoorId = undefined;
      isClosingAddDoor = false;
      dialog.classList.remove('is-closing');
      if (faceAccessOverlay) {
        faceAccessOverlay.hidden = true;
        faceAccessOverlay.classList.remove('is-closing');
      }
    });

    dialog.querySelector('#close-add-lock')?.addEventListener('click', () => {
      closeAddDoorDialog();
    });
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      if (faceAccessOverlay && !faceAccessOverlay.hidden) {
        closeFaceAccessOverlay();
      } else {
        closeAddDoorDialog();
      }
    });

    const nameInput = dialog.querySelector('#lock-name-input');
    const formError = dialog.querySelector('#add-lock-form-error');
    const saveButton = dialog.querySelector('#save-new-lock');
    const locationButtons = Array.from(dialog.querySelectorAll('[data-location-choice]'));
    const authMethodOptions = Array.from(dialog.querySelectorAll('[data-auth-method]'));
    const pinAction = dialog.querySelector('#open-pin-setup');
    const pinSetupDialog = document.getElementById('pin-setup-dialog');
    const pinSetupInput = pinSetupDialog.querySelector('#pin-setup-input');
    const pinSetupConfirm = pinSetupDialog.querySelector('#pin-setup-confirm');
    const pinSetupError = pinSetupDialog.querySelector('#pin-setup-error');
    const pinSetupSubmit = pinSetupDialog.querySelector('#pin-setup-submit');
    const pinSetupSheet = pinSetupDialog.querySelector('.pin-setup-sheet');
    const pinVisibilityButtons = Array.from(
      pinSetupDialog.querySelectorAll('[data-pin-visibility]')
    );
    let pendingPinFlow;
    let isSavingPin = false;
    let hasSavedPinCredential = false;

    function closeFaceAccessOverlay() {
      if (!faceAccessOverlay || faceAccessOverlay.hidden) return Promise.resolve();
      if (faceAccessClosePromise) return faceAccessClosePromise;
      const sheet = faceAccessOverlay.querySelector(
        '[data-purpose="face-id-authorization-overlay"] > :first-child'
      );
      faceAccessOverlay.classList.add('is-closing');
      faceAccessClosePromise = waitForExitAnimation(sheet, 'face-id-sheet-exit', 620)
        .then(() => {
          faceAccessOverlay.hidden = true;
          faceAccessOverlay.classList.remove('is-closing');
          faceAccessClosePromise = undefined;
          if (dialog.open) saveButton?.focus({ preventScroll: true });
        });
      return faceAccessClosePromise;
    }

    async function openFaceAccessPage(door, existingDoor) {
      try {
        if (!faceAccessOverlay) {
          faceAccessOverlay = document.createElement('div');
          faceAccessOverlay.className = 'face-id-access-overlay';
          faceAccessOverlay.setAttribute('role', 'dialog');
          faceAccessOverlay.setAttribute('aria-modal', 'true');
          faceAccessOverlay.setAttribute('aria-label', 'Cấp quyền Face ID');
          faceAccessOverlay.tabIndex = -1;
          faceAccessOverlay.hidden = true;
          dialog.append(faceAccessOverlay);
        }
        const response = await fetch(
          new URL('face-id-access.html', smartDoorAppAssetsBaseUrl),
          { cache: 'no-store' }
        );
        if (!response.ok) {
          throw new Error(`Không tải được giao diện cấp quyền Face ID (HTTP ${response.status}).`);
        }
        const pageTemplate = new DOMParser().parseFromString(
          await response.text(),
          'text/html'
        );
        const sourceOverlay = pageTemplate.querySelector(
          '[data-purpose="face-id-authorization-overlay"]'
        );
        if (!sourceOverlay) {
          throw new Error('Không tìm thấy giao diện cấp quyền Face ID.');
        }
        faceAccessOverlay.replaceChildren(document.importNode(sourceOverlay, true));
        faceAccessOverlay.classList.remove('is-closing');
        faceAccessOverlay.hidden = false;
        faceAccessOverlay.focus();
        await window.initializeFaceIdAccessOverlay(faceAccessOverlay.firstElementChild, {
          door,
          onCancel: closeFaceAccessOverlay,
          onConfirm: async faceAccess => {
            persistDoor({ ...door, faceAccess }, existingDoor);
            await closeFaceAccessOverlay();
            await closeAddDoorDialog();
          }
        });
      } catch (error) {
        console.error('Could not open the Face ID access page.', error);
        if (faceAccessOverlay) {
          faceAccessOverlay.hidden = true;
          faceAccessOverlay.classList.remove('is-closing');
        }
        showFormError('Không thể mở giao diện cấp quyền Face ID. Hãy thử lại.');
      }
    }

    function updatePinSlots(input) {
      input.parentElement.querySelectorAll('[data-pin-slot]').forEach((slot, index) => {
        const hasDigit = index < input.value.length;
        const isVisible = hasDigit && input.type === 'text';
        slot.classList.toggle('is-filled', hasDigit);
        slot.classList.toggle('is-visible', isVisible);
        slot.textContent = isVisible ? input.value[index] : '';
      });
    }

    function showPinSetup(flow) {
      pendingPinFlow = flow;
      pinSetupInput.value = '';
      pinSetupConfirm.value = '';
      [pinSetupInput, pinSetupConfirm].forEach(input => {
        input.type = 'password';
      });
      pinVisibilityButtons.forEach(button => {
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', button.dataset.pinVisibility === 'pin-setup-input'
          ? 'Hiện mã PIN'
          : 'Hiện mã PIN xác nhận');
        button.title = button.getAttribute('aria-label');
        button.querySelector('.material-symbols-outlined').textContent = 'visibility';
      });
      updatePinSlots(pinSetupInput);
      updatePinSlots(pinSetupConfirm);
      pinSetupError.textContent = '';
      pinSetupError.hidden = true;
      const isChange = flow.kind === 'update-pin';
      pinSetupDialog.querySelector('#pin-setup-title').textContent = isChange
        ? 'Đổi mã PIN bảo mật'
        : 'Thêm mã PIN mới';
      pinSetupDialog.querySelector('#pin-setup-description').textContent = isChange
        ? 'Nhập và xác nhận mã PIN mới gồm đúng 8 chữ số.'
        : 'Thiết lập và xác nhận mã PIN gồm đúng 8 chữ số cho khóa này.';
      pinSetupDialog.querySelector('#pin-setup-submit').textContent = isChange
        ? 'Lưu mã PIN mới'
        : 'Thiết lập mã PIN';
      pinSetupDialog.classList.remove('is-closing');
      isClosingPinSetup = false;
      pinSetupDialog.showModal();
      pinSetupInput.focus();
    }

    function closePinSetupDialog() {
      if (!pinSetupDialog.open || isClosingPinSetup) return Promise.resolve();
      if (pinSetupClosePromise) return pinSetupClosePromise;
      isClosingPinSetup = true;
      pinSetupDialog.classList.add('is-closing');
      pinSetupClosePromise = waitForExitAnimation(
        pinSetupSheet,
        'pin-setup-sheet-exit',
        420
      ).then(() => {
        pinSetupDialog.classList.remove('is-closing');
        pinSetupDialog.close();
        isClosingPinSetup = false;
        pinSetupClosePromise = undefined;
      });
      return pinSetupClosePromise;
    }

    function persistDoor(door, existingDoor) {
      const savedDoors = readAddedDoors();
      const updatedDoors = existingDoor
        ? savedDoors.map(savedDoor => savedDoor.id === door.id ? door : savedDoor)
        : [...savedDoors, door];
      localStorage.setItem(addedDoorsStorageKey, JSON.stringify(updatedDoors));
      if (existingDoor) {
        const card = document.getElementById(`door-card-${door.id}`);
        if (card) {
          card.dataset.name = door.name;
          card.dataset.authMethods = JSON.stringify(door.authMethods);
          const methodIcons = card.querySelector('.door-auth-methods');
          if (methodIcons) renderAuthMethodIcons(methodIcons, door.authMethods);
          const title = card.querySelector('h4');
          if (title) title.textContent = door.name;
          const location = card.querySelector('.door-location');
          if (location) location.textContent = door.location;
        }
      } else {
        doorList.append(createDoorCard(door));
      }
      updateHouseOverview();
    }

    [pinSetupInput, pinSetupConfirm].forEach(input => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 8);
        updatePinSlots(input);
        if (input === pinSetupInput && input.value.length === 8) {
          pinSetupConfirm.focus();
        }
        pinSetupError.textContent = '';
        pinSetupError.hidden = true;
      });
    });

    pinVisibilityButtons.forEach(button => {
      button.addEventListener('click', () => {
        const input = pinSetupDialog.querySelector(`#${button.dataset.pinVisibility}`);
        const isVisible = input.type === 'password';
        input.type = isVisible ? 'text' : 'password';
        const label = `${isVisible ? 'Ẩn' : 'Hiện'} mã PIN${input === pinSetupConfirm ? ' xác nhận' : ''}`;
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', String(isVisible));
        button.title = label;
        button.querySelector('.material-symbols-outlined').textContent = isVisible
          ? 'visibility_off'
          : 'visibility';
        updatePinSlots(input);
      });
    });

    pinSetupDialog.querySelector('#pin-setup-cancel').addEventListener('click', () => {
      pendingPinFlow = undefined;
      closePinSetupDialog();
    });
    pinSetupDialog.addEventListener('cancel', event => {
      event.preventDefault();
      pendingPinFlow = undefined;
      closePinSetupDialog();
    });
    pinSetupDialog.addEventListener('click', event => {
      if (event.target === pinSetupDialog) {
        pendingPinFlow = undefined;
        closePinSetupDialog();
      }
    });
    async function submitPinSetup() {
      if (isSavingPin) return;
      const pin = pinSetupInput.value;
      if (!/^\d{8}$/.test(pin)) {
        pinSetupError.textContent = 'Mã PIN phải gồm đúng 8 chữ số.';
        pinSetupError.hidden = false;
        pinSetupInput.focus();
        return;
      }
      if (!/^\d{8}$/.test(pinSetupConfirm.value)) {
        pinSetupError.textContent = 'Vui lòng xác nhận đủ 8 chữ số.';
        pinSetupError.hidden = false;
        pinSetupConfirm.focus();
        return;
      }
      if (pin !== pinSetupConfirm.value) {
        pinSetupError.textContent = 'Hai mã PIN không khớp.';
        pinSetupError.hidden = false;
        pinSetupConfirm.focus();
        return;
      }

      isSavingPin = true;
      const previousSubmitLabel = pinSetupSubmit.textContent;
      pinSetupSubmit.disabled = true;
      pinSetupSubmit.textContent = 'Đang lưu mã PIN...';
      pinSetupError.textContent = 'Đang tạo mã PIN an toàn trên thiết bị này...';
      pinSetupError.hidden = false;
      try {
        const pinCredential = await createPinCredential(pin);
        const flow = pendingPinFlow;
        if (!flow) return;
        if (flow.kind === 'save-door') {
          const door = { ...flow.door, pinCredential };
          pendingPinFlow = undefined;
          await closePinSetupDialog();
          if (door.authMethods.includes('face')) {
            await openFaceAccessPage(door, flow.existingDoor);
            return;
          }
          persistDoor(door, flow.existingDoor);
          if (dialog.open) await closeAddDoorDialog();
          return;
        }

        const savedDoors = readAddedDoors();
        const existingDoor = savedDoors.find(door => door.id === flow.doorId);
        if (!existingDoor) throw new Error('Không tìm thấy khóa cần đổi mã PIN.');
        const updatedDoors = savedDoors.map(door => door.id === flow.doorId
          ? { ...door, pinCredential }
          : door);
        localStorage.setItem(addedDoorsStorageKey, JSON.stringify(updatedDoors));
        dialog.querySelector('#pin-credential-status').textContent = 'Mã PIN đã được cập nhật.';
        pendingPinFlow = undefined;
        await closePinSetupDialog();
      } catch (error) {
        pinSetupError.textContent = error.message || 'Không thể lưu mã PIN mới.';
        pinSetupError.hidden = false;
      } finally {
        isSavingPin = false;
        pinSetupSubmit.disabled = false;
        pinSetupSubmit.textContent = previousSubmitLabel;
      }
    }

    pinSetupDialog.querySelector('#pin-setup-submit').addEventListener('click', submitPinSetup);
    [pinSetupInput, pinSetupConfirm].forEach(input => {
      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (input === pinSetupInput && pinSetupInput.value.length === 8
          && !(pinSetupConfirm.value.length === 8 && pinSetupConfirm.value === pinSetupInput.value)) {
          pinSetupConfirm.focus();
          return;
        }
        submitPinSetup();
      });
    });
    pinAction?.addEventListener('click', () => {
      if (!editingDoorId) return;
      showPinSetup({ kind: 'update-pin', doorId: editingDoorId });
    });

    function showFormError(message) {
      if (!formError) return;
      formError.textContent = message;
      formError.hidden = false;
      formError.classList.remove('hidden');
    }

    locationButtons.forEach(button => {
      button.addEventListener('click', () => {
        locationButtons.forEach(option => {
          const selected = option === button;
          option.setAttribute('aria-pressed', String(selected));
          option.classList.toggle('bg-slate-900', selected);
          option.classList.toggle('text-white', selected);
          option.classList.toggle('shadow-2xs', selected);
          option.classList.toggle('bg-slate-100', !selected);
          option.classList.toggle('text-slate-700', !selected);
          option.classList.toggle('border', !selected);
          option.classList.toggle('border-slate-200/80', !selected);
        });
      });
    });

    authMethodOptions.forEach(option => {
      const toggleOption = () => {
        setAuthMethodEnabled(option, option.getAttribute('aria-pressed') !== 'true');
        updatePinSettings(dialog, authMethodOptions, hasSavedPinCredential);
        if (formError) {
          formError.textContent = '';
          formError.hidden = true;
          formError.classList.add('hidden');
        }
      };

      option.addEventListener('click', toggleOption);
      option.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleOption();
        }
      });
    });

    nameInput?.addEventListener('input', () => {
      if (formError) {
        formError.textContent = '';
        formError.hidden = true;
        formError.classList.add('hidden');
      }
    });

    saveButton?.addEventListener('click', async () => {
      const name = nameInput?.value.trim() || '';
      const selectedLocation = locationButtons.find(
        button => button.getAttribute('aria-pressed') === 'true'
      );
      const selectedAuthMethods = authMethodOptions
        .filter(option => option.getAttribute('aria-pressed') === 'true')
        .map(option => option.dataset.authMethod);

      if (!name) {
        showFormError('Enter a lock name.');
        nameInput?.focus();
        return;
      }

      if (!selectedLocation) {
        showFormError('Choose a location.');
        return;
      }

      if (selectedAuthMethods.length === 0) {
        showFormError('Select at least one authentication method.');
        authMethodOptions[0]?.focus();
        return;
      }
      try {
        const savedDoors = readAddedDoors();
        const isDuplicate = savedDoors.some(
          door => door.id !== editingDoorId
            && door.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
        );
        if (isDuplicate) {
          showFormError('A lock with this name already exists.');
          nameInput?.focus();
          return;
        }

        const existingDoor = editingDoorId
          ? savedDoors.find(door => door.id === editingDoorId)
          : undefined;
        if (editingDoorId && !existingDoor) {
          showFormError('This lock is no longer saved on this device.');
          return;
        }

        hasSavedPinCredential = Boolean(
          typeof existingDoor?.pinCredential?.salt === 'string'
          && typeof existingDoor?.pinCredential?.hash === 'string'
        );
        const door = {
          ...(existingDoor || {}),
          id: existingDoor?.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          location: selectedLocation.dataset.locationChoice,
          authMethods: selectedAuthMethods,
          faceAccess: existingDoor?.faceAccess || []
        };
        if (selectedAuthMethods.includes('pin') && hasSavedPinCredential) {
          door.pinCredential = existingDoor.pinCredential;
        }
        if (selectedAuthMethods.includes('pin') && !hasSavedPinCredential) {
          showPinSetup({ kind: 'save-door', door, existingDoor });
          return;
        }
        if (selectedAuthMethods.includes('face')) {
          await openFaceAccessPage(door, existingDoor);
          return;
        }
        persistDoor(door, existingDoor);
        editingDoorId = undefined;
        if (nameInput) nameInput.value = '';
        await closeAddDoorDialog();
      } catch (error) {
        console.error('Could not save the new lock.', error);
        showFormError('The lock could not be saved on this device. Check storage and try again.');
      }
    });

  }

  getDoorCards().forEach(bindDoorCard);
  try {
    readAddedDoors().forEach(door => {
      if (!Array.from(getDoorCards()).some(card => card.dataset.name === door.name)) {
        doorList.append(createDoorCard(door));
      }
    });
  } catch (error) {
    console.error('Could not load saved doors:', error);
    if (addDoorLoadError) {
      addDoorLoadError.textContent = 'Saved doors could not be loaded. Check this device storage.';
      addDoorLoadError.classList.remove('hidden');
    }
  }

  let addDoorDialogPromise;
  emptyLockState?.addEventListener('click', () => addDoorButton?.click());
  async function openAddDoorDialog(doorToEdit) {
    if (addDoorLoadError) {
      addDoorLoadError.textContent = '';
      addDoorLoadError.classList.add('hidden');
    }

    try {
      if (!addDoorDialogPromise) {
        addDoorDialogPromise = loadAddDoorDialog()
          .then(dialog => {
            bindAddDoorDialog(dialog);
            return dialog;
          })
          .catch(error => {
            addDoorDialogPromise = undefined;
            throw error;
          });
      }

      const dialog = await addDoorDialogPromise;
      const isEditing = Boolean(doorToEdit);
      editingDoorId = doorToEdit?.id;
      const nameInput = dialog.querySelector('#lock-name-input');
      const locationButtons = Array.from(dialog.querySelectorAll('[data-location-choice]'));
      const authMethodOptions = Array.from(dialog.querySelectorAll('[data-auth-method]'));
      const savedAuthMethods = new Set(
        Array.isArray(doorToEdit?.authMethods)
          ? doorToEdit.authMethods
          : doorToEdit ? defaultAuthMethods : []
      );
      const hasSavedPinCredential = Boolean(
        typeof doorToEdit?.pinCredential?.salt === 'string'
        && typeof doorToEdit?.pinCredential?.hash === 'string'
      );
      nameInput.value = doorToEdit?.name || '';
      dialog.querySelector('#add-door-title').textContent = isEditing ? 'Edit Lock' : 'Configure New Lock';
      dialog.querySelector('#add-door-description').textContent = isEditing
        ? 'Update the lock name and location on this device.'
        : 'Add a lock to this device.';
      dialog.querySelector('#add-door-submit-label').textContent = isEditing ? 'Save changes' : 'Add lock';
      const selectedLocation = locationButtons.find(
        button => button.dataset.locationChoice === doorToEdit?.location
      ) || locationButtons[0];
      selectedLocation?.click();
      authMethodOptions.forEach(option => {
        setAuthMethodEnabled(option, savedAuthMethods.has(option.dataset.authMethod));
      });
      updatePinSettings(dialog, authMethodOptions, hasSavedPinCredential);
      dialog.querySelector('#add-door-submit-label').textContent = isEditing ? 'Save changes' : 'Add lock';
      dialog.showModal();
      nameInput?.focus();
    } catch (error) {
      editingDoorId = undefined;
      console.error('Could not open the add-door form:', error);
      if (addDoorLoadError) {
        addDoorLoadError.textContent = `${error.message} Hãy đóng rồi mở lại ứng dụng để cập nhật giao diện.`;
        addDoorLoadError.classList.remove('hidden');
      }
    }
  }

  addDoorButton?.addEventListener('click', () => openAddDoorDialog());

  lockAllBtn.addEventListener('click', () => {
    getDoorCards().forEach(card => {
      setDoorLockState(card, true);
    });
  });

  updateHouseOverview();
};

window.initHomeView = function initHomeView() {
  window.initSmartLocks();
};

window.initHomeView();
