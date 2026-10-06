-- Convert existing tables to hypertables for TimescaleDB
-- EnergyLog
SELECT create_hypertable(
  '"EnergyLog"',
  'timestamp',
  if_not_exists => TRUE
);

ALTER TABLE "EnergyLog" SET (
  timescaledb.compress,
  timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy(
  '"EnergyLog"',
  INTERVAL '7 days'
);

SELECT add_retention_policy(
  '"EnergyLog"',
  INTERVAL '30 days'
);

-- MotionLog
SELECT create_hypertable(
  '"MotionLog"',
  'timestamp',
  if_not_exists => TRUE
);

ALTER TABLE "MotionLog" SET (
  timescaledb.compress,
  timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy(
  '"MotionLog"',
  INTERVAL '7 days'
);

SELECT add_retention_policy(
  '"MotionLog"',
  INTERVAL '30 days'
);
