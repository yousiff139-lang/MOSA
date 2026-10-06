import cron from 'node-cron';
import { DockerManager } from './docker';

export function startCronJobs() {
  console.log('[Supervisor] Starting self-healing and backup cron jobs...');

  // 1. Health Monitor: Runs every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Supervisor] Running Routine Health Check...');
    
    // Critical containers to monitor
    const criticalContainers = ['mosa-postgres', 'mosa-backend', 'mosa-mosquitto', 'mosa-zigbee2mqtt'];

    for (const name of criticalContainers) {
      const isRunning = await DockerManager.isContainerRunning(name);
      if (!isRunning) {
        console.warn(`[Supervisor] CRITICAL: Container ${name} is DOWN! Attempting restart...`);
        await DockerManager.restartContainer(name);
      }
    }
  });

  // 2. PostgreSQL Backup: Runs every day at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('[Supervisor] Running Daily PostgreSQL Backup...');
    await DockerManager.performDatabaseBackup();
  });
}
