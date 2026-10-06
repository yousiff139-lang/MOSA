import { createVerify } from 'crypto';

export type UpdateChannel = 'stable' | 'beta' | 'nightly';

export interface MOSAVersion {
  version: string;
  buildNumber: number;
  releaseDate: string;
  channel: UpdateChannel;
  components: {
    platform: string;
    firmware: string;
    schema: number;
  };
  requirements: {
    minFirmware: string;
    minSchema: number;
    breakingChanges: boolean;
  };
  changelog: {
    ar: string[];
    en: string[];
  };
  signature: string;
  checksum: string;
}

export interface UpdatePackage {
  version: MOSAVersion;
  files: {
    backend?: string;
    frontend?: string;
    firmware?: string;
    migrations?: string[];
  };
  size: number;
  estimatedTime: number;
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
