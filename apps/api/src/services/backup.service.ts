import crypto from 'crypto';
import { prisma } from '../lib/prisma';

/**
 * Enterprise One-Click Disaster Recovery & AES-256 Encrypted Backup Service
 * REQ Traceability: REQ-DR-001 (Automated System Backup & Restoration)
 */

export interface BackupPayload {
  version: string;
  timestamp: string;
  homeId: string;
  devices: any[];
  nodes: any[];
  rooms: any[];
  automations: any[];
  scenes: any[];
  settings: any;
}

export class BackupService {
  /**
   * Generates AES-256-GCM Encrypted Backup Payload
   */
  public static async exportEncryptedBackup(homeId: string, encryptionPassword?: string): Promise<{ ciphertext: string; hash: string }> {
    const password = encryptionPassword || process.env.BACKUP_ENCRYPTION_KEY;
    if (!password) throw new Error('BACKUP_ENCRYPTION_KEY is required but not set.');

    const devices = await prisma.device.findMany({ where: { homeId, deletedAt: null } });
    const nodes = await prisma.node.findMany({ where: { homeId } });
    const rooms = await prisma.room.findMany({ where: { homeId } });
    const automations = await prisma.automation.findMany({ where: { homeId } });
    const scenes = await prisma.scene.findMany({ where: { homeId } });
    const home = await prisma.home.findUnique({ where: { id: homeId } });

    const rawPayload: BackupPayload = {
      version: '3.0.0-enterprise',
      timestamp: new Date().toISOString(),
      homeId,
      devices,
      nodes,
      rooms,
      automations,
      scenes,
      settings: home
    };

    const jsonStr = JSON.stringify(rawPayload, null, 2);

    // AES-256-GCM Encryption
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(jsonStr, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    const resultBundle = {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted
    };

    const encryptedString = Buffer.from(JSON.stringify(resultBundle)).toString('base64');
    const hash = crypto.createHash('sha256').update(encryptedString).digest('hex');

    return { ciphertext: encryptedString, hash };
  }

  /**
   * Decrypts and Validates Encrypted Backup File
   */
  public static decryptBackup(encryptedBase64: string, encryptionPassword?: string): BackupPayload {
    const password = encryptionPassword || process.env.BACKUP_ENCRYPTION_KEY;
    if (!password) throw new Error('BACKUP_ENCRYPTION_KEY is required but not set.');

    const rawBundleJson = Buffer.from(encryptedBase64, 'base64').toString('utf8');
    const bundle = JSON.parse(rawBundleJson);

    const salt = Buffer.from(bundle.salt, 'hex');
    const iv = Buffer.from(bundle.iv, 'hex');
    const authTag = Buffer.from(bundle.authTag, 'hex');

    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(bundle.data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    const payload: BackupPayload = JSON.parse(decrypted);
    if (!payload.version || !payload.homeId) {
      throw new Error('Invalid MOSA Backup File Format');
    }

    return payload;
  }
}
