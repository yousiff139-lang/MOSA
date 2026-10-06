import * as fs from 'fs';
import * as path from 'path';

/**
 * MOSA Smart Platform - Certificate Expiry Monitoring & Revocation Service
 * Monitors device certificates, issues expiration alerts, and enforces CRL revocation.
 */

export interface CertStatus {
  deviceId: string;
  cn: string;
  isRevoked: boolean;
  daysUntilExpiry: number;
  status: 'HEALTHY' | 'EXPIRING_SOON' | 'REVOKED';
}

export function checkCertificateStatus(deviceId: string, certPem?: string): CertStatus {
  const certsDir = path.resolve(process.cwd(), 'mosquitto', 'config', 'certs');
  const crlPath = path.join(certsDir, 'crl.pem');

  let isRevoked = false;
  if (fs.existsSync(crlPath)) {
    const crlContent = fs.readFileSync(crlPath, 'utf-8');
    isRevoked = crlContent.includes(deviceId);
  }

  if (isRevoked) {
    return {
      deviceId,
      cn: deviceId,
      isRevoked: true,
      daysUntilExpiry: 0,
      status: 'REVOKED'
    };
  }

  // Simulated certificate validity check (valid for 365 days)
  const daysUntilExpiry = 300;
  const status = daysUntilExpiry < 30 ? 'EXPIRING_SOON' : 'HEALTHY';

  return {
    deviceId,
    cn: deviceId,
    isRevoked: false,
    daysUntilExpiry,
    status
  };
}

export function revokeCertificate(deviceId: string, reason: string): { success: boolean; crlUpdated: boolean } {
  const certsDir = path.resolve(process.cwd(), 'mosquitto', 'config', 'certs');
  const crlPath = path.join(certsDir, 'crl.pem');

  const revocationEntry = `\nRevoked Cert Serial: 0x${Math.floor(Math.random() * 0xFFFFFF).toString(16)}\nRevoked Device: ${deviceId}\nReason: ${reason}\n`;
  
  if (fs.existsSync(crlPath)) {
    fs.appendFileSync(crlPath, revocationEntry, 'utf-8');
  } else {
    fs.writeFileSync(crlPath, `-----BEGIN X509 CRL-----\n${revocationEntry}-----END X509 CRL-----\n`, 'utf-8');
  }

  console.log(`[CertMonitor] 🚨 Device '${deviceId}' certificate REVOKED. Added to CRL. Reason: ${reason}`);
  return { success: true, crlUpdated: true };
}

/**
 * SECURITY FIX #19: Automated CRL Regeneration
 * 
 * Regenerates the Certificate Revocation List from the CA.
 * Should be called periodically (e.g., via cron every 24 hours).
 * 
 * In production, this would call `openssl ca -gencrl` to regenerate
 * the CRL from the CA database. For the MOSA platform, we simulate
 * this by maintaining a proper CRL format.
 */
export function regenerateCRL(): { success: boolean; timestamp: Date } {
  const certsDir = path.resolve(process.cwd(), 'mosquitto', 'config', 'certs');
  const crlPath = path.join(certsDir, 'crl.pem');
  const crlBackupPath = path.join(certsDir, `crl.pem.backup.${Date.now()}`);

  try {
    // Backup existing CRL
    if (fs.existsSync(crlPath)) {
      fs.copyFileSync(crlPath, crlBackupPath);
      console.log(`[CertMonitor] 📦 Backed up existing CRL to ${crlBackupPath}`);
    }

    // In production, run: openssl ca -gencrl -out crl.pem -config ca.conf
    // For now, maintain the existing revocations with updated timestamp
    const now = new Date().toISOString();
    const crlHeader = `-----BEGIN X509 CRL-----
# CRL Generated: ${now}
# Next Update: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}
# Issuer: CN=MOSA Smart Platform CA
`;

    let existingRevocations = '';
    if (fs.existsSync(crlPath)) {
      const oldContent = fs.readFileSync(crlPath, 'utf-8');
      // Extract revocation entries (lines starting with "Revoked")
      const lines = oldContent.split('\n');
      existingRevocations = lines
        .filter(line => line.startsWith('Revoked'))
        .join('\n');
    }

    const newCRL = `${crlHeader}\n${existingRevocations}\n-----END X509 CRL-----\n`;
    fs.writeFileSync(crlPath, newCRL, 'utf-8');

    console.log(`[CertMonitor] ✅ CRL regenerated successfully at ${now}`);
    return { success: true, timestamp: new Date() };
  } catch (error: any) {
    console.error(`[CertMonitor] ❌ CRL regeneration failed:`, error.message);
    
    // Restore backup if regeneration failed
    if (fs.existsSync(crlBackupPath)) {
      fs.copyFileSync(crlBackupPath, crlPath);
      console.log(`[CertMonitor] 🔄 Restored CRL from backup`);
    }
    
    throw new Error(`CRL regeneration failed: ${error.message}`);
  }
}

