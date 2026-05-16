"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  ShieldOff,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Monitor,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ConfirmModal from "@/components/confirmModal/confirmModal";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import type { SessionUser } from "./sessionsPage.types";
import * as styles from "./sessionsPage.style";

/** Format a date string to a short, readable form. */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Invalid";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Pick the right role badge style. */
function getRoleBadgeStyle(role: string | null): React.CSSProperties {
  switch (role) {
    case "admin":
      return styles.roleBadgeAdmin;
    case "staff":
      return styles.roleBadgeStaff;
    case "driver":
      return styles.roleBadgeDriver;
    default:
      return styles.roleBadgeDefault;
  }
}

type ActionType = "ban" | "unban" | "revoke";

export function SessionsPage() {
  const { userRole, loading: authLoading } = useAuth();
  const isAdmin = userRole === "admin";

  const [users, setUsers] = useState<SessionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  // Expanded user rows (to show sessions)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  // Confirmation modal state
  const [actionTarget, setActionTarget] = useState<SessionUser | null>(null);
  const [actionType, setActionType] = useState<ActionType>("ban");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    let shouldClearLoading = true;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/sessions?page=${page}&perPage=${perPage}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || "Failed to load users");
        return;
      }

      const fetchedUsers = json.data?.users ?? [];
      const fetchedTotal = json.data?.total ?? 0;

      // If we're on a page beyond results (e.g. users were deleted), reset to page 1
      // Keep loading=true so there's no flash before the re-fetch
      if (fetchedUsers.length === 0 && page > 1) {
        shouldClearLoading = false;
        setPage(1);
        return;
      }

      setUsers(fetchedUsers);
      setTotal(fetchedTotal);
    } catch {
      setError("Failed to load users");
    } finally {
      if (shouldClearLoading) setLoading(false);
    }
  }, [page, perPage]);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchUsers();
    } else if (!authLoading && !isAdmin) {
      setLoading(false);
      setError("You do not have permission to view this page");
    }
  }, [authLoading, isAdmin, fetchUsers]);

  const toggleExpand = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const openAction = (user: SessionUser, action: ActionType) => {
    setActionTarget(user);
    setActionType(action);
    setActionError(null);
  };

  const closeAction = () => {
    setActionTarget(null);
    setActionError(null);
  };

  const handleConfirmAction = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    setActionError(null);

    try {
      let res: Response;

      if (actionType === "revoke") {
        res = await fetch(
          `/api/admin/sessions?userId=${actionTarget.id}`,
          { method: "DELETE" },
        );
      } else {
        res = await fetch("/api/admin/sessions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: actionTarget.id,
            action: actionType,
          }),
        });
      }

      const json = await res.json();

      if (!res.ok || !json.success) {
        setActionError(json.error || "Action failed");
        setActionLoading(false);
        return;
      }

      await fetchUsers();
      closeAction();
    } catch {
      setActionError("Something went wrong");
    } finally {
      setActionLoading(false);
    }
  };

  const getModalConfig = () => {
    const email = actionTarget?.email || "";
    switch (actionType) {
      case "ban":
        return {
          title: "Ban User",
          description: `Are you sure you want to ban ${email}? They will be unable to log in until unbanned.`,
          confirmText: "Ban User",
          icon: <Shield className="h-6 w-6 text-red-500" />,
        };
      case "unban":
        return {
          title: "Unban User",
          description: `Are you sure you want to unban ${email}? They will regain access to the portal.`,
          confirmText: "Unban User",
          icon: <ShieldCheck className="h-6 w-6 text-emerald-500" />,
        };
      case "revoke":
        return {
          title: "Revoke All Sessions",
          description: `Are you sure you want to force sign out ${email} from all devices? They will need to log in again.`,
          confirmText: "Revoke Sessions",
          icon: <LogOut className="h-6 w-6 text-amber-500" />,
        };
    }
  };

  // ── Loading / Error / Auth states ──
  if (authLoading || loading) {
    return <PageLoadingSkeleton variant="admin" />;
  }

  if (error) {
    return <ErrorState description={error} onRetry={fetchUsers} />;
  }

  if (!isAdmin) {
    return (
      <ErrorState description="You do not have permission to view this page" />
    );
  }

  const modalConfig = getModalConfig();

  return (
    <div style={styles.pageContainer}>
      {/* Header */}
      <div style={styles.headerRow}>
        <h1 style={styles.pageTitle}>Session Management</h1>
        <p style={styles.pageDescription}>
          View all registered users, their active sessions, and manage access.
        </p>
      </div>

      {users.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <>
          {/* ── Desktop Table ── */}
          <div className="hidden md:block" style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Sessions</th>
                  <th style={styles.th}>Last Sign In</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isExpanded = expandedUsers.has(user.id);
                  const sessionCount = user.sessions?.length || 0;

                  return (
                    <React.Fragment key={user.id}>
                      {/* User row */}
                      <tr>
                        <td style={{ ...styles.td, ...styles.emailCell }}>
                          {user.email}
                        </td>
                        <td style={styles.td}>
                          <span style={getRoleBadgeStyle(user.role)}>
                            {user.role || "none"}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={
                              user.isBanned
                                ? styles.statusBanned
                                : styles.statusActive
                            }
                          >
                            {user.isBanned ? "Banned" : "Active"}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {sessionCount > 0 ? (
                            <button
                              style={styles.expandBtn}
                              className="hover:bg-muted transition-colors"
                              onClick={() => toggleExpand(user.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                              {sessionCount} active
                            </button>
                          ) : (
                            <span style={styles.sessionChipMeta}>
                              No sessions
                            </span>
                          )}
                        </td>
                        <td style={{ ...styles.td, ...styles.timeCell }}>
                          {formatDate(user.lastSignInAt)}
                        </td>
                        <td style={styles.td}>
                          <div style={styles.actionsCell}>
                            {sessionCount > 0 && (
                              <button
                                style={styles.revokeBtn}
                                className="hover:opacity-80 transition-opacity"
                                onClick={() => openAction(user, "revoke")}
                              >
                                <LogOut className="h-3.5 w-3.5" />
                                Revoke
                              </button>
                            )}
                            {user.isBanned ? (
                              <button
                                style={styles.unbanBtn}
                                className="hover:opacity-80 transition-opacity"
                                onClick={() => openAction(user, "unban")}
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Unban
                              </button>
                            ) : (
                              <button
                                style={styles.banBtn}
                                className="hover:opacity-80 transition-opacity"
                                onClick={() => openAction(user, "ban")}
                              >
                                <ShieldOff className="h-3.5 w-3.5" />
                                Ban
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded sessions row */}
                      {isExpanded && sessionCount > 0 && (
                        <tr style={styles.sessionRow}>
                          <td
                            colSpan={6}
                            style={styles.sessionCell}
                          >
                            <div style={styles.sessionGrid}>
                              {user.sessions.map((s) => (
                                <div key={s.id} style={styles.sessionChip}>
                                  <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "0.125rem",
                                    }}
                                  >
                                    <span style={styles.sessionChipLabel}>
                                      {s.device}
                                    </span>
                                    <span style={styles.sessionChipMeta}>
                                      IP: {s.ip} · Active:{" "}
                                      {formatDate(s.lastActiveAt)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="flex flex-col gap-3 md:hidden">
            {users.map((user) => {
              const sessionCount = user.sessions?.length || 0;
              const isExpanded = expandedUsers.has(user.id);

              return (
                <div key={user.id} style={styles.mobileCard}>
                  <div style={styles.mobileCardRow}>
                    <span style={{ ...styles.mobileValue, fontWeight: 600 }}>
                      {user.email}
                    </span>
                    <span
                      style={
                        user.isBanned
                          ? styles.statusBanned
                          : styles.statusActive
                      }
                    >
                      {user.isBanned ? "Banned" : "Active"}
                    </span>
                  </div>

                  <div style={styles.mobileCardRow}>
                    <span style={styles.mobileLabel}>Role</span>
                    <span style={getRoleBadgeStyle(user.role)}>
                      {user.role || "none"}
                    </span>
                  </div>

                  <div style={styles.mobileCardRow}>
                    <span style={styles.mobileLabel}>Sessions</span>
                    {sessionCount > 0 ? (
                      <button
                        style={styles.expandBtn}
                        className="hover:bg-muted transition-colors"
                        onClick={() => toggleExpand(user.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        {sessionCount} active
                      </button>
                    ) : (
                      <span style={styles.sessionChipMeta}>None</span>
                    )}
                  </div>

                  {/* Expanded sessions on mobile */}
                  {isExpanded && sessionCount > 0 && (
                    <div style={styles.sessionGrid}>
                      {user.sessions.map((s) => (
                        <div
                          key={s.id}
                          style={{ ...styles.sessionChip, width: "100%" }}
                        >
                          <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.125rem",
                            }}
                          >
                            <span style={styles.sessionChipLabel}>
                              {s.device}
                            </span>
                            <span style={styles.sessionChipMeta}>
                              IP: {s.ip} · Active: {formatDate(s.lastActiveAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={styles.mobileCardRow}>
                    <span style={styles.mobileLabel}>Last Sign In</span>
                    <span style={styles.mobileValue}>
                      {formatDate(user.lastSignInAt)}
                    </span>
                  </div>

                  {/* Mobile actions */}
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      marginTop: "0.25rem",
                    }}
                  >
                    {sessionCount > 0 && (
                      <button
                        style={{
                          ...styles.revokeBtn,
                          flex: 1,
                          justifyContent: "center",
                        }}
                        className="hover:opacity-80 transition-opacity"
                        onClick={() => openAction(user, "revoke")}
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Revoke
                      </button>
                    )}
                    {user.isBanned ? (
                      <button
                        style={{
                          ...styles.unbanBtn,
                          flex: 1,
                          justifyContent: "center",
                        }}
                        className="hover:opacity-80 transition-opacity"
                        onClick={() => openAction(user, "unban")}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Unban
                      </button>
                    ) : (
                      <button
                        style={{
                          ...styles.banBtn,
                          flex: 1,
                          justifyContent: "center",
                        }}
                        className="hover:opacity-80 transition-opacity"
                        onClick={() => openAction(user, "ban")}
                      >
                        <ShieldOff className="h-3.5 w-3.5" />
                        Ban
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Pagination ── */}
          {total > perPage && (
            <div style={styles.paginationContainer}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={styles.paginationButton}
                className="hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span style={styles.paginationInfo}>
                Page {page} of {Math.ceil(total / perPage)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / perPage)}
                style={styles.paginationButton}
                className="hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Confirm Modal ── */}
      {modalConfig && (
        <ConfirmModal
          isOpen={!!actionTarget}
          onClose={closeAction}
          onConfirm={handleConfirmAction}
          title={modalConfig.title}
          description={modalConfig.description}
          confirmText={modalConfig.confirmText}
          isLoading={actionLoading}
          error={actionError}
          icon={modalConfig.icon}
        />
      )}
    </div>
  );
}
