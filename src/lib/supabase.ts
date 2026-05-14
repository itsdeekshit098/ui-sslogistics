import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
}

if (!supabaseServiceKey) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
      "The admin client must never fall back to the anon key.",
  );
}

// Admin client strictly for NextJS backend endpoints to bypass RLS securely
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
