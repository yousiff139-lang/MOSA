-- Enable TimescaleDB extension if not already enabled
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert EnergyLog to a hypertable, partitioned by timestamp
-- Only convert if it is not already a hypertable
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'EnergyLog'
    ) THEN
        PERFORM create_hypertable('"EnergyLog"', 'timestamp', if_not_exists => TRUE);
    END IF;
END
$$;
