(function initializeSmartDoorApi() {
  const baseUrlKey = 'face-door-api-base-url';
  const tokenKey = 'face-door-api-token';

  function getConfig() {
    return {
      baseUrl: localStorage.getItem(baseUrlKey) || '',
      token: localStorage.getItem(tokenKey) || ''
    };
  }

  function saveConfig(baseUrl, token) {
    const parsedUrl = new URL(baseUrl.trim());
    if (!['http:', 'https:'].includes(parsedUrl.protocol)
        || parsedUrl.username
        || parsedUrl.password
        || parsedUrl.pathname !== '/'
        || parsedUrl.search
        || parsedUrl.hash) {
      throw new Error('Enter only the API origin, for example http://192.168.1.20:8766.');
    }
    if (token.trim().length < 24) {
      throw new Error('The API token must contain at least 24 characters.');
    }

    const normalizedBaseUrl = parsedUrl.origin;
    localStorage.setItem(baseUrlKey, normalizedBaseUrl);
    localStorage.setItem(tokenKey, token.trim());
    return { baseUrl: normalizedBaseUrl, token: token.trim() };
  }

  async function requestJson(path, options = {}) {
    const config = getConfig();
    if (!config.baseUrl || !config.token) {
      throw new Error('Enter and save the local API address and token first.');
    }

    let response;
    try {
      response = await fetch(`${config.baseUrl}${path}`, {
        ...options,
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${config.token}`,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers
        }
      });
    } catch {
      throw new Error(`Cannot reach the API at ${config.baseUrl}. Check the server, Wi-Fi, and firewall.`);
    }

    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(`The API returned an invalid response (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      throw new Error(body.error || `The API request failed (HTTP ${response.status}).`);
    }
    return body;
  }

  async function getStatus() {
    return requestJson('/api/v1/status');
  }

  async function getFaceUsers(deviceId) {
    const query = new URLSearchParams({ device_id: deviceId });
    const body = await requestJson(`/api/v1/users?${query}`);
    if (!Array.isArray(body.users)) {
      throw new Error('The API returned an invalid face-user list.');
    }
    return body.users;
  }

  async function syncFaceUser(deviceId, faceId, displayName) {
    return requestJson('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify({
        device_id: deviceId,
        face_id: faceId,
        ...(displayName ? { display_name: displayName } : {})
      })
    });
  }

  async function updateFaceUser(userId, changes) {
    return requestJson(`/api/v1/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes)
    });
  }

  window.smartDoorApi = Object.freeze({
    getConfig,
    getStatus,
    saveConfig,
    getFaceUsers,
    syncFaceUser,
    updateFaceUser
  });
})();
