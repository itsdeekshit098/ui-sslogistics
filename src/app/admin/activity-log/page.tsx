"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  RefreshCw,
  Truck,
  Pencil,
  Trash2,
  UploadCloud,
  FileX,
  Activity,
  User,
  Clock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/skeletonLoader";
import { Pagination } from "@/components/pagination";
import { ActivityLogEntry, ActivityLogResponse } from "./activityLog.types";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import {
  AL_CONTAINER,
  AL_HEADER_TITLE,
  AL_HEADER_DESC,
  ACTION_STYLES,
  ACTION_LABELS,
} from "./activityLog.styles";

const ACTION_ICONS: Record<string, React.ElementType> = {
  CREATE_VEHICLE: Truck,
  UPDATE_VEHICLE: Pencil,
  DELETE_VEHICLE: Trash2,
  UPLOAD_DOCUMENT: UploadCloud,
  DELETE_DOCUMENT: FileX,
};

/**
 * Formats a detail value for display. Handles nested objects.
 */
function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * Formats a detail key for display.
 * e.g., "vehicle_number" → "Vehicle Number"
 */
function formatDetailKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Formats relative time like "2 min ago", "1 hour ago", etc.
 */
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: diffDays > 365 ? "numeric" : undefined,
  });
}

export default function ActivityLogPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(
    async (pageNum: number, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setFetchError(null);

      try {
        const res = await fetch(
          `/api/activity-log?page=${pageNum}&limit=${pageSize}`,
        );
        if (!res.ok) throw new Error("Failed to fetch");

        const json = await res.json();
        const result: ActivityLogResponse = json.data ?? {};
        setEntries(result.data ?? []);
        setTotal(result.total ?? 0);
      } catch {
        setFetchError(
          "We couldn\u2019t load the activity log. Please check your connection and try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pageSize],
  );

  useEffect(() => {
    fetchLogs(page);
  }, [page, pageSize, fetchLogs]);

  const handleRefresh = () => {
    fetchLogs(page, true);
  };

  return (
    <div className={AL_CONTAINER}>
      <Button
        data-testid="app-admin-activity-log-button-1"
        variant="ghost"
        onClick={() => router.back()}
        className="mb-2 w-fit -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={AL_HEADER_TITLE}>Activity Log</h1>
          <p className={AL_HEADER_DESC}>
            Track all actions performed across the system.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm font-medium px-3 py-1">
            <Activity className="h-3.5 w-3.5 mr-1.5" />
            {loading ? "..." : `${total} entries`}
          </Badge>
          <Button
            data-testid="app-admin-activity-log-button-2"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Activity Feed */}
      <Card
        data-testid="app-admin-activity-log-card-1"
        className="flex flex-col overflow-hidden shadow-sm"
      >
        <CardHeader className="p-4 md:p-6 pb-2 md:pb-3 shrink-0">
          <CardTitle className="text-lg md:text-xl">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col p-0">
          <div className="overflow-y-auto max-h-[calc(100vh-300px)] min-h-[300px] p-4 md:p-6 pt-0 md:pt-0">
            {loading ? (
              <div className="space-y-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-3">
                    <Skeleton
                      width="40px"
                      height="40px"
                      borderRadius="10px"
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0 pt-1">
                      <Skeleton width="30%" height="16px" borderRadius="4px" />
                      <Skeleton
                        width="60%"
                        height="14px"
                        borderRadius="4px"
                        className="mt-2"
                      />
                      <Skeleton
                        width="25%"
                        height="12px"
                        borderRadius="4px"
                        className="mt-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : fetchError ? (
              <ErrorState
                title="Couldn\u2019t load activity log"
                description={fetchError}
                onRetry={() => fetchLogs(page)}
              />
            ) : entries.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No Activity Recorded Yet"
                description="Actions will appear here as you use the system. Try adding a vehicle or creating a diesel record."
              />
            ) : (
              <div className="space-y-1">
                {entries.map((entry) => {
                  const style = ACTION_STYLES[entry.action] || {
                    bg: "bg-slate-50",
                    text: "text-slate-700",
                    icon: "text-slate-500",
                  };
                  const label = ACTION_LABELS[entry.action] || entry.action;
                  const Icon = ACTION_ICONS[entry.action] || Activity;
                  const details = entry.details || {};
                  const vehicleNumber =
                    (details.vehicle_number as string) ||
                    ((details.changes as Record<string, unknown>)
                      ?.vehicle_number as string) ||
                    null;

                  return (
                    <div
                      key={entry.id}
                      className="group flex gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      {/* Icon */}
                      <div
                        className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-xl ${style.bg}`}
                      >
                        <Icon className={`h-4.5 w-4.5 ${style.icon}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <span
                            className={`text-sm font-semibold ${style.text}`}
                          >
                            {label}
                          </span>
                          {vehicleNumber && (
                            <span className="text-sm text-foreground font-medium">
                              · {vehicleNumber}
                            </span>
                          )}
                        </div>

                        {/* Details */}
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground w-full">
                          {Object.entries(details)
                            .filter(
                              ([key]) =>
                                key !== "vehicle_number" && key !== "changes",
                            )
                            .map(([key, value]) => (
                              <span
                                key={key}
                                className="inline-flex max-w-full truncate items-baseline pr-1"
                              >
                                <span className="shrink-0">
                                  {formatDetailKey(key)}:
                                </span>{" "}
                                <span className="text-foreground/70 truncate ml-1">
                                  {formatDetailValue(value)}
                                </span>
                              </span>
                            ))}
                          {!!details.changes &&
                            typeof details.changes === "object" &&
                            Object.entries(
                              details.changes as Record<string, unknown>,
                            )
                              .filter(([key]) => key !== "updated_by")
                              .slice(0, 4)
                              .map(([key, value]) => (
                                <span
                                  key={key}
                                  className="inline-flex max-w-full truncate items-baseline pr-1"
                                >
                                  <span className="shrink-0">
                                    {formatDetailKey(key)}:
                                  </span>{" "}
                                  <span className="text-foreground/70 truncate ml-1">
                                    {formatDetailValue(value)}
                                  </span>
                                </span>
                              ))}
                        </div>

                        {/* User + Time */}
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground/70">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {entry.user_email || "System"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatRelativeTime(entry.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div className="relative z-20 shrink-0 border-t border-border bg-background px-4 py-2 shadow-[0_-4px_6px_-4px_rgba(0,0,0,0.05)]">
              <Pagination
                page={page}
                totalCount={total}
                pageSize={pageSize}
                pageSizeOptions={[10, 20, 50, 100]}
                onPageChange={(p) => setPage(p)}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1); // Reset to page 1
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
