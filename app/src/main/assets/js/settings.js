window.initSettingsView = function initSettingsView() {
  const toggles = document.querySelectorAll('.toggle-switch');
  const scopeButtons = document.querySelectorAll('.scope-btn');
  const delayPills = document.querySelectorAll('.delay-pill');
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const activityLogButton = document.getElementById('open-activity-log');
  const accountUserName = document.getElementById('account-user-name');
  const accountUserEmail = document.getElementById('account-user-email');
  const accountLoginLink = document.getElementById('account-login-link');
  const accountLogoutButton = document.getElementById('account-logout-button');
  const contactDialog = document.getElementById('contact-dialog');
  const contactDialogTitle = document.getElementById('contact-dialog-title');
  const contactInputLabel = document.getElementById('contact-input-label');
  const contactInput = document.getElementById('contact-input');
  const contactDialogMessage = document.getElementById('contact-dialog-message');
  const saveContactButton = document.getElementById('save-contact');
  const testButton = document.getElementById('btn-self-test');
  const testStatus = document.getElementById('self-test-status');
  const isAuthenticated = localStorage.getItem('face-door-authenticated') === 'true';
  if (accountUserName && accountLoginLink) {
    if (isAuthenticated) {
      accountUserName.textContent = localStorage.getItem('face-door-account-name') || 'Admin';
      accountLoginLink.hidden = true;
      if (accountLogoutButton) accountLogoutButton.hidden = false;

      const loginEmail = localStorage.getItem('face-door-login-email');
      if (accountUserEmail && loginEmail) {
        accountUserEmail.textContent = loginEmail;
        accountUserEmail.hidden = false;
      }
    } else {
      accountUserName.textContent = 'Sign in to your account';
      accountLoginLink.hidden = false;
      if (accountLogoutButton) accountLogoutButton.hidden = true;
      if (accountUserEmail) {
        accountUserEmail.textContent = '';
        accountUserEmail.hidden = true;
      }
    }
  }

  accountLogoutButton?.addEventListener('click', () => {
    localStorage.removeItem('face-door-authenticated');
    localStorage.removeItem('face-door-account-name');
    localStorage.removeItem('face-door-login-email');
    window.location.replace('login.html');
  });

  const contactMethods = {
    email: {
      storageKey: 'face-door-account-email',
      valueId: 'account-email-value',
      statusId: 'account-email-status',
      label: 'Email address',
      linkLabel: 'Link email',
      verifyLabel: 'Verify email',
      inputType: 'email',
      inputMode: 'email',
      placeholder: 'name@example.com',
      autocomplete: 'email'
    },
    phone: {
      storageKey: 'face-door-account-phone',
      valueId: 'account-phone-value',
      statusId: 'account-phone-status',
      label: 'Phone number',
      linkLabel: 'Link phone',
      verifyLabel: 'Verify phone',
      inputType: 'tel',
      inputMode: 'tel',
      placeholder: '+84',
      autocomplete: 'tel'
    }
  };

  function updateContactMethod(type) {
    const method = contactMethods[type];
    const valueElement = document.getElementById(method.valueId);
    const statusElement = document.getElementById(method.statusId);
    const actionButton = document.querySelector(`[data-contact-type="${type}"]`);
    const value = localStorage.getItem(method.storageKey) || '';

    valueElement.textContent = value || 'Not linked';
    statusElement.textContent = value ? 'Not verified' : 'Not linked';
    actionButton.textContent = value ? method.verifyLabel : method.linkLabel;
    actionButton.setAttribute('aria-label', value ? method.verifyLabel : method.linkLabel);
  }

  function openContactDialog(type) {
    const method = contactMethods[type];
    const savedValue = localStorage.getItem(method.storageKey) || '';
    contactDialogTitle.textContent = savedValue ? `Verify ${method.label.toLowerCase()}` : method.linkLabel;
    contactInputLabel.textContent = method.label;
    contactInput.type = method.inputType;
    contactInput.inputMode = method.inputMode;
    contactInput.autocomplete = method.autocomplete;
    contactInput.placeholder = method.placeholder;
    contactInput.value = savedValue;
    contactInput.hidden = Boolean(savedValue);
    contactInputLabel.hidden = Boolean(savedValue);
    contactDialogMessage.textContent = savedValue
      ? 'Email and SMS code delivery is not configured. This contact remains unverified.'
      : 'Contact will be stored on this device. It will remain unverified until code delivery is configured.';
    saveContactButton.hidden = Boolean(savedValue);
    saveContactButton.textContent = `Save ${method.label.toLowerCase()}`;
    contactDialog.dataset.contactMethod = type;
    contactDialog.showModal();

    if (!savedValue) contactInput.focus();
  }

  Object.keys(contactMethods).forEach(type => {
    updateContactMethod(type);
    document.querySelector(`[data-contact-type="${type}"]`)
      .addEventListener('click', () => openContactDialog(type));
  });

  document.getElementById('close-contact-dialog')?.addEventListener('click', () => {
    contactDialog.close();
  });

  saveContactButton?.addEventListener('click', () => {
    const type = contactDialog.dataset.contactMethod;
    const method = contactMethods[type];
    const value = contactInput.value.trim();
    if (!value || !contactInput.checkValidity()) {
      contactInput.reportValidity();
      return;
    }

    localStorage.setItem(method.storageKey, value);
    updateContactMethod(type);
    contactDialog.close();
  });

  activityLogButton?.addEventListener('click', () => {
    document.querySelector('nav a[data-path="activity"]')?.click();
  });

  const darkModeEnabled = localStorage.getItem('face-door-theme') !== 'light';
  document.documentElement.classList.toggle('dark', darkModeEnabled);
  if (themeToggle) {
    themeToggle.setAttribute('aria-checked', String(darkModeEnabled));
    themeToggle.classList.toggle('is-on', darkModeEnabled);
  }

  toggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const isOn = toggle.getAttribute('aria-checked') !== 'true';
      toggle.setAttribute('aria-checked', String(isOn));
      toggle.classList.toggle('is-on', isOn);

      if (toggle === themeToggle) {
        document.documentElement.classList.toggle('dark', isOn);
        localStorage.setItem('face-door-theme', isOn ? 'dark' : 'light');
      }
    });
  });

  scopeButtons.forEach(button => {
    button.addEventListener('click', () => {
      scopeButtons.forEach(item => item.classList.toggle('selected', item === button));
    });
  });

  delayPills.forEach(button => {
    button.addEventListener('click', () => {
      delayPills.forEach(item => item.classList.toggle('selected', item === button));
    });
  });

  if (testButton && testStatus) {
    testButton.addEventListener('click', () => {
      if (testButton.disabled) return;
      testButton.disabled = true;
      testButton.innerHTML = '<span class="material-symbols-outlined">progress_activity</span><span>Testing Actuator...</span>';
      testStatus.classList.add('hidden');

      window.setTimeout(() => {
        testButton.innerHTML = '<span class="material-symbols-outlined">build_circle</span><span>Run Lock Self-Test</span>';
        testButton.disabled = false;
        testStatus.classList.remove('hidden');
      }, 900);
    });
  }
};

if (document.body.classList.contains('settings-page')) {
  window.initSettingsView();
}
