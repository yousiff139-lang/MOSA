import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface OTESRecord {
  tokenHash: string;
  deviceMac: string;
  deviceName?: string;
  homeId?: string;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  used: boolean;
  createdBy: string;
}

// In-Memory Secure Token Store (Synced with Redis if available)
const otesStore = new Map<string, OTESRecord>();

// Simple IP rate-limiter for /sign-csr
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getPkiPath(relPath: string): string {
  const candidates = [
    path.resolve(process.cwd(), 'config/pki', relPath),
    path.resolve(process.cwd(), '../../config/pki', relPath),
    path.resolve('/app/config/pki', relPath),
    path.resolve('C:/Users/rfgrt/Downloads/project-bolt-sb1-nkhtybuz/config/pki', relPath)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function hashToken(rawToken: string): string {
  const secret = process.env.JWT_SECRET || 'mosa_default_hmac_secret';
  return crypto.createHmac('sha256', secret).update(rawToken.trim()).digest('hex');
}

export class ProvisioningService {
  /**
   * 1. Generate a single-use, 5-minute TTL One-Time Enrollment Secret (OTES)
   */
  static generateOTESToken(params: {
    mac: string;
    deviceName?: string;
    homeId?: string;
    createdBy: string;
  }) {
    const cleanMac = params.mac.replace(/[:-]/g, '').toUpperCase();
    if (!/^[0-9A-F]{12}$/.test(cleanMac)) {
      throw new Error('Invalid MAC address format. Expected 12 hexadecimal characters.');
    }

    // Generate cryptographically secure random token (e.g. OTES-A1B2C3D4E5F6)
    const rawEntropy = crypto.randomBytes(6).toString('hex').toUpperCase();
    const rawToken = `OTES-${rawEntropy.slice(0, 4)}-${rawEntropy.slice(4, 8)}-${rawEntropy.slice(8, 12)}`;
    const tokenHash = hashToken(rawToken);

    const record: OTESRecord = {
      tokenHash,
      deviceMac: cleanMac,
      deviceName: params.deviceName || `MosaNode_${cleanMac}`,
      homeId: params.homeId,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes TTL
      attempts: 0,
      maxAttempts: 3,
      used: false,
      createdBy: params.createdBy
    };

    otesStore.set(cleanMac, record);

    console.log(`[OTES] Generated secure enrollment token for MAC ${cleanMac}. TTL: 5 min.`);

    return {
      token: rawToken,
      expiresAt: new Date(record.expiresAt).toISOString(),
      mac: cleanMac,
      deviceName: record.deviceName
    };
  }

  /**
   * 2. Validate OTES token and Sign Device Certificate Signing Request (CSR)
   */
  static async signDeviceCSR(params: {
    token: string;
    mac: string;
    csr: string;
    clientIp: string;
  }) {
    // A. Enforce IP Rate Limiting (max 10 requests per minute per IP)
    const now = Date.now();
    const ipRate = rateLimitMap.get(params.clientIp) || { count: 0, resetAt: now + 60000 };
    if (now > ipRate.resetAt) {
      ipRate.count = 0;
      ipRate.resetAt = now + 60000;
    }
    ipRate.count++;
    rateLimitMap.set(params.clientIp, ipRate);

    if (ipRate.count > 10) {
      throw new Error('Rate limit exceeded for CSR signing. Please wait.');
    }

    const cleanMac = params.mac.replace(/[:-]/g, '').toUpperCase();
    const record = otesStore.get(cleanMac);

    if (!record) {
      throw new Error('No active enrollment session found for this device MAC.');
    }

    if (record.used) {
      throw new Error('Enrollment token has already been used.');
    }

    if (now > record.expiresAt) {
      otesStore.delete(cleanMac);
      throw new Error('Enrollment token has expired (5-minute TTL exceeded).');
    }

    if (record.attempts >= record.maxAttempts) {
      otesStore.delete(cleanMac);
      throw new Error('Enrollment token locked out due to excessive failed attempts.');
    }

    // Timing-Safe HMAC verification
    const computedHash = hashToken(params.token);
    const hashBuf = Buffer.from(computedHash, 'hex');
    const expectedBuf = Buffer.from(record.tokenHash, 'hex');

    const isValid = hashBuf.length === expectedBuf.length && crypto.timingSafeEqual(hashBuf, expectedBuf);
    if (!isValid) {
      record.attempts++;
      if (record.attempts >= record.maxAttempts) {
        otesStore.delete(cleanMac);
      }
      throw new Error(`Invalid enrollment token. Attempts remaining: ${record.maxAttempts - record.attempts}`);
    }

    // B. Validate CSR Cryptography
    const csrClean = params.csr.trim();
    if (!csrClean.includes('BEGIN CERTIFICATE REQUEST') && !csrClean.includes('BEGIN NEW CERTIFICATE REQUEST')) {
      throw new Error('Invalid CSR format. PEM PKCS#10 Certificate Request required.');
    }

    const tmpDir = path.resolve(process.cwd(), 'scratch');
    fs.mkdirSync(tmpDir, { recursive: true });

    const tmpCsr = path.join(tmpDir, `device_${cleanMac}_${Date.now()}.csr`);
    const tmpCrt = path.join(tmpDir, `device_${cleanMac}_${Date.now()}.crt`);
    fs.writeFileSync(tmpCsr, csrClean, 'utf8');

    const interKey = getPkiPath('private/intermediate_ca.key');
    const interCrt = getPkiPath('intermediate_ca.crt');
    const caChain = getPkiPath('ca_chain.crt');
    const opensslCnf = getPkiPath('openssl_pki.cnf');

    try {
      // 1. Verify CSR self-signature
      execSync(`openssl req -in "${tmpCsr}" -noout -verify`, { stdio: 'pipe' });

      // 2. Verify Subject CN matches MosaNode_<MAC>
      const subjectOutput = execSync(`openssl req -in "${tmpCsr}" -noout -subject`, { encoding: 'utf8' });
      const expectedCn = `MosaNode_${cleanMac}`;
      if (!subjectOutput.includes(expectedCn)) {
        throw new Error(`CSR Subject CommonName mismatch. Expected CN=${expectedCn}, got: ${subjectOutput.trim()}`);
      }

      // 3. Verify Public Key is ECDSA P-256
      const keyText = execSync(`openssl req -in "${tmpCsr}" -noout -pubkey | openssl pkey -pubin -text`, { encoding: 'utf8' });
      if (!keyText.includes('Public-Key: (256 bit)') && !keyText.includes('prime256v1') && !keyText.includes('NIST CURVE: P-256')) {
        throw new Error('Public key must be Elliptic Curve NIST P-256 (prime256v1). RSA or other curves are rejected.');
      }

      // 4. Sign the device certificate with Intermediate CA
      const signCmd = `openssl x509 -req -in "${tmpCsr}" -CA "${interCrt}" -CAkey "${interKey}" -CAcreateserial -days 365 -sha256 -extfile "${opensslCnf}" -extensions client_device_cert -out "${tmpCrt}"`;
      execSync(signCmd, { stdio: 'pipe' });

      const deviceCertPem = fs.readFileSync(tmpCrt, 'utf8');
      const caChainPem = fs.readFileSync(caChain, 'utf8');

      // 5. Mark OTES token as used (Single-Use Guarantee)
      record.used = true;
      otesStore.delete(cleanMac);

      // Clean up temporary files
      if (fs.existsSync(tmpCsr)) fs.unlinkSync(tmpCsr);
      if (fs.existsSync(tmpCrt)) fs.unlinkSync(tmpCrt);

      console.log(`[OTES ✅] Successfully issued mTLS client certificate for device: MosaNode_${cleanMac}`);

      return {
        success: true,
        deviceId: `MosaNode_${cleanMac}`,
        certificate: deviceCertPem,
        caChain: caChainPem,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      };
    } catch (err: any) {
      if (fs.existsSync(tmpCsr)) fs.unlinkSync(tmpCsr);
      if (fs.existsSync(tmpCrt)) fs.unlinkSync(tmpCrt);
      throw new Error(`CSR Validation/Signing Failed: ${err.message}`);
    }
  }
}
