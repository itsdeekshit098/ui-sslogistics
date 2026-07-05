-- Create the enum (only if it doesn't already exist)
CREATE TYPE fuel_type_enum AS ENUM (
    'DIESEL',
    'PETROL',
    'CNG',
    'LPG',
    'ELECTRIC',
    'HYBRID',
    'LNG'
);

-- Convert existing values to uppercase
UPDATE vehicles
SET fuel_type = UPPER(TRIM(fuel_type))
WHERE fuel_type IS NOT NULL;

-- Remove the old default
ALTER TABLE vehicles
ALTER COLUMN fuel_type DROP DEFAULT;

-- Convert to enum
ALTER TABLE vehicles
ALTER COLUMN fuel_type
TYPE fuel_type_enum
USING fuel_type::fuel_type_enum;

-- Set the new default (optional)
ALTER TABLE vehicles
ALTER COLUMN fuel_type
SET DEFAULT 'DIESEL';

-- Convert seating_capacity to integer
ALTER TABLE vehicles
ALTER COLUMN seating_capacity
TYPE INTEGER
USING NULLIF(TRIM(seating_capacity), '')::INTEGER;