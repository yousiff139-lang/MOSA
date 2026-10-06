#!/bin/bash
# Automated Restore Verification Test
set -e

echo "🧪 Starting Automated Restore Verification..."

LATEST_BACKUP=$(ls -t backups/ | head -n1)
if [ -z "$LATEST_BACKUP" ]; then
  echo "No backup found to test."
  exit 1
fi

BACKUP_PATH="backups/$LATEST_BACKUP/db.dump"
echo "Testing restore of: $BACKUP_PATH"

# 1. Spin up an isolated temporary Postgres container
docker run --name mosa-test-db -e POSTGRES_USER=mosa_user -e POSTGRES_PASSWORD=test -e POSTGRES_DB=mosa_db -d postgres:15-alpine
echo "Waiting for test DB to initialize..."
sleep 5

# 2. Perform the restore
cat "$BACKUP_PATH" | docker exec -i mosa-test-db pg_restore -U mosa_user -d mosa_db -c --if-exists

# 3. Verify data (e.g., Check if 'User' table exists and has rows)
echo "Verifying data integrity..."
USERS_COUNT=$(docker exec mosa-test-db psql -U mosa_user -d mosa_db -t -c "SELECT count(*) FROM \"User\";" | tr -d ' ')

if [ -n "$USERS_COUNT" ] && [ "$USERS_COUNT" -gt 0 ]; then
  echo "✅ Restore Test Passed! Found $USERS_COUNT users."
else
  echo "❌ Restore Test Failed! Users table empty or missing."
  docker stop mosa-test-db && docker rm mosa-test-db
  exit 1
fi

# 4. Cleanup
echo "Cleaning up test container..."
docker stop mosa-test-db && docker rm mosa-test-db

echo "🎉 Automated restore test successful."
