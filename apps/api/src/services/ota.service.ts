import { createSign, createVerify } from 'crypto';
import { readFileSync } from 'fs';

export class OTAService {
  static signFirmware(firmwarePath: string, privateKeyPath: string): string {
    const firmware = readFileSync(firmwarePath);
    const privateKey = readFileSync(privateKeyPath);

    const sign = createSign('SHA256');
    sign.update(firmware);
    return sign.sign(privateKey, 'hex');
  }

  static verifyFirmwareSignature(firmwarePath: string, signature: string, publicKeyPath: string): boolean {
    const firmware = readFileSync(firmwarePath);
    const publicKey = readFileSync(publicKeyPath);

    const verify = createVerify('SHA256');
    verify.update(firmware);
    return verify.verify(publicKey, signature, 'hex');
  }
}
