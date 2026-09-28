"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeftIcon,
  RefreshCwIcon,
  TruckIcon,
  PencilIcon,
  Trash2Icon,
  UploadCloudIcon,
  FileXIcon,
  ActivityIcon,
  UserIcon,
  ClockIcon,
  AlertTriangleIcon,
} from "@/components/ui/icon";
import { useRouter } from "next/navigation";
import { FeedSkeleton } from "@/components/skeletonLoader";
import { Pagination } from "@/components/pagination";
import {
  ActivityLogEntry,
  ActivityLogPurgeResponse,
  ActivityLogResponse,
} from "./activityLog.types";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { useAuth } from "@/context/AuthContext";
import {
  AL_CONTAINER,
  AL_HEADER_TITLE,
  AL_HEADER_DESC,
  ACTION_STYLES,
  ACTION_LABELS,
} from "./activityLog.styles";
import {
  DEFAULT_RETENTION_MONTHS,
  PURGE_CONFIRM_PHRASE,
  RETENTION_OPTIONS,
  retentionCutoff,
} from "./activityLog.constants";

// Lazy-loaded: superadmin-only, and opened rarely even by them — it has no
// business in the chunk that has to land before the feed can paint.
const ConfirmModal = dynamic(
  () => import("@/components/confirmModal/confirmModal"),
  { ssr: false },
);

