import { supabaseAdmin } from "@/lib/supabase";

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
  | "RESET_PASSWORD";

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
  } catch (err) {
    // Log to server console but never fail the parent request
    console.error("Failed to write activity log:", err);
  }
}
