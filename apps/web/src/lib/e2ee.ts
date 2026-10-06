// AES-GCM 256-bit End-to-End Encryption utility for Next.js Frontend
// This guarantees that the Fastify server CANNOT read the MQTT payloads.

export class E2EEngine {
  private static async getEncryptionKey(base64Key: string): Promise<CryptoKey> {
    const rawKey = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  static async encryptPayload(payload: object, base64Key: string): Promise<string> {
    const key = await this.getEncryptionKey(base64Key);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(JSON.stringify(payload));

    const encryptedContent = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );

    const encryptedBytes = new Uint8Array(encryptedContent);
    const combined = new Uint8Array(iv.length + encryptedBytes.length);
    combined.set(iv);
    combined.set(encryptedBytes, iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  static async decryptPayload(encryptedBase64: string, base64Key: string): Promise<object> {
    const key = await this.getEncryptionKey(base64Key);
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decryptedContent = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    const decodedString = new TextDecoder().decode(decryptedContent);
    return JSON.parse(decodedString);
  }
}
