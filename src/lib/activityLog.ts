import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export type AuditAction =
  | "CREATE_VEHICLE"
  | "UPDATE_VEHICLE"
  | "DELETE_VEHICLE"
  | "UPLOAD_DOCUMENT"
  | "DELETE_DOCUMENT"
  | "CREATE_DIESEL_RECORD"
  | "UPDATE_DIESEL_RECORD"
  | "DELETE_DIESEL_RECORD"
  | "CREATE_REPAIR_RECORD"
  | "UPDATE_REPAIR_RECORD"
  | "DELETE_REPAIR_RECORD"
  // Technicians
  | "CREATE_TECHNICIAN"
  | "UPDATE_TECHNICIAN"
  | "DELETE_TECHNICIAN"
  // Drivers
  | "CREATE_DRIVER"
  | "UPDATE_DRIVER"
  | "DELETE_DRIVER"
  // External Trips
  | "CREATE_EXTERNAL_TRIP"
  | "UPDATE_EXTERNAL_TRIP"
  | "DELETE_EXTERNAL_TRIP"
  // Session Management
  | "BAN_USER"
  | "UNBAN_USER"
  | "REVOKE_SESSIONS"
  | "RESET_PASSWORD"
  // Warranty / Vendors / Parts
  | "CREATE_VENDOR"
  | "UPDATE_VENDOR"
  | "CREATE_PART_OPTION"
  | "CREATE_REPAIR_PART"
  | "UPDATE_REPAIR_PART"
  | "DELETE_REPAIR_PART";

interface LogActivityParams {
  action: AuditAction;
  userId: string | null;
  userEmail: string | null;
  tableName: string;
  recordId: number | string | null;
  details?: Record<string, unknown>;
}

/**
 * Writes an entry to the activity_log table.
 * Fires and forgets — does NOT block the API response if logging fails.
 */
export async function logActivity({
  action,
  userId,
  userEmail,
  tableName,
  recordId,
  details = {},
}: LogActivityParams): Promise<void> {
  try {
    await supabaseAdmin.from("activity_log").insert([
      {
        action,
        user_id: userId,
        user_email: userEmail,
        table_name: tableName,
        record_id: recordId ? Number(recordId) : null,
        details,
      },
    ]);
  } catch (err: unknown) {
    // Log to server console but never fail the parent request.
    // Sanitize: capture message only, never stack traces.
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Failed to write activity log", {
      action,
      error: errorMessage,
    });
  }
}