const ACTION_ICONS: Record<string, React.ElementType> = {
  CREATE_VEHICLE: TruckIcon,
  UPDATE_VEHICLE: PencilIcon,
  DELETE_VEHICLE: Trash2Icon,
  UPLOAD_DOCUMENT: UploadCloudIcon,
  DELETE_DOCUMENT: FileXIcon,
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
  const { loading: authLoading, userRole } = useAuth();
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Purge (superadmin only)
  const isSuperAdmin = userRole === "superadmin";
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeMonths, setPurgeMonths] = useState(DEFAULT_RETENTION_MONTHS);
  const [purgePreview, setPurgePreview] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");

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

  const openPurge = () => {
    setConfirmPhrase("");
    setPurgeError(null);
    setPurgeMonths(DEFAULT_RETENTION_MONTHS);
    setPurgeOpen(true);
  };

  const closePurge = () => {
    if (purgeLoading) return;
    setPurgeOpen(false);
  };

  // Dry run: shows exactly how many entries the chosen window would remove
  // before anything is deleted. Re-runs whenever the window changes.
  useEffect(() => {
    if (!purgeOpen) return;
    let cancelled = false;

    const loadPreview = async () => {
      setPreviewLoading(true);
      setPurgePreview(null);
      setPurgeError(null);
      try {
        const before = retentionCutoff(purgeMonths).toISOString();
        const res = await fetch(
          `/api/activity-log?before=${encodeURIComponent(before)}&dryRun=true`,
          { method: "DELETE" },
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to check");
        }
        const result: ActivityLogPurgeResponse = json.data ?? {};
        setPurgePreview(result.count ?? 0);
      } catch {
        if (!cancelled) {
          setPurgeError(
            "We couldn’t check how many entries would be removed. Please try again.",
          );
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [purgeOpen, purgeMonths]);

  const handlePurge = async () => {
    setPurgeLoading(true);
    setPurgeError(null);
    try {
      const before = retentionCutoff(purgeMonths).toISOString();
      const res = await fetch(
        `/api/activity-log?before=${encodeURIComponent(before)}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to clear entries");
      }
      setPurgeOpen(false);
      setConfirmPhrase("");
      // Back to page 1 — the page the user was on may no longer exist.
      setPage(1);
      fetchLogs(1, true);
    } catch (err: unknown) {
      setPurgeError(
        err instanceof Error
          ? err.message
          : "We couldn’t clear the entries. Please try again.",
      );
    } finally {
      setPurgeLoading(false);
    }
  };

  if (authLoading) return <PageLoadingSkeleton variant="admin" />;

  return (
    <div className={AL_CONTAINER}>
      <Button
        data-testid="app-admin-activity-log-button-1"
        variant="ghost"
        onClick={() => router.back()}
        className="mb-2 w-fit -ml-2 text-muted-foreground hover:text-foreground max-md:hidden"
      >
        <ArrowLeftIcon size={16} style={{ marginRight: "0.5rem" }} />
        Back
      </Button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="max-md:hidden">
          <h1 className={AL_HEADER_TITLE}>Activity Log</h1>
          <p className={AL_HEADER_DESC}>
            Track all actions performed across the system.
          </p>
        </div>
        <div className="flex items-center gap-2 md:flex-wrap md:gap-3">
          <Badge variant="secondary" className="whitespace-nowrap text-sm font-medium px-3 py-1 max-md:mr-auto">
            <ActivityIcon size={14} className="mr-1.5" />
            {loading ? "..." : `${total} entries`}
          </Badge>
          <Button
            data-testid="app-admin-activity-log-button-2"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh"
            className="max-md:h-10 max-md:w-10 max-md:px-0"
          >
            <RefreshCwIcon
              size={16}
              className={`mr-2 max-md:mr-0 ${refreshing ? "animate-spin" : ""}`}
            />
            <span className="max-md:sr-only">Refresh</span>
          </Button>
          {isSuperAdmin && (
            <Button
              data-testid="app-admin-activity-log-button-3"
              variant="outline"
              size="sm"
              onClick={openPurge}
              aria-label="Clear Old Logs"
              className="text-destructive hover:text-destructive max-md:h-10 max-md:w-10 max-md:px-0"
            >
              <Trash2Icon size={16} className="mr-2 max-md:mr-0" />
              <span className="max-md:sr-only">Clear Old Logs</span>
            </Button>
          )}
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
          {/* Phones: no inner scroll box — the page itself scrolls, so the
              auto-load trigger below is only reached at the real end. */}
          <div className="overflow-y-auto max-h-[calc(100vh-300px)] min-h-[300px] p-4 md:p-6 pt-0 md:pt-0 animate-in fade-in duration-200 max-md:max-h-none max-md:min-h-0 max-md:overflow-visible">
            {loading && entries.length === 0 ? (
              <FeedSkeleton count={8} />
            ) : fetchError ? (
              <ErrorState
                title="Couldn\u2019t load activity log"
                description={fetchError}
                onRetry={() => fetchLogs(page)}
              />
            ) : entries.length === 0 ? (
              <EmptyState
                icon={ActivityIcon}
                title="No Activity Recorded Yet"
                description="Actions will appear here as you use the system. Try adding a vehicle or creating a diesel record."
              />
            ) : (
              <div className="space-y-1">
                {entries.map((entry) => {
                  // Theme tokens, not slate-50/700: unmapped actions (the loan,
                  // funding and attachment ones) rendered as a white tile with
                  // near-invisible text in dark mode.
                  const style = ACTION_STYLES[entry.action] || {
                    bg: "bg-muted",
                    text: "text-foreground",
                    icon: "text-muted-foreground",
                  };
                  // "CREATE_LOAN" → "Create loan" when there's no curated label.
                  const label =
                    ACTION_LABELS[entry.action] ||
                    entry.action.charAt(0) + entry.action.slice(1).toLowerCase().replace(/_/g, " ");
                  const Icon = ACTION_ICONS[entry.action] || ActivityIcon;
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
                        <Icon size={18} className={style.icon} />
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
                            <UserIcon size={12} />
                            {entry.user_display_name || entry.user_email || "System"}
                          </span>
                          <span className="flex items-center gap-1">
                            <ClockIcon size={12} />
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
                loading={loading}
                autoLoad
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

      {isSuperAdmin && purgeOpen && (
        <ConfirmModal
          isOpen={purgeOpen}
          onClose={closePurge}
          onConfirm={handlePurge}
          title="Clear Old Activity Log"
          description="Deleted entries cannot be recovered. Records themselves are untouched — only the log of who changed what is removed."
          confirmText={
            purgePreview !== null && purgePreview > 0
              ? `Delete ${purgePreview} ${purgePreview === 1 ? "Entry" : "Entries"}`
              : "Delete Entries"
          }
          isLoading={purgeLoading}
          confirmDisabled={
            previewLoading ||
            purgePreview === null ||
            purgePreview === 0 ||
            confirmPhrase !== PURGE_CONFIRM_PHRASE
          }
          error={purgeError}
          icon={<AlertTriangleIcon size={24} style={{ color: "#dc2626" }} />}
        >
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purge-window">Delete entries</Label>
              <Select
                data-testid="app-admin-activity-log-select-1"
                value={String(purgeMonths)}
                onValueChange={(v) => setPurgeMonths(Number(v))}
              >
                <SelectTrigger id="purge-window" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETENTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.months} value={String(opt.months)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Nothing from the last 60 days can be deleted.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
              {previewLoading ? (
                <span className="text-muted-foreground">Checking…</span>
              ) : purgePreview === null ? (
                <span className="text-muted-foreground">—</span>
              ) : purgePreview === 0 ? (
                <span className="text-muted-foreground">
                  No entries are older than this. Nothing to delete.
                </span>
              ) : (
                <span>
                  <span className="font-semibold text-destructive">
                    {purgePreview}
                  </span>{" "}
                  of {total} entries will be permanently deleted, leaving{" "}
                  {total - purgePreview}.
                </span>
              )}
            </div>

            {purgePreview !== null && purgePreview > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="purge-confirm">
                  Type {PURGE_CONFIRM_PHRASE} to confirm
                </Label>
                <Input
                  id="purge-confirm"
                  value={confirmPhrase}
                  autoComplete="off"
                  disabled={purgeLoading}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder={PURGE_CONFIRM_PHRASE}
                />
              </div>
            )}
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}
