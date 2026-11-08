function toBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function encryptRequest(payload) {
  const aesKey = import.meta.env.VITE_REQUEST_AES_KEY;

  if (!aesKey) {
    throw new Error("Request encryption key is not configured.");
  }

  const keyBytes = new TextEncoder().encode(aesKey);

  if (![16, 24, 32].includes(keyBytes.length)) {
    throw new Error("AES key must be 16, 24, or 32 UTF-8 bytes.");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // AES-GCM uses a fresh 12-byte nonce for each request.
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));

  // Web Crypto appends the authentication tag to the encrypted bytes.
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    cryptoKey,
    plaintext
  );

  return {
    nonce: toBase64(nonce),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
}
