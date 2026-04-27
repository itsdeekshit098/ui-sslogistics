-- ============================================================
-- DIESEL RECORDS — Full Cycle Tracking Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add vehicle master fields needed for diesel cycle logic
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS expected_kml NUMERIC(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tank_capacity NUMERIC(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fuel_type TEXT DEFAULT 'Diesel';

COMMENT ON COLUMN vehicles.expected_kml IS 'Expected Km/L — manufacturer or historical benchmark';
COMMENT ON COLUMN vehicles.tank_capacity IS 'Tank capacity in litres — used for fill validation';
COMMENT ON COLUMN vehicles.fuel_type IS 'Diesel / Petrol / CNG';

-- 2. Create diesel_records table
CREATE TABLE IF NOT EXISTS diesel_records (
  id            BIGSERIAL PRIMARY KEY,

  -- INPUT fields (what user enters)
  vehicle_id    INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_name   TEXT NOT NULL,
  fill_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fill_type     TEXT NOT NULL CHECK (fill_type IN ('full', 'partial')),
  fuel_litres   NUMERIC(8,2) NOT NULL CHECK (fuel_litres > 0),
  price_per_l   NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (price_per_l >= 0),
  current_odo   NUMERIC(12,1) NOT NULL CHECK (current_odo >= 0),
  station       TEXT,
  payment_method TEXT CHECK (payment_method IN ('Cash', 'Card', 'UPI', 'Fleet') OR payment_method IS NULL),
  receipt_number TEXT,
  notes         TEXT,

  -- DERIVED fields (system calculates)
  amount        NUMERIC(10,2) NOT NULL,          -- litres × price
  prev_odo      NUMERIC(12,1),                   -- last odo for this vehicle
  distance      NUMERIC(10,1),                   -- current_odo − prev_odo
  kml           NUMERIC(8,2),                    -- cycle distance ÷ cycle litres (full fill closing cycle only)
  expected_kml  NUMERIC(6,2),                    -- snapshot from vehicle master at time of fill
  dev_pct       NUMERIC(8,2),                    -- deviation % from expected
  cost_per_km   NUMERIC(8,2),                    -- amount ÷ distance (cycle)
  cycle_distance NUMERIC(10,1),                  -- total distance in the cycle (full fill to full fill)
  cycle_fuel    NUMERIC(10,2),                   -- total fuel consumed in the cycle
  cycle_id      INTEGER NOT NULL DEFAULT 1,      -- increments per vehicle on every full fill
  cycle_status  TEXT NOT NULL CHECK (cycle_status IN ('open', 'closed')),

  -- AUDIT
  verified_by   TEXT,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_diesel_vehicle_id ON diesel_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_diesel_vehicle_odo ON diesel_records(vehicle_id, current_odo DESC);
CREATE INDEX IF NOT EXISTS idx_diesel_vehicle_cycle ON diesel_records(vehicle_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_diesel_fill_date ON diesel_records(fill_date DESC);

-- 4. Unique constraint: same vehicle + same odometer = duplicate
CREATE UNIQUE INDEX IF NOT EXISTS idx_diesel_no_dup_odo ON diesel_records(vehicle_id, current_odo);

-- 5. RLS (Row Level Security) — admin/service role only
ALTER TABLE diesel_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON diesel_records
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Add cycle_distance and cycle_fuel columns (if table already exists)
-- ============================================================
ALTER TABLE diesel_records ADD COLUMN IF NOT EXISTS cycle_distance NUMERIC(10,1);
ALTER TABLE diesel_records ADD COLUMN IF NOT EXISTS cycle_fuel NUMERIC(10,2);

-- ============================================================
-- DONE — Now update your vehicles with expected_kml & tank_capacity
-- Example:
--   UPDATE vehicles SET expected_kml = 4.5, tank_capacity = 200 WHERE id = 1;
-- ============================================================
