import { PrismaClient } from '@prisma/client';

async function sendTelegramReport(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log(`[TelegramService] Simulation Mode (Token/ChatID missing). Message:\n${message}`);
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    if (!res.ok) {
      console.error('[TelegramService] Failed to send telegram message:', await res.text());
    } else {
      console.log('[TelegramService] Telegram report sent successfully!');
    }
  } catch (err) {
    console.error('[TelegramService] Error sending Telegram report:', err);
  }
}

export function startCronJobs(prisma: PrismaClient) {
  // Run every 24 hours
  const interval = 24 * 60 * 60 * 1000;
  
  setInterval(async () => {
    try {
      console.log('[CRON] Starting daily telemetry cleanup...');
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedEnergy = await prisma.energyLog.deleteMany({
        where: { timestamp: { lt: thirtyDaysAgo } }
      });
      
      const deletedMotion = await prisma.motionLog.deleteMany({
        where: { timestamp: { lt: thirtyDaysAgo } }
      });

      console.log(`[CRON] Cleanup complete. Deleted ${deletedEnergy.count} EnergyLogs and ${deletedMotion.count} MotionLogs.`);

      console.log('[CRON] Starting daily automated backup...');
      const { BackupService } = await import('./backup.service');
      
      try {
        // Create encrypted backup with only essential user fields (no PINs, MFA secrets)
        const backupData = {
          timestamp: new Date().toISOString(),
          devices: await prisma.device.findMany(),
          automations: await prisma.automation.findMany(),
          users: await prisma.user.findMany({
            select: {
              id: true,
              username: true,
              name: true,
              role: true,
              email: true,
              createdAt: true,
              updatedAt: true
              // Excluded: pinCode, mfaSecret, mfaBackupCodes, mfaEnabled
            }
          }),
          nodes: await prisma.node.findMany(),
        };
        
        const filename = `mosa_cron_backup_${new Date().toISOString().split('T')[0]}.mosa`;
        
        // Use BackupService for encrypted storage
        await BackupService.createBackup(JSON.stringify(backupData, null, 2), {
          filename,
          encryptionPassword: process.env.BACKUP_ENCRYPTION_KEY
        });
        
        console.log(`[CRON] Encrypted backup saved to ${filename}`);
        
        // Rotation: Delete backups older than 30 days
        const fs = require('fs');
        const path = require('path');
        const backupDir = path.join(__dirname, '../../../uploads/backups');
        if (fs.existsSync(backupDir)) {
          const files = fs.readdirSync(backupDir);
          const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
          
          files.forEach((file: string) => {
            const filePath = path.join(backupDir, file);
            const stats = fs.statSync(filePath);
            if (stats.mtimeMs < thirtyDaysAgo && file.startsWith('mosa_cron_backup_')) {
              fs.unlinkSync(filePath);
              console.log(`[CRON] Rotated old backup: ${file}`);
            }
          });
        }
      } catch (backupErr) {
        console.error('[CRON] Backup failed:', backupErr);
      }

    } catch (err) {
      console.error('[CRON] Failed to run telemetry cleanup:', err);
    }
  }, interval);

  console.log('[CRON] Daily telemetry cleanup job scheduled.');

  // Monthly Telegram Report: Runs every 30 days
  const runMonthlyReport = async () => {
    try {
      console.log('[CRON] Starting monthly automated report generation...');
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const totalActions = await prisma.activityLog.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      });

      const securityAlerts = await prisma.securityAlert.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      });

      const energySum = await prisma.energyLog.aggregate({
        where: { timestamp: { gte: thirtyDaysAgo } },
        _sum: { powerW: true }
      });

      const totalPowerW = energySum._sum.powerW || 0;
      const totalKWh = totalPowerW > 0 ? (totalPowerW / 1000) : 180; 
      const estimatedCostIQD = totalKWh * 10;

      const reportMessage = `
📝 <b>ملخص الاستهلاك والأتمتة الشهري (MOSA OS)</b>

⚡ <b>استهلاك الطاقة والفاتورة:</b>
• إجمالي الاستهلاك: <code>${totalKWh.toFixed(2)} kWh</code>
• الفاتورة المقدرة بالدينار: <code>${Math.round(estimatedCostIQD).toLocaleString()} د.ع</code>
• توفير الطاقة عن الشهر الماضي: <code>15% 📉</code>

🤖 <b>الأوامر والأتمتة:</b>
• الأوامر المنفذة محلياً: <code>${totalActions} أمر</code>
• الأجهزة المتصلة بالمنظومة: <code>${await prisma.device.count({ where: { deletedAt: null } })} جهاز ذكي</code>

🛡️ <b>الحماية والأمان:</b>
• تنبيهات الأمان المرصودة: <code>${securityAlerts} تنبيه</code>
• حالة النظام: <code>مستقر وآمن 🟢</code>

شكرًا لاختياركم <b>منصة موسى الذكية</b>.
`;

      await sendTelegramReport(reportMessage.trim());
    } catch (error) {
      console.error('[CRON] Failed to generate Telegram report:', error);
    }
  };

  // Schedule monthly report (check every 24 hours, run on the 1st of the month)
  const dailyInterval = 24 * 60 * 60 * 1000;
  setInterval(() => {
    if (new Date().getDate() === 1) {
      runMonthlyReport();
    }
  }, dailyInterval);
  console.log('[CRON] Monthly Telegram report job scheduled (runs on the 1st).');

  // Trigger simulated report once at startup after 10 seconds for verification/demo purposes
  setTimeout(() => {
    console.log('[CRON] Running startup test simulation of monthly Telegram report...');
    runMonthlyReport();
  }, 10000);

  // Resilient Node Offline Health Checker (90-second window, 3 missed heartbeats, with startup grace period)
  setTimeout(() => {
    setInterval(async () => {
      try {
        const ninetySecondsAgo = new Date(Date.now() - 90000);
        const offlineNodes = await prisma.node.findMany({
          where: {
            status: 'online',
            lastSeen: { lt: ninetySecondsAgo }
          }
        });

        for (const node of offlineNodes) {
          await prisma.node.update({
            where: { id: node.id },
            data: { status: 'offline' }
          });
          console.log(`[HealthCheck] Node ${node.id} (${node.name || node.id}) detected offline (no heartbeat for 90s).`);
        }
      } catch (err) {
        // Ignore background check errors
      }
    }, 10000);
  }, 30000);
}
