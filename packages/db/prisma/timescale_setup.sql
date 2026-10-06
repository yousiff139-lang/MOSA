-- Enable TimescaleDB Extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Convert Telemetry table to Hypertable (Partitioned by timestamp, chunks of 7 days)
SELECT create_hypertable('"Telemetry"', 'createdAt', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);

-- Create Continuous Aggregate for Hourly Stats
CREATE MATERIALIZED VIEW IF NOT EXISTS "TelemetryHourly"
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', "createdAt") AS bucket,
  "nodeId",
  AVG(CAST(payload->>'temperature' AS FLOAT)) AS avg_temp,
  AVG(CAST(payload->>'humidity' AS FLOAT)) AS avg_hum,
  MAX(CAST(payload->>'temperature' AS FLOAT)) AS max_temp
FROM "Telemetry"
GROUP BY bucket, "nodeId";

-- Retention Policy: Drop raw telemetry data older than 30 days
SELECT add_retention_policy('"Telemetry"', INTERVAL '30 days', if_not_exists => TRUE);

-- Compression Policy: Compress chunks older than 7 days
ALTER TABLE "Telemetry" SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = '"nodeId"'
);
SELECT add_compression_policy('"Telemetry"', INTERVAL '7 days', if_not_exists => TRUE);
