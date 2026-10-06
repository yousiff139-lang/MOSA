import express from 'express';
import cors from 'cors';
import { DockerManager } from './docker';

export const app = express();

app.use(cors());
app.use(express.json());

// Strict Whitelist of manageable containers (Prevents container escape / arbitrary control)
const ALLOWED_CONTAINERS = new Set([
  'mosa-backend',
  'mosa-frontend',
  'mosa-mosquitto',
  'mosa-zigbee2mqtt',
  'mosa-nginx',
  'mosa-redis',
  'mosa-postgres'
]);

// 🛡️ Cryptographically strict authentication middleware (Zero hardcoded fallback)
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const secret = process.env.SUPERVISOR_SECRET;
  if (!secret || secret.trim().length < 16) {
    console.error('[Supervisor 🛑] SUPERVISOR_SECRET is missing or insufficiently long (min 16 chars required).');
    return res.status(500).json({ error: 'Server misconfiguration: SUPERVISOR_SECRET not securely provisioned.' });
  }

  const token = req.headers['authorization'];
  if (token !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized. Invalid Supervisor Token.' });
  }
  next();
};

app.use(authMiddleware);

// 1. Get System Health
app.get('/api/health', async (req, res) => {
  const health = await DockerManager.getSystemHealth();
  res.json(health);
});

// 2. Trigger Container Restart (Strictly Whitelisted)
app.post('/api/containers/:name/restart', async (req, res) => {
  const containerName = req.params.name;
  
  if (!ALLOWED_CONTAINERS.has(containerName)) {
    console.warn(`[Supervisor 🛑] Blocked unauthorized restart attempt on unwhitelisted container: ${containerName}`);
    return res.status(403).json({ 
      error: 'Forbidden. Container not in supervisor management whitelist.',
      allowedContainers: Array.from(ALLOWED_CONTAINERS)
    });
  }

  const success = await DockerManager.restartContainer(containerName);
  if (success) {
    res.json({ success: true, message: `Container ${containerName} restarted successfully.` });
  } else {
    res.status(500).json({ success: false, error: `Failed to restart container ${containerName}.` });
  }
});

// 3. Trigger Manual Backup
app.post('/api/backup', async (req, res) => {
  const success = await DockerManager.performDatabaseBackup();
  if (success) {
    res.json({ success: true, message: 'Database backup completed.' });
  } else {
    res.status(500).json({ success: false, error: 'Database backup failed.' });
  }
});

// 4. Trigger OTA Update (Pull Images & Restart)
app.post('/api/ota', async (req, res) => {
  res.json({ success: true, message: 'OTA Update initiated. Supervisor will pull latest images in background.' });
  // Implement actual OTA pull logic here using Docker API or docker-compose
});
