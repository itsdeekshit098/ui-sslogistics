-- 1. Drop the incorrect function we created earlier
DROP FUNCTION IF EXISTS get_vehicles_summary(text, text, text);

-- 2. Restore your original correct function
CREATE OR REPLACE FUNCTION get_vehicles_summary(
    p_search text DEFAULT NULL,
    p_type text DEFAULT NULL,
    p_status text DEFAULT NULL
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
        (p_status IS NULL OR p_status = '' OR status::TEXT = p_status);
END;
$$ LANGUAGE plpgsql;

-- 3. Reload the schema cache so Supabase knows about the new ENUM types!
NOTIFY pgrst, 'reload schema';