import { supabaseAdmin } from "@/lib/supabase";

export interface MaintenanceStatus {
  maintenanceMode: boolean;
  message: string | null;
}

const DEFAULT_STATUS: MaintenanceStatus = {
  maintenanceMode: false,
  message: null,
};

/**
 * Maintenance mode is read on (nearly) every request via middleware, which
 * cannot afford a DB round trip each time. Cache the flag briefly — a stale
 * read for up to CACHE_TTL_MS just means a client's *next* request is the
 * one that gets blocked, not a security hole (already-open sessions get
 * pushed to the maintenance screen instantly via the SSE stream instead).
 */
const CACHE_TTL_MS = 5_000;
let cached: { status: MaintenanceStatus; fetchedAt: number } | null = null;

export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.status;
  }

  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("maintenance_mode, maintenance_message")
    .eq("singleton", true)
    .maybeSingle();

  const status: MaintenanceStatus =
    !error && data
      ? {
          maintenanceMode: !!data.maintenance_mode,
          message: data.maintenance_message ?? null,
        }
      : DEFAULT_STATUS;

  cached = { status, fetchedAt: Date.now() };
  return status;
}

/**
 * Uncached read, straight from the DB. Used by the SSE stream route, which
 * polls this on its own short interval to detect changes and push them to
 * connected clients — the 5s middleware cache above is too coarse for that.
 */
export async function getMaintenanceStatusUncached(): Promise<MaintenanceStatus> {
  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("maintenance_mode, maintenance_message")
    .eq("singleton", true)
    .maybeSingle();

  return !error && data
    ? {
        maintenanceMode: !!data.maintenance_mode,
        message: data.maintenance_message ?? null,
      }
    : DEFAULT_STATUS;
}

export async function setMaintenanceMode(
  maintenanceMode: boolean,
  message: string | null,
  updatedBy: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("system_settings")
    .update({
      maintenance_mode: maintenanceMode,
      maintenance_message: message,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("singleton", true);

  if (error) {
    throw new Error(`Failed to update maintenance mode: ${error.message}`);
  }

  // Invalidate the middleware cache immediately so this server instance's
  // next request already reflects the change, instead of waiting out the TTL.
  cached = null;
}

export interface AppVersionConfig {
  minAndroidVersionCode: number | null;
  forceUpdateMessage: string | null;
}

const DEFAULT_APP_VERSION_CONFIG: AppVersionConfig = {
  minAndroidVersionCode: null,
  forceUpdateMessage: null,
};

/**
 * Read only, no caching — unlike maintenance mode this isn't checked on
 * every request via middleware, only once per mobile app-session on
 * startup/resume, so a DB round trip per call is fine.
 */
export async function getAppVersionConfigUncached(): Promise<AppVersionConfig> {
  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("min_android_version_code, force_update_message")
    .eq("singleton", true)
    .maybeSingle();

  return !error && data
    ? {
        minAndroidVersionCode: data.min_android_version_code ?? null,
        forceUpdateMessage: data.force_update_message ?? null,
      }
    : DEFAULT_APP_VERSION_CONFIG;
}

export async function setMinAndroidVersionCode(
  versionCode: number | null,
  message: string | null,
  updatedBy: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("system_settings")
    .update({
      min_android_version_code: versionCode,
      force_update_message: message,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("singleton", true);

  if (error) {
    throw new Error(`Failed to update minimum app version: ${error.message}`);
  }
}
