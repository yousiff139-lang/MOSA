#!/bin/sh
set -e

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore.sh <path-to-backup.sql.gz>"
  exit 1
fi

echo "⚠️ WARNING: This will restore database from $BACKUP_FILE"

if echo "$BACKUP_FILE" | grep -q '\.gz$'; then
  gunzip -c "$BACKUP_FILE" | docker exec -i mosa-postgres psql -U mosa_user -d mosa_db
else
  cat "$BACKUP_FILE" | docker exec -i mosa-postgres psql -U mosa_user -d mosa_db
fi

echo "✅ Database restore completed successfully."
