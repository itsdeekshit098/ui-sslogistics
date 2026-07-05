
-- ────────────────────────────────────────────────────────────
-- STEP 5: Create ENUM types
-- ────────────────────────────────────────────────────────────
CREATE TYPE vehicle_type_enum AS ENUM (
  'CAR',
  'BUS',
  'TEMPO_TRAVELLER',
  'TRUCK',
  'CONTAINER'
);
CREATE TYPE truck_type_enum AS ENUM (
  'MINI_TRUCK',
  'PICKUP_TRUCK',
  'LCV',
  'MCV',
  'HCV',
  'TIPPER_TRUCK',
  'TANKER',
  'TRAILER_TRUCK'
);
CREATE TYPE container_length_enum AS ENUM (
  '19_FT',
  '20_FT',
  '22_FT',
  '24_FT',
  '32_FT',
  '40_FT'
);
CREATE TYPE axle_type_enum AS ENUM (
  'SINGLE_AXLE',
  'MULTI_AXLE',
  'TRAILER'
);
CREATE TYPE container_body_type_enum AS ENUM (
  'CLOSED',
  'FLATBED_OPEN'
);
-- ────────────────────────────────────────────────────────────
-- STEP 6: Cast columns to their enum types
--         USING casts the existing TEXT values to the enum.
--         Any row with an unlisted value will error here —
--         which is exactly what we want (clean data only).
-- ────────────────────────────────────────────────────────────
ALTER TABLE vehicles
  ALTER COLUMN vehicle_type TYPE vehicle_type_enum
    USING vehicle_type::vehicle_type_enum;
ALTER TABLE vehicles
  ALTER COLUMN truck_type TYPE truck_type_enum
    USING truck_type::truck_type_enum;
ALTER TABLE vehicles
  ALTER COLUMN container_length TYPE container_length_enum
    USING container_length::container_length_enum;
ALTER TABLE vehicles
  ALTER COLUMN axle_type TYPE axle_type_enum
    USING axle_type::axle_type_enum;
ALTER TABLE vehicles
  ALTER COLUMN container_body_type TYPE container_body_type_enum
    USING container_body_type::container_body_type_enum;
-- ────────────────────────────────────────────────────────────
-- Optional: verify counts after migration
-- ────────────────────────────────────────────────────────────
-- SELECT vehicle_type, COUNT(*) FROM vehicles GROUP BY vehicle_type ORDER BY vehicle_type;
-- ────────────────────────────────────────────────────────────
-- Reference: Adding new enum values in the future
-- (Postgres requires ALTER TYPE, not ALTER TABLE)
-- ────────────────────────────────────────────────────────────
-- ALTER TYPE vehicle_type_enum    ADD VALUE 'ELECTRIC_VAN';
-- ALTER TYPE truck_type_enum      ADD VALUE 'FLATBED_TRUCK';
-- ALTER TYPE container_length_enum ADD VALUE '45_FT';