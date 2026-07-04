-- Allow admin users to keep 2 concurrent sessions instead of 1.
-- Replaces the previous fixed LIMIT 1 with a role-aware cap:
-- admins keep their 2 most recent sessions, everyone else keeps 1.
--
-- Previous definition (for reference):
--   BEGIN
--     -- Delete all sessions for this user except the most recent one
--     DELETE FROM auth.sessions
--     WHERE user_id = target_user_id
--       AND id NOT IN (
--         SELECT id
--         FROM auth.sessions
--         WHERE user_id = target_user_id
--         ORDER BY created_at DESC
--         LIMIT 1
--       );
--   END;

CREATE OR REPLACE FUNCTION revoke_old_user_sessions(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_cap int;
BEGIN
  SELECT CASE
    WHEN raw_app_meta_data->>'role' = 'admin' THEN 2
    ELSE 1
  END
  INTO session_cap
  FROM auth.users
  WHERE id = target_user_id;

  -- Delete all sessions for this user except the session_cap most recent ones
  DELETE FROM auth.sessions
  WHERE user_id = target_user_id
    AND id NOT IN (
      SELECT id
      FROM auth.sessions
      WHERE user_id = target_user_id
      ORDER BY created_at DESC
      LIMIT session_cap
    );
END;
$$;
