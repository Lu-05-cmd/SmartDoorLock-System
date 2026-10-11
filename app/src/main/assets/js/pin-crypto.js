(function exposePinCredentialCrypto() {
  const iterations = 210000;
  const initialState = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  const roundConstants = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  function rotateRight(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  function compress(state, block, words, result) {
    const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(index * 4);
    }
    for (let index = 16; index < words.length; index += 1) {
      const previous15 = words[index - 15];
      const previous2 = words[index - 2];
      const sigma0 = rotateRight(previous15, 7)
        ^ rotateRight(previous15, 18)
        ^ (previous15 >>> 3);
      const sigma1 = rotateRight(previous2, 17)
        ^ rotateRight(previous2, 19)
        ^ (previous2 >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let a = state[0];
    let b = state[1];
    let c = state[2];
    let d = state[3];
    let e = state[4];
    let f = state[5];
    let g = state[6];
    let h = state[7];
    for (let index = 0; index < words.length; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + roundConstants[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }

    result[0] = (state[0] + a) >>> 0;
    result[1] = (state[1] + b) >>> 0;
    result[2] = (state[2] + c) >>> 0;
    result[3] = (state[3] + d) >>> 0;
    result[4] = (state[4] + e) >>> 0;
    result[5] = (state[5] + f) >>> 0;
    result[6] = (state[6] + g) >>> 0;
    result[7] = (state[7] + h) >>> 0;
  }

  function stateToBytes(state) {
    const bytes = new Uint8Array(32);
    const view = new DataView(bytes.buffer);
    state.forEach((word, index) => view.setUint32(index * 4, word));
    return bytes;
  }

  async function derivePinHashFallback(pin, salt) {
    const key = new TextEncoder().encode(pin);
    const paddedKey = new Uint8Array(64);
    paddedKey.set(key);
    const innerPad = new Uint8Array(64);
    const outerPad = new Uint8Array(64);
    for (let index = 0; index < paddedKey.length; index += 1) {
      innerPad[index] = paddedKey[index] ^ 0x36;
      outerPad[index] = paddedKey[index] ^ 0x5c;
    }

    const innerSchedule = new Uint32Array(64);
    const outerSchedule = new Uint32Array(64);
    const innerState = new Uint32Array(8);
    const outerState = new Uint32Array(8);
    compress(initialState, innerPad, innerSchedule, innerState);
    compress(initialState, outerPad, outerSchedule, outerState);
    const innerHash = new Uint32Array(8);
    const output = new Uint32Array(8);
    const innerBlock = new Uint8Array(64);
    const outerBlock = new Uint8Array(64);
    outerBlock[32] = 0x80;
    const innerBlockView = new DataView(innerBlock.buffer);
    const outerBlockView = new DataView(outerBlock.buffer);
    outerBlockView.setUint32(60, 768);

    function hmacSha256(message) {
      innerBlock.fill(0);
      const messageByteLength = message instanceof Uint32Array
        ? message.byteLength
        : message.length;
      if (message instanceof Uint32Array) {
        message.forEach((word, index) => innerBlockView.setUint32(index * 4, word));
      } else {
        innerBlock.set(message, 0);
      }
      innerBlock[messageByteLength] = 0x80;
      innerBlockView.setUint32(60, (64 + messageByteLength) * 8);
      compress(innerState, innerBlock, innerSchedule, innerHash);
      innerHash.forEach((word, index) => outerBlockView.setUint32(index * 4, word));
      compress(outerState, outerBlock, outerSchedule, output);
      return output;
    }

    const firstBlock = new Uint8Array(salt.length + 4);
    firstBlock.set(salt);
    firstBlock[firstBlock.length - 1] = 1;
    let current = hmacSha256(firstBlock).slice();
    let next = new Uint32Array(8);
    const result = current.slice();

    for (let iteration = 1; iteration < iterations; iteration += 1) {
      hmacSha256(current);
      next.set(output);
      for (let index = 0; index < result.length; index += 1) {
        result[index] ^= next[index];
      }
      const previous = current;
      current = next;
      next = previous;
      if (iteration % 1024 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    return stateToBytes(result);
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function createPinCredential(pin) {
    if (!window.crypto?.getRandomValues) {
      throw new Error('Trình duyệt không cung cấp bộ sinh số ngẫu nhiên an toàn để lưu PIN.');
    }
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    let hash;
    if (window.crypto.subtle) {
      const key = await window.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(pin),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const derivedBits = await window.crypto.subtle.deriveBits({
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt,
        iterations
      }, key, 256);
      hash = new Uint8Array(derivedBits);
    } else {
      hash = await derivePinHashFallback(pin, salt);
    }

    return {
      algorithm: 'PBKDF2-SHA-256',
      iterations,
      salt: bytesToHex(salt),
      hash: bytesToHex(hash)
    };
  }

  window.smartDoorPinCrypto = { createPinCredential };
})();
