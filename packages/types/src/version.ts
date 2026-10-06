export type UpdateChannel = 'stable' | 'beta' | 'nightly';

export interface MOSAVersion {
  version: string;          // "2.1.0"
  buildNumber: number;      // 210
  releaseDate: string;      // "2025-07-21"
  channel: UpdateChannel;   // stable | beta | nightly
  
  components: {
    platform: string;       // Backend + Frontend version
    firmware: string;       // ESP32 firmware version  
    schema: number;         // DB migration version
  };
  
  requirements: {
    minFirmware: string;    // Min ESP32 version needed
    minSchema: number;      // Min DB version needed
    breakingChanges: boolean;
  };
  
  changelog: {
    ar: string[];           // Arabic changelog
    en: string[];           // English changelog
  };
  
  signature: string;        // RSA-SHA256 signature
  checksum: string;         // SHA256 of the package
}

export interface UpdatePackage {
  version: MOSAVersion;
  files: {
    backend?: string;       // URL to backend bundle
    frontend?: string;      // URL to frontend bundle
    firmware?: string;      // URL to .bin file
    migrations?: string[];  // SQL migration files
  };
  size: number;             // Total bytes
  estimatedTime: number;    // Seconds to apply
}
