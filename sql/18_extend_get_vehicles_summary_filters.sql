-- Extends get_vehicles_summary to accept the owner_type/owner_name/fuel_type
-- filters added to GET /api/vehicles (src/app/api/vehicles/route.ts), so the
-- Vehicles list's stat tiles (Total/Active/Maintenance/Idle) match whatever
-- filter combination is currently applied instead of only search/type/status.
--
-- Apply manually in the Supabase SQL editor after
-- sql/2026-07-02_restore_get_vehicles_summary.sql — there is no migration
-- runner in this repo.

-- 1. Drop the previous 3-arg signature — adding parameters changes the
--    function's identity in Postgres, so CREATE OR REPLACE alone won't do.
DROP FUNCTION IF EXISTS get_vehicles_summary(text, text, text);

-- 2. Recreate with the additional filters, defaulting to NULL (= no filter)
--    so any existing caller passing only the original 3 args keeps working.
CREATE OR REPLACE FUNCTION get_vehicles_summary(
    p_search text DEFAULT NULL,
    p_type text DEFAULT NULL,
    p_status text DEFAULT NULL,
    p_owner_type text DEFAULT NULL,
    p_owner_name text DEFAULT NULL,
    p_fuel_type text DEFAULT NULL
) RETURNS TABLE (
    total_count bigint,
    active_count bigint,
    maintenance_count bigint,
    idle_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) AS total_count,
        COUNT(*) FILTER (WHERE status::TEXT = 'Active') AS active_count,
        COUNT(*) FILTER (WHERE status::TEXT = 'Maintenance') AS maintenance_count,
        COUNT(*) FILTER (WHERE status::TEXT = 'Idle') AS idle_count
    FROM public.vehicles
    WHERE
        (p_search IS NULL OR p_search = '' OR vehicle_number ILIKE '%' || p_search || '%')
        AND
        (p_type IS NULL OR p_type = '' OR vehicle_type::TEXT = p_type)
        AND
        (p_status IS NULL OR p_status = '' OR status::TEXT = p_status)
        AND
        (p_owner_type IS NULL OR p_owner_type = '' OR owner_type::TEXT = p_owner_type)
        AND
        (p_owner_name IS NULL OR p_owner_name = '' OR owner_name = p_owner_name)
        AND
        (p_fuel_type IS NULL OR p_fuel_type = '' OR fuel_type::TEXT = p_fuel_type);
END;
$$ LANGUAGE plpgsql;

-- 3. Reload the schema cache so PostgREST/Supabase picks up the new signature.
NOTIFY pgrst, 'reload schema';
