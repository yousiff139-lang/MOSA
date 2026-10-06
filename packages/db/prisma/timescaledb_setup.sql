-- ====================================================
-- MOSA TimescaleDB Setup Script
-- Run this manually against the Postgres database
-- ====================================================

-- 1. Enable TimescaleDB Extension (Requires a Postgres image that supports it)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 2. Convert the EnergyLog table into a Hypertable
-- This allows massive scaling and real-time chunking based on 'timestamp'
SELECT create_hypertable('EnergyLog', 'timestamp');

-- 3. Set a retention policy (e.g. drop raw telemetry older than 1 year)
-- SELECT add_retention_policy('EnergyLog', INTERVAL '1 year');
