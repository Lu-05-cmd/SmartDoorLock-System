(function initializeDeviceBiometric() {
  const storageKey = 'face-door-platform-credential';
  const credentialApi = navigator.credentials;

  function toBase64Url(bytes) {
    let binary = '';
    new Uint8Array(bytes).forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  function fromBase64Url(value) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
  }

  function randomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  function getSavedCredential() {
    const value = localStorage.getItem(storageKey);
    if (!value) return null;

    let credential;
    try {
      credential = JSON.parse(value);
    } catch {
      throw new Error('Thông tin sinh trắc học trên thiết bị không hợp lệ. Hãy đăng ký lại.');
    }
    if (!credential
        || typeof credential.id !== 'string'
        || typeof credential.publicKey !== 'string'
        || ![-7, -257].includes(credential.algorithm)
        || typeof credential.loginEmail !== 'string'
        || typeof credential.accountName !== 'string') {
      throw new Error('Thông tin sinh trắc học trên thiết bị không đầy đủ. Hãy đăng ký lại.');
    }
    return credential;
  }

  async function isAvailable() {
    if (!window.isSecureContext
        || !window.PublicKeyCredential
        || !credentialApi?.create
        || !credentialApi?.get
        || typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      return false;
    }
    return window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  }

  async function register(accountName, loginEmail) {
    if (!await isAvailable()) {
      throw new Error('Sinh trắc học cần trình duyệt hỗ trợ passkey và kết nối an toàn HTTPS hoặc localhost. Trên Android, hãy dùng ứng dụng hoặc trình duyệt có hỗ trợ passkey.');
    }
    if (!accountName.trim() || !loginEmail.trim()) {
      throw new Error('Hãy đăng nhập trước khi đăng ký Face ID hoặc vân tay trên thiết bị.');
    }

    const challenge = randomBytes(32);
    const userId = randomBytes(16);
    const credential = await credentialApi.create({
      publicKey: {
        challenge,
        rp: { name: 'Smart Door Lock' },
        user: {
          id: userId,
          name: loginEmail,
          displayName: accountName
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'required',
          userVerification: 'required'
        },
        timeout: 60000,
        attestation: 'none'
      }
    });
    if (!credential
        || typeof credential.response.getPublicKey !== 'function'
        || typeof credential.response.getPublicKeyAlgorithm !== 'function') {
      throw new Error('Trình duyệt không cung cấp khóa công khai để xác minh passkey trên thiết bị này.');
    }

    const publicKey = credential.response.getPublicKey();
    const algorithm = credential.response.getPublicKeyAlgorithm();
    if (!publicKey || ![-7, -257].includes(algorithm)) {
      throw new Error('Thiết bị không cung cấp thuật toán passkey được ứng dụng hỗ trợ.');
    }

    const savedCredential = {
      id: toBase64Url(credential.rawId),
      publicKey: toBase64Url(publicKey),
      algorithm,
      loginEmail: loginEmail.trim(),
      accountName: accountName.trim()
    };
    localStorage.setItem(storageKey, JSON.stringify(savedCredential));
    return savedCredential;
  }

  function derToRawSignature(signature) {
    const bytes = new Uint8Array(signature);
    if (bytes.length < 8 || bytes[0] !== 0x30) {
      throw new Error('Thiết bị trả về chữ ký passkey không hợp lệ.');
    }

    let offset = 2;
    if ((bytes[1] & 0x80) !== 0) {
      offset += bytes[1] & 0x7f;
    }
    if (bytes[offset] !== 0x02) {
      throw new Error('Không thể đọc chữ ký passkey từ thiết bị.');
    }
    const rLength = bytes[offset + 1];
    let r = bytes.slice(offset + 2, offset + 2 + rLength);
    offset += 2 + rLength;
    if (bytes[offset] !== 0x02) {
      throw new Error('Không thể đọc chữ ký passkey từ thiết bị.');
    }
    const sLength = bytes[offset + 1];
    let s = bytes.slice(offset + 2, offset + 2 + sLength);
    r = r[0] === 0 ? r.slice(1) : r;
    s = s[0] === 0 ? s.slice(1) : s;
    if (r.length > 32 || s.length > 32) {
      throw new Error('Độ dài chữ ký passkey không hợp lệ.');
    }
    const raw = new Uint8Array(64);
    raw.set(r, 32 - r.length);
    raw.set(s, 64 - s.length);
    return raw;
  }

  async function authenticate() {
    const savedCredential = getSavedCredential();
    if (!savedCredential) {
      throw new Error('Thiết bị này chưa đăng ký Face ID hoặc vân tay. Hãy đăng nhập bằng mật khẩu rồi đăng ký trong tab Face ID.');
    }
    if (!await isAvailable()) {
      throw new Error('Sinh trắc học cần trình duyệt hỗ trợ passkey và kết nối an toàn HTTPS hoặc localhost. Trên Android, hãy dùng ứng dụng hoặc trình duyệt có hỗ trợ passkey.');
    }

    const challenge = randomBytes(32);
    const credential = await credentialApi.get({
      publicKey: {
        challenge,
        allowCredentials: [{
          type: 'public-key',
          id: fromBase64Url(savedCredential.id),
          transports: ['internal']
        }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    if (!credential || toBase64Url(credential.rawId) !== savedCredential.id) {
      throw new Error('Thiết bị xác thực không khớp với passkey đã đăng ký.');
    }

    const clientDataBytes = new Uint8Array(credential.response.clientDataJSON);
    const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));
    if (clientData.type !== 'webauthn.get'
        || clientData.challenge !== toBase64Url(challenge)
        || clientData.origin !== window.location.origin
        || clientData.crossOrigin === true) {
      throw new Error('Không xác minh được nguồn hoặc thử thách của passkey.');
    }

    const authenticatorData = new Uint8Array(credential.response.authenticatorData);
    if (authenticatorData.length < 37 || (authenticatorData[32] & 0x05) !== 0x05) {
      throw new Error('Thiết bị chưa xác nhận người dùng bằng Face ID hoặc vân tay.');
    }
    const expectedRpIdHash = new Uint8Array(await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(window.location.hostname)
    ));
    if (!expectedRpIdHash.every((byte, index) => byte === authenticatorData[index])) {
      throw new Error('Passkey không thuộc ứng dụng trên địa chỉ hiện tại.');
    }

    const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes));
    const signedData = new Uint8Array(authenticatorData.length + clientDataHash.length);
    signedData.set(authenticatorData);
    signedData.set(clientDataHash, authenticatorData.length);
    const isEcdsa = savedCredential.algorithm === -7;
    const verificationAlgorithm = isEcdsa
      ? { name: 'ECDSA', hash: 'SHA-256' }
      : { name: 'RSASSA-PKCS1-v1_5' };
    const publicKey = await crypto.subtle.importKey(
      'spki',
      fromBase64Url(savedCredential.publicKey),
      isEcdsa
        ? { name: 'ECDSA', namedCurve: 'P-256' }
        : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const verified = await crypto.subtle.verify(
      verificationAlgorithm,
      publicKey,
      isEcdsa
        ? derToRawSignature(credential.response.signature)
        : credential.response.signature,
      signedData
    );
    if (!verified) {
      throw new Error('Chữ ký Face ID hoặc vân tay không hợp lệ.');
    }
    return savedCredential;
  }

  function clearRegistration() {
    localStorage.removeItem(storageKey);
  }

  window.smartDoorBiometric = Object.freeze({
    authenticate,
    clearRegistration,
    getSavedCredential,
    isAvailable,
    register
  });
})();
