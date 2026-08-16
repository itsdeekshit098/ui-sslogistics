export interface ActivityLogEntry {
  id: number;
  action: string;
  user_id: string | null;
  user_email: string | null;
  user_display_name: string | null;
  table_name: string;
  record_id: number | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ActivityLogResponse {
  data: ActivityLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Response from DELETE /api/activity-log — `count` on a dry run, `deleted`
 * once entries are actually removed. */
export interface ActivityLogPurgeResponse {
  cutoff: string;
  count?: number;
  deleted?: number;
  dryRun?: boolean;
}
