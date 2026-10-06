import { prisma } from '../lib/prisma';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';

export class MigrationRunner {
  async runMigrations(migrationFiles: string[]): Promise<void> {
    if (!migrationFiles || !migrationFiles.length) return;
    
    console.log(`[Migration] Running ${migrationFiles.length} migrations`);
    
    for (const migrationFile of migrationFiles) {
      await this.runSingleMigration(migrationFile);
    }
  }
  
  private async runSingleMigration(filePath: string): Promise<void> {
    if (!existsSync(filePath)) {
      console.warn(`[Migration] Migration file not found: ${filePath}`);
      return;
    }

    const sql = readFileSync(filePath, 'utf8');
    const migrationName = path.basename(filePath, '.sql');
    
    // Check if already applied
    const applied = await prisma.$queryRaw<any[]>`
      SELECT id FROM "_prisma_migrations"
      WHERE migration_name = ${migrationName}
      AND finished_at IS NOT NULL
    `.catch(() => [] as any[]);
    
    if (applied.length > 0) {
      console.log(`[Migration] Already applied: ${migrationName}`);
      return;
    }
    
    // Execute SQL directly on the database
    await prisma.$transaction(async (tx) => {
      console.log(`[Migration] Applying: ${migrationName}`);
      await tx.$executeRawUnsafe(sql);
    });
  }
  
  async rollbackMigrations(failedMigrationFiles: string[]): Promise<void> {
    console.warn('[Migration] Rolling back migrations...');
    
    for (const filePath of [...failedMigrationFiles].reverse()) {
      const dir = path.dirname(filePath);
      const name = path.basename(filePath, '.sql');
      const rollbackFile = path.join(dir, `${name}.rollback.sql`);
      
      if (existsSync(rollbackFile)) {
        console.log(`[Migration] Applying rollback SQL: ${rollbackFile}`);
        const rollbackSql = readFileSync(rollbackFile, 'utf8');
        await prisma.$executeRawUnsafe(rollbackSql);
      } else {
        console.warn(`[Migration] No rollback file found for ${name}. Fallback restoration suggested.`);
      }
    }
  }
}
