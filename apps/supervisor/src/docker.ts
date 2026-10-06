import Docker from 'dockerode';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);
const isWin = process.platform === 'win32';
const dockerHostEnv = process.env.DOCKER_HOST;
let dockerOptions: any;

if (dockerHostEnv) {
  const url = new URL(dockerHostEnv.replace(/^tcp:\/\//, 'http://'));
  dockerOptions = {
    host: url.hostname,
    port: parseInt(url.port || '2375', 10)
  };
} else {
  dockerOptions = isWin ? { socketPath: '//./pipe/docker_engine' } : { socketPath: '/var/run/docker.sock' };
}

const docker = new Docker(dockerOptions);

export class DockerManager {
  
  // 1. Check if a container is running
  static async isContainerRunning(containerName: string): Promise<boolean> {
    try {
      const container = docker.getContainer(containerName);
      const data = await container.inspect();
      return data.State.Running;
    } catch (e) {
      return false; // Container doesn't exist or is down
    }
  }

  // 2. Restart a container
  static async restartContainer(containerName: string): Promise<boolean> {
    try {
      console.log(`[Supervisor] Restarting container: ${containerName}`);
      const container = docker.getContainer(containerName);
      await container.restart();
      return true;
    } catch (e: any) {
      console.error(`[Supervisor] Failed to restart ${containerName}:`, e.message);
      return false;
    }
  }

  // 3. PostgreSQL Backup (Using direct Docker API instead of shell execution)
  static async performDatabaseBackup(): Promise<boolean> {
    try {
      console.log(`[Supervisor] Starting PostgreSQL Snapshot via Dockerode API...`);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `/var/lib/postgresql/data/backup_${timestamp}.sql`;
      
      const pgContainer = docker.getContainer('mosa-postgres');
      const execInstance = await pgContainer.exec({
        Cmd: [
          'pg_dump',
          '-U',
          process.env.POSTGRES_USER || 'mosa_admin',
          '-d',
          process.env.POSTGRES_DB || 'mosa_db',
          '-F',
          'c',
          '-f',
          backupFilename
        ],
        AttachStdout: true,
        AttachStderr: true
      });

      await execInstance.start({});
      console.log(`[Supervisor ✅] DB Backup initiated securely: ${backupFilename}`);
      return true;
    } catch (error: any) {
      console.error(`[Supervisor 🛑] DB Backup failed:`, error.message);
      return false;
    }
  }

  // 4. Get System Health
  static async getSystemHealth() {
    try {
      const containers = await docker.listContainers({ all: true });
      const running = containers.filter(c => c.State === 'running').length;
      const total = containers.length;
      return {
        status: running === total ? 'healthy' : 'degraded',
        runningContainers: running,
        totalContainers: total,
        containers: containers.map(c => ({
          name: c.Names[0].replace('/', ''),
          state: c.State,
          status: c.Status
        }))
      };
    } catch (e: any) {
      return { error: e.message };
    }
  }
}
