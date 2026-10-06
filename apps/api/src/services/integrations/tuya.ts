// Tuya OpenAPI Integration Stub
import crypto from 'crypto';

export const TuyaIntegrationService = {
  /**
   * Generates the required Tuya OpenAPI signature for requests
   */
  generateSignature: (clientId: string, secret: string, timestamp: string, nonce: string, stringToSign: string) => {
    const str = clientId + timestamp + nonce + stringToSign;
    return crypto.createHmac('sha256', secret).update(str).digest('hex').toUpperCase();
  },

  /**
   * Fetches devices from a Tuya user's account to sync into MOSA DB
   */
  syncDevices: async (homeId: string, tuyaUid: string, accessToken: string) => {
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const clientId = process.env.TUYA_CLIENT_ID || 'dummy';
    const secret = process.env.TUYA_SECRET || 'dummy';

    const stringToSign = `GET\n\n\n\n/v1.0/users/${tuyaUid}/devices`;
    const signature = TuyaIntegrationService.generateSignature(clientId, secret, timestamp, nonce, stringToSign);

    const response = await fetch(`https://openapi.tuyaus.com/v1.0/users/${tuyaUid}/devices`, {
      headers: {
        'client_id': clientId,
        'access_token': accessToken,
        'sign': signature,
        't': timestamp,
        'nonce': nonce,
        'sign_method': 'HMAC-SHA256'
      }
    });

    const data = await response.json();
    return data.result || [];
  },

  /**
   * Sends a command to a Tuya device via Cloud-to-Cloud API
   */
  sendCommand: async (deviceId: string, commands: Array<{ code: string; value: any }>, accessToken: string) => {
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const clientId = process.env.TUYA_CLIENT_ID || 'dummy';
    const secret = process.env.TUYA_SECRET || 'dummy';

    const body = JSON.stringify({ commands });
    const contentHash = crypto.createHash('sha256').update(body).digest('hex');
    const stringToSign = `POST\n${contentHash}\n\n\n/v1.0/devices/${deviceId}/commands`;
    const signature = TuyaIntegrationService.generateSignature(clientId, secret, timestamp, nonce, stringToSign);

    const response = await fetch(`https://openapi.tuyaus.com/v1.0/devices/${deviceId}/commands`, {
      method: 'POST',
      headers: {
        'client_id': clientId,
        'access_token': accessToken,
        'sign': signature,
        't': timestamp,
        'nonce': nonce,
        'sign_method': 'HMAC-SHA256',
        'Content-Type': 'application/json'
      },
      body
    });

    const data = await response.json();
    return { success: data.success };
  }
};