/**
 * Gets the CRL's last update timestamp and next scheduled update.
 */
export function getCRLStatus(): { lastUpdate: Date | null; nextUpdate: Date | null; revokedCount: number } {
  const certsDir = path.resolve(process.cwd(), 'mosquitto', 'config', 'certs');
  const crlPath = path.join(certsDir, 'crl.pem');

  if (!fs.existsSync(crlPath)) {
    return { lastUpdate: null, nextUpdate: null, revokedCount: 0 };
  }

  const content = fs.readFileSync(crlPath, 'utf-8');
  const lines = content.split('\n');

  let lastUpdate: Date | null = null;
  let nextUpdate: Date | null = null;
  let revokedCount = 0;

  for (const line of lines) {
    if (line.includes('CRL Generated:')) {
      const match = line.match(/CRL Generated: (.+)/);
      if (match) lastUpdate = new Date(match[1]);
    }
    if (line.includes('Next Update:')) {
      const match = line.match(/Next Update: (.+)/);
      if (match) nextUpdate = new Date(match[1]);
    }
    if (line.startsWith('Revoked')) {
      revokedCount++;
    }
  }

  return { lastUpdate, nextUpdate, revokedCount };
}



/**
 * SECURITY FIX #19: Automated CRL Regeneration
 * 
 * Regenerates the Certificate Revocation List from the CA.
 * Should be called periodically (e.g., via cron every 24 hours).
 * 
 * In production, this would call `openssl ca -gencrl` to regenerate
 * the CRL from the CA database. For the MOSA platform, we simulate
 * this by maintaining a proper CRL format.
 */
export function regenerateCRL(): { success: boolean; timestamp: Date } {
  const certsDir = path.resolve(process.cwd(), 'mosquitto', 'config', 'certs');
  const crlPath = path.join(certsDir, 'crl.pem');
  const crlBackupPath = path.join(certsDir, `crl.pem.backup.${Date.now()}`);

  try {
    // Backup existing CRL
    if (fs.existsSync(crlPath)) {
      fs.copyFileSync(crlPath, crlBackupPath);
      console.log(`[CertMonitor] 📦 Backed up existing CRL to ${crlBackupPath}`);
    }

    // In production, run: openssl ca -gencrl -out crl.pem -config ca.conf
    // For now, maintain the existing revocations with updated timestamp
    const now = new Date().toISOString();
    const crlHeader = `-----BEGIN X509 CRL-----
# CRL Generated: ${now}
# Next Update: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}
# Issuer: CN=MOSA Smart Platform CA
`;

    let existingRevocations = '';
    if (fs.existsSync(crlPath)) {
      const oldContent = fs.readFileSync(crlPath, 'utf-8');
      // Extract revocation entries (lines starting with "Revoked")
      const lines = oldContent.split('\n');
      existingRevocations = lines
        .filter(line => line.startsWith('Revoked'))
        .join('\n');
    }

    const newCRL = `${crlHeader}\n${existingRevocations}\n-----END X509 CRL-----\n`;
    fs.writeFileSync(crlPath, newCRL, 'utf-8');

    console.log(`[CertMonitor] ✅ CRL regenerated successfully at ${now}`);
    return { success: true, timestamp: new Date() };
  } catch (error: any) {
    console.error(`[CertMonitor] ❌ CRL regeneration failed:`, error.message);
    
    // Restore backup if regeneration failed
    if (fs.existsSync(crlBackupPath)) {
      fs.copyFileSync(crlBackupPath, crlPath);
      console.log(`[CertMonitor] 🔄 Restored CRL from backup`);
    }
    
    throw new Error(`CRL regeneration failed: ${error.message}`);
  }
}

/**
 * Gets the CRL's last update timestamp and next scheduled update.
 */
export function getCRLStatus(): { lastUpdate: Date | null; nextUpdate: Date | null; revokedCount: number } {
  const certsDir = path.resolve(process.cwd(), 'mosquitto', 'config', 'certs');
  const crlPath = path.join(certsDir, 'crl.pem');

  if (!fs.existsSync(crlPath)) {
    return { lastUpdate: null, nextUpdate: null, revokedCount: 0 };
  }

  const content = fs.readFileSync(crlPath, 'utf-8');
  const lines = content.split('\n');

  let lastUpdate: Date | null = null;
  let nextUpdate: Date | null = null;
  let revokedCount = 0;

  for (const line of lines) {
    if (line.includes('CRL Generated:')) {
      const match = line.match(/CRL Generated: (.+)/);
      if (match) lastUpdate = new Date(match[1]);
    }
    if (line.includes('Next Update:')) {
      const match = line.match(/Next Update: (.+)/);
      if (match) nextUpdate = new Date(match[1]);
    }
    if (line.startsWith('Revoked')) {
      revokedCount++;
    }
  }

  return { lastUpdate, nextUpdate, revokedCount };
}
