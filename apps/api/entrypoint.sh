#!/bin/sh
set -e

echo "[MOSA-API] Waiting for PostgreSQL to be ready..."
# A simple wait could be added here, but docker-compose healthchecks usually handle it

echo "[MOSA-API] Applying Database Schema (db push)..."
npx prisma db push --schema=packages/db/prisma/schema.prisma --accept-data-loss --skip-generate

echo "[MOSA-API] Starting the backend server..."
npm start --workspace=apps/api
