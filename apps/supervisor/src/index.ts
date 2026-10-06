import dotenv from 'dotenv';
import { app } from './api';
import { startCronJobs } from './cron';

dotenv.config();

const PORT = process.env.SUPERVISOR_PORT || 9001;

async function bootstrap() {
  console.log(`[Supervisor] Initializing MOSA Supervisor Daemon...`);
  
  // Start automated background tasks (healing + backups)
  startCronJobs();

  // Start internal API
  app.listen(PORT, () => {
    console.log(`[Supervisor] API Server listening on port ${PORT}`);
    console.log(`[Supervisor] Protected by SUPERVISOR_SECRET: ${process.env.SUPERVISOR_SECRET ? 'Yes' : 'Using Default'}`);
  });
}

bootstrap();
