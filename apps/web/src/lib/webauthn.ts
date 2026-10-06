import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

// Phase 26: V2 Universal Upgrade - Biometric Passkeys
export class WebAuthnService {
  
  // Initiates FaceID or TouchID registration on the user's device
  static async registerBiometric() {
    try {
      // In a real flow, this challenge comes from Fastify Backend
      const mockOptionsFromServer = {
        challenge: 'random_secure_challenge_buffer',
        rp: { name: 'MOSA OS', id: 'localhost' },
        user: { id: 'user_123', name: 'admin', displayName: 'Admin' },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' as const }],
        authenticatorSelection: { userVerification: 'required' as const },
      };

      console.log('Prompting Biometric Registration...');
      // Triggers the native FaceID / TouchID prompt
      const attResp = await startRegistration({ optionsJSON: mockOptionsFromServer } as any);
      console.log('✅ Biometric Passkey created successfully:', attResp);
      
      // Send attResp back to server for verification and storage
      return attResp;
    } catch (error: any) {
      console.error('Biometric Registration Failed:', error.message);
    }
  }

  // Logs the user in using their Passkey (Zero Passwords)
  static async loginBiometric() {
    try {
      const mockAuthOptions = {
        challenge: 'random_secure_challenge_buffer',
        rpId: 'localhost',
        userVerification: 'required' as const,
      };

      console.log('Prompting Biometric Login...');
      // Triggers native FaceID / TouchID prompt
      const asseResp = await startAuthentication({ optionsJSON: mockAuthOptions } as any);
      console.log('🔓 Unlocked via Biometrics:', asseResp);
      
      return asseResp;
    } catch (error: any) {
      console.error('Biometric Login Failed:', error.message);
    }
  }
}
