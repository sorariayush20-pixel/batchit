/**
 * WebCrypto API End-to-End Encryption (E2EE) Module
 * Provides zero-dependency, standard browser RSA-2048 and AES-256-GCM encryption
 */

export interface KeyPairPem {
  publicKeyPem: string;
  privateKeyPem: string;
  fingerprint: string;
}

export interface StoredCryptoKeys {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  pem: KeyPairPem;
}

// Convert ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 to ArrayBuffer
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Format buffer to PEM
function spkiToPem(buffer: ArrayBuffer): string {
  const b64 = bufferToBase64(buffer);
  return `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
}

function pkcs8ToPem(buffer: ArrayBuffer): string {
  const b64 = bufferToBase64(buffer);
  return `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----`;
}

// Clean PEM headers
function cleanPem(pem: string): string {
  return pem
    .replace(/-----BEGIN [A-Z ]+-----/, '')
    .replace(/-----END [A-Z ]+-----/, '')
    .replace(/\s+/g, '');
}

/**
 * Generate fingerprint (SHA-256 format: 8A:92:F1...) from Public Key PEM
 */
export async function generateFingerprint(publicKeyPem: string): Promise<string> {
  const clean = cleanPem(publicKeyPem);
  const buffer = base64ToBuffer(clean);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0').toUpperCase());
  return hex.slice(0, 16).join(':'); // First 16 hex pairs for readable safety fingerprint
}

/**
 * Generate new RSA-OAEP Key Pair for current user
 */
export async function generateKeyPair(): Promise<StoredCryptoKeys> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const spkiBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const pkcs8Buffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const publicKeyPem = spkiToPem(spkiBuffer);
  const privateKeyPem = pkcs8ToPem(pkcs8Buffer);
  const fingerprint = await generateFingerprint(publicKeyPem);

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    pem: {
      publicKeyPem,
      privateKeyPem,
      fingerprint,
    },
  };
}

/**
 * Import RSA Public Key from PEM
 */
export async function importPublicKey(pem: string): Promise<CryptoKey> {
  const clean = cleanPem(pem);
  const buffer = base64ToBuffer(clean);
  return await window.crypto.subtle.importKey(
    'spki',
    buffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
}

/**
 * Import RSA Private Key from PEM
 */
export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const clean = cleanPem(pem);
  const buffer = base64ToBuffer(clean);
  return await window.crypto.subtle.importKey(
    'pkcs8',
    buffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );
}

/**
 * Encrypt message text using hybrid encryption:
 * 1. Generate AES-256-GCM symmetric key
 * 2. Encrypt plaintext message with AES key
 * 3. Encrypt AES key with recipient's RSA Public Key
 */
export async function encryptMessage(
  text: string,
  recipientPublicKeyPem: string
): Promise<{ ciphertext: string; iv: string; encryptedSymmetricKey: string }> {
  // 1. Generate AES-256-GCM Key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // 2. Encrypt plaintext
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    data
  );

  // 3. Export AES key
  const exportedAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

  // 4. Import Recipient RSA Public Key & Encrypt AES Key
  const recipientPublicKey = await importPublicKey(recipientPublicKeyPem);
  const encryptedAesKey = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    recipientPublicKey,
    exportedAesKey
  );

  return {
    ciphertext: bufferToBase64(encryptedContent),
    iv: bufferToBase64(iv.buffer),
    encryptedSymmetricKey: bufferToBase64(encryptedAesKey),
  };
}

/**
 * Decrypt message using hybrid decryption:
 * 1. Decrypt AES key using recipient's RSA Private Key
 * 2. Decrypt message content using AES-256-GCM
 */
export async function decryptMessage(
  ciphertextBase64: string,
  ivBase64: string,
  encryptedSymmetricKeyBase64: string,
  userPrivateKey: CryptoKey
): Promise<string> {
  try {
    // 1. Decrypt AES key with RSA private key
    const encryptedAesBuffer = base64ToBuffer(encryptedSymmetricKeyBase64);
    const rawAesBuffer = await window.crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      userPrivateKey,
      encryptedAesBuffer
    );

    // 2. Import raw AES key
    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      rawAesBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // 3. Decrypt ciphertext
    const ciphertextBuffer = base64ToBuffer(ciphertextBase64);
    const ivBuffer = base64ToBuffer(ivBase64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
      aesKey,
      ciphertextBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    console.error('Decryption failed:', err);
    return '🔒 [Decryption Error: Private Key Mismatch]';
  }
}

/**
 * Save / Load KeyPair in localStorage for session persistence
 */
const STORAGE_KEY_PEM = 'ciphertalk_keypair';

export function saveKeysToStorage(pem: KeyPairPem) {
  localStorage.setItem(STORAGE_KEY_PEM, JSON.stringify(pem));
}

export function loadKeysFromStorage(): KeyPairPem | null {
  const data = localStorage.getItem(STORAGE_KEY_PEM);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}
