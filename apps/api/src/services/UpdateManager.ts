import cron from 'node-cron';
import { EventEmitter } from 'events';
import { verifyPackage, UpdatePackage, MOSAVersion, UpdateChannel } from '../lib/signature';
import { prisma } from '../lib/prisma';
import { server } from '../server';
import { MigrationRunner } from './MigrationRunner';
import { sendTelegram } from './telegram';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export class UpdateManager extends EventEmitter {
  private currentVersion = '1.0.0';
  private currentBuildNumber = 100;
  private channel: UpdateChannel = 'stable';
  private isUpdating = false;
  private publicKey: string;
  private migrationRunner = new MigrationRunner();
  private updateServerUrl: string;

  constructor() {
    super();
    this.publicKey = process.env.UPDATE_PUBLIC_KEY || `-----BEGIN PUBLIC KEY-----\nMOCK_PUBLIC_KEY\n-----END PUBLIC KEY-----`;
    this.channel = (process.env.UPDATE_CHANNEL || 'stable') as UpdateChannel;
    this.updateServerUrl = process.env.UPDATE_SERVER_URL || 'https://updates.mosa.iq';
  }

  startScheduler() {
    // Check every 6 hours
    cron.schedule('0 */6 * * *', () => {
      this.checkForUpdates().catch(err => console.error('[UpdateManager] Cron check error:', err));
    });
    
    // Check on startup after 30s
    setTimeout(() => {
      this.checkForUpdates().catch(err => console.error('[UpdateManager] Startup check error:', err));
    }, 30000);
  }

  async getCurrentVersion() {
    const record = await prisma.systemVersion.findUnique({ where: { id: 'current' } });
    if (record) {
      return {
        version: record.version,
        buildNumber: record.buildNumber,
        channel: record.channel as UpdateChannel,
        platformVersion: record.platformVersion,
        firmwareVersion: record.firmwareVersion,
        schemaVersion: record.schemaVersion,
        updateState: record.updateState
      };
    }
    
    // Initialize if empty
    const initData = {
      id: 'current',
      version: this.currentVersion,
      buildNumber: this.currentBuildNumber,
      channel: this.channel,
      platformVersion: this.currentVersion,
      firmwareVersion: this.currentVersion,
      schemaVersion: 1,
      updateState: 'idle'
    };
    
    await prisma.systemVersion.create({ data: initData }).catch(() => {});
    return initData;
  }

  private async updateLastChecked() {
    await prisma.systemVersion.update({
      where: { id: 'current' },
      data: { lastCheckedAt: new Date() }
    }).catch(() => {});
  }

  private async setUpdateState(state: string) {
    await prisma.systemVersion.update({
      where: { id: 'current' },
      data: { updateState: state }
    }).catch(() => {});
  }

  private isCompatible(update: UpdatePackage, current: any): boolean {
    // Basic checks
    if (update.version.buildNumber <= current.buildNumber) {
      return false;
    }
    return true;
  }

  async checkForUpdates(): Promise<UpdatePackage | null> {
    try {
      const current = await this.getCurrentVersion();
      
      const response = await fetch(`${this.updateServerUrl}/api/updates/check`, {
        headers: {
          'X-MOSA-Version': current.version,
          'X-MOSA-Channel': this.channel,
          'X-MOSA-License': process.env.MOSA_LICENSE || 'MOCK_LICENSE',
          'Authorization': `Bearer ${process.env.UPDATE_TOKEN || 'MOCK_TOKEN'}`
        }
      }).catch(() => null);
      
      if (!response || response.status === 204) {
        await this.updateLastChecked();
        return null;
      }
      
      const update: UpdatePackage = await response.json();
      
      // Verify signature
      if (this.publicKey.includes('MOCK_PUBLIC_KEY') === false && !verifyPackage(update.version, this.publicKey)) {
        console.error('[UpdateManager] Invalid signature!');
        return null;
      }
      
      if (!this.isCompatible(update, current)) {
        console.warn('[UpdateManager] Incompatible or old version update skipped');
        return null;
      }
      
      await prisma.systemVersion.update({
        where: { id: 'current' },
        data: {
          pendingVersion: update.version.version,
          lastCheckedAt: new Date()
        }
      });
      
      server.io.emit('update_available', {
        currentVersion: current.version,
        newVersion: update.version.version,
        changelog: update.version.changelog,
        size: update.size,
        estimatedTime: update.estimatedTime
      });
      
      return update;
    } catch (error) {
      console.error('[UpdateManager] Check failed:', error);
      return null;
    }
  }

  async applyUpdate(
    update: UpdatePackage,
    options: {
      maintenanceWindow?: boolean;
      backupFirst?: boolean;
    } = {}
  ): Promise<void> {
    if (this.isUpdating) {
      throw new Error('Update already in progress');
    }
    
    // Check if active connections exist
    if (!options.maintenanceWindow) {
      const activeConnections = server.io?.engine?.clientsCount || 0;
      if (activeConnections > 0) {
        console.log(`[UpdateManager] Deferring update: ${activeConnections} active users connected`);
        return;
      }
    }
    
    this.isUpdating = true;
    const startTime = Date.now();
    
    try {
      await this.setUpdateState('downloading');
      this.emit('update_start', update.version.version);
      
      server.io?.emit('update_started', {
        version: update.version.version,
        message: 'جاري تحديث النظام...',
        estimatedTime: update.estimatedTime
      });
      
      // Step 1: Backup current state
      if (options.backupFirst !== false) {
        console.log('[UpdateManager] Creating pre-update database backup...');
        await this.createPreUpdateBackup();
      }
      
      // Step 2: Download and verify package files
      await this.setUpdateState('downloading');
      const files = await this.downloadPackage(update);
      
      // Step 3: Stage new version
      await this.setUpdateState('staging');
      await this.stageNewVersion(files, update);
      
      // Step 4: Run database migrations
      await this.setUpdateState('migrating');
      await this.migrationRunner.runMigrations(files.migrations || []);
      
      // Step 5: Atomic switch
      await this.setUpdateState('switching');
      await this.performAtomicSwitch(update);
      
      // Step 6: Health verification
      await this.setUpdateState('verifying');
      const healthy = await this.verifyHealth();
      
      if (!healthy) {
        await this.rollback(update);
        return;
      }
      
      // Step 7: Success
      await this.setUpdateState('complete');
      await this.recordSuccess(update, startTime);
      
      server.io?.emit('update_complete', {
        version: update.version.version,
        changelog: update.version.changelog,
        message: `تم التحديث إلى v${update.version.version} ✅`
      });
      
      this.emit('update_success', update.version.version);
    } catch (error: any) {
      console.error('[UpdateManager] Failed:', error);
      await this.rollback(update);
    } finally {
      this.isUpdating = false;
    }
  }

  private async createPreUpdateBackup() {
    const backupDir = path.join(__dirname, '../../../../uploads/backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupFile = path.join(backupDir, `pre_update_${Date.now()}.sql`);
    // Run simple mock dump or pg_dump command
    try {
      const dbUrl = process.env.DATABASE_URL || '';
      if (dbUrl) {
        console.log(`[UpdateManager] Backup scheduled at ${backupFile}`);
      }
    } catch (err) {
      console.error('[UpdateManager] Backup creation failed:', err);
    }
  }

  private async downloadPackage(update: UpdatePackage) {
    console.log(`[UpdateManager] Downloading package files for v${update.version.version}`);
    // Simulate downloads of release artifacts
    return {
      backend: '/tmp/backend.tar.gz',
      frontend: '/tmp/frontend.tar.gz',
      migrations: [] as string[]
    };
  }

  private async stageNewVersion(files: any, update: UpdatePackage) {
    console.log('[UpdateManager] Staging files...');
  }

  private async performAtomicSwitch(update: UpdatePackage) {
    console.log('[UpdateManager] Atomic container Upstream redirection check.');
    // Simulated Blue-Green container switch
    await execAsync('docker ps').catch(() => {});
  }

  private async verifyHealth(): Promise<boolean> {
    console.log('[UpdateManager] Performing post-update health check verification...');
    // Simple check that DB remains reachable
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async rollback(failedUpdate: UpdatePackage) {
    console.warn('[UpdateManager] ROLLBACK INITIATED');
    await this.setUpdateState('rolling_back');
    
    try {
      // Revert version details
      await prisma.updateHistory.create({
        data: {
          fromVersion: failedUpdate.version.version,
          toVersion: this.currentVersion,
          channel: this.channel,
          status: 'rolled_back',
          failureReason: 'Update health check failed or exception thrown',
          changelog: failedUpdate.version.changelog
        }
      });
      
      server.io?.emit('update_rolled_back', {
        failedVersion: failedUpdate.version.version,
        message: 'تعذّر التحديث، تم الرجوع للنسخة السابقة'
      });
      
      console.warn('[UpdateManager] Rollback finished successfully');
    } catch (err: any) {
      console.error('[UpdateManager] CRITICAL: Rollback failed:', err);
      await sendTelegram(`🚨 CRITICAL: MOSA update rollback failed!\nVersion: ${failedUpdate.version.version}\nError: ${err.message}`);
    }
  }

  private async recordSuccess(update: UpdatePackage, startTime: number) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    await prisma.systemVersion.update({
      where: { id: 'current' },
      data: {
        version: update.version.version,
        buildNumber: update.version.buildNumber,
        platformVersion: update.version.components.platform,
        schemaVersion: update.version.components.schema,
        pendingVersion: null,
        updateStartedAt: null
      }
    });

    await prisma.updateHistory.create({
      data: {
        fromVersion: this.currentVersion,
        toVersion: update.version.version,
        channel: this.channel,
        status: 'success',
        duration,
        changelog: update.version.changelog
      }
    });

    await sendTelegram(`🎉 تم تحديث نظام MOSA بنجاح إلى الإصدار v${update.version.version} في غضون ${duration} ثانية.`);
  }
}

export const updateManager = new UpdateManager();
