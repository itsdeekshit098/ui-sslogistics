-- Drop constraints first
ALTER TABLE vehicles
DROP CONSTRAINT IF EXISTS vehicles_owner_id_required_for_external;

ALTER TABLE vehicles
DROP CONSTRAINT IF EXISTS vehicles_owner_type_check;

-- Drop the foreign key column first, then owner_type
ALTER TABLE vehicles
DROP COLUMN IF EXISTS owner_id,
DROP COLUMN IF EXISTS owner_type;

-- Drop the unique index
DROP INDEX IF EXISTS vehicle_owners_name_key;

-- Drop the vehicle owners table
DROP TABLE IF EXISTS vehicle_owners;