#!/bin/sh
set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mosa_backup_${TIMESTAMP}.sql.gz"

echo "📦 Starting Automated PostgreSQL Backup..."

if command -v pg_dump >/dev/null 2>&1; then
  PGPASSWORD="${POSTGRES_PASSWORD:-mosa_secure_pass_2026}" pg_dump -h "${POSTGRES_HOST:-mosa-postgres}" -U "${POSTGRES_USER:-mosa_user}" -d "${POSTGRES_DB:-mosa_db}" | gzip > "$BACKUP_FILE"
elif command -v docker >/dev/null 2>&1; then
  docker exec mosa-postgres pg_dump -U mosa_user mosa_db | gzip > "$BACKUP_FILE"
else
  echo "❌ Neither pg_dump nor docker found."
  exit 1
fi

echo "✅ Backup successfully created at: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
