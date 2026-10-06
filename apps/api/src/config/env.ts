import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().optional().default('8080'),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/mosa'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters long'),
  
  // Security: Admin bootstrap PIN for first-boot only
  ADMIN_BOOTSTRAP_PIN: z.string().min(6, 'ADMIN_BOOTSTRAP_PIN must be at least 6 characters').optional(),
  
  // Security: Backup encryption key (required for encrypted backups)
  BACKUP_ENCRYPTION_KEY: z.string().min(32, 'BACKUP_ENCRYPTION_KEY must be at least 32 characters').optional(),
  
  MQTT_BROKER_URL: z.string().url().default('mqtts://localhost:8883'),
  MQTT_CLIENT_ID: z.string().default('mosa-backend'),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_RECONNECT_PERIOD: z.string().default('5000'),
  REDIS_URL: z.string().url().optional().default('redis://localhost:6379'),
  OPENAI_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ CRITICAL: Invalid environment variables detected. The server cannot start.");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
