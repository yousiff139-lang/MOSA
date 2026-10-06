import { createSign, createVerify } from 'crypto';
import { readFileSync } from 'fs';
import { MOSAVersion } from '../packages/types/src/version';

export function signPackage(
  manifest: Omit<MOSAVersion, 'signature'>,
  privateKeyPath: string
): string {
  const privateKey = readFileSync(privateKeyPath);
  const signer = createSign('RSA-SHA256');
  
  // Sort keys to guarantee deterministic verification
  const canonical = JSON.stringify(manifest, Object.keys(manifest).sort());
  signer.update(canonical);
  
  return signer.sign(privateKey, 'base64');
}

export function verifyPackage(
  manifest: MOSAVersion,
  publicKey: string
): boolean {
  const verifier = createVerify('RSA-SHA256');
  const manifestWithoutSignature = { ...manifest };
  delete (manifestWithoutSignature as any).signature;
  
  const canonical = JSON.stringify(
    manifestWithoutSignature,
    Object.keys(manifestWithoutSignature).sort()
  );
  verifier.update(canonical);
  
  try {
    return verifier.verify(publicKey, manifest.signature, 'base64');
  } catch (err) {
    return false;
  }
}
