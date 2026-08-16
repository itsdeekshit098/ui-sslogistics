"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  SearchIcon,
  XIcon,
  PencilIcon,
  Trash2Icon,
  Building2Icon,
  UserIcon,
  AlertTriangleIcon,
  HandCoinsIcon,
  CheckCircleIcon,
} from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { isAdmin as isAdminRole } from "@/lib/routePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/statCard";
import { PageHeader } from "@/components/ui/pageHeader";
import { Money } from "@/components/ui/money";
import { Pagination } from "@/components/pagination";
import { SegmentedControl } from "@/components/ui/segmentedControl";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import { DataTable } from "@/components/ui/dataTable/dataTable";
import type { ColumnDef, RowAction } from "@/components/ui/dataTable/dataTable.types";
import { formatDate } from "@/lib/format";
import type { Client, ClientSummary } from "./clientsPage.types";
import { getVehicleTypeLabel } from "./clientsPage.utils";

const ClientModal = dynamic(
  () => import("@/components/clientModal").then((m) => m.ClientModal),
  { ssr: false },
);
const ConfirmModal = dynamic(
  () => import("@/components/confirmModal/confirmModal"),
  { ssr: false },
);

export function ClientsPage() {
  const router = useRouter();
  const { userRole, loading: authLoading } = useAuth();
  const canManage = isAdminRole(userRole);

  const [clients, setClients] = useState<Client[]>([]);
  const [summary, setSummary] = useState<ClientSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [hasDues, setHasDues] = useState(false);
  const [partyKind, setPartyKind] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchClients = useCallback(
    async (opts?: { overrideSearch?: string }) => {
      const search = opts?.overrideSearch ?? debouncedSearch;
      try {
        setFetching(true);
        setError(null);

        const params = new URLSearchParams({
          page: String(page),
          page_size: String(pageSize),
          include_summary: "true",
        });
        if (search) params.set("search", search);
        if (hasDues) params.set("has_dues", "true");
        if (partyKind) params.set("party_kind", partyKind);

        const res = await fetch(`/api/clients?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load clients");

        setClients(json.data.data ?? []);
        setTotal(json.data.total ?? 0);
        if (json.data.summary) setSummary(json.data.summary);
        setDebouncedSearch(search);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      } finally {
        setFetching(false);
      }
    },
    [page, pageSize, hasDues, partyKind, debouncedSearch],
  );

  // Debounce search
  useEffect(() => {
    if (searchQuery === debouncedSearch) return;

    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchClients({ overrideSearch: searchQuery });
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  useEffect(() => {
    if (!authLoading) void fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, page, pageSize, hasDues, partyKind]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/clients?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        setDeleteError(json.error || "Failed to delete");
        return;
      }
      setDeleteTarget(null);
      void fetchClients();
    } catch {
      setDeleteError("Network error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setPage(1);
    fetchClients({ overrideSearch: "" });
  };

  const columns: ColumnDef<Client>[] = [
    {
      key: "name",
      header: "Client",
      cell: (client) => (
        <div className="flex items-center gap-2">
          {client.party_kind === "INDIVIDUAL" ? (
            <UserIcon size={14} className="shrink-0 text-muted-foreground" />
          ) : (
            <Building2Icon size={14} className="shrink-0 text-muted-foreground" />
          )}
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{client.name}</span>
            {client.location && (
              <span className="text-xs text-muted-foreground">{client.location}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "client_type",
      header: "Type",
      cell: (client) => <Badge variant="outline">{client.client_type}</Badge>,
    },
    {
      key: "vehicles",
      header: "Vehicles",
      cell: (client) => {
        const entries = Object.entries(client.deployment_mix).filter(
          ([, count]) => count > 0,
        );
        if (entries.length === 0) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {entries
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <Badge key={type} variant="secondary">
                  {count} × {getVehicleTypeLabel(type)}
                </Badge>
              ))}
          </div>
        );
      },
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      cell: (client) => {
        const { outstanding, advance_amount: advance } = client.balance;
        // An overpayment reads as money held on account, never as a minus sign.
        if (advance > 0) {
          return (
            <span className="font-medium">
              <Money value={advance} tone="positive" /> advance
            </span>
          );
        }
        if (outstanding > 0) {
          return (
            <span className="font-medium">
              <Money value={outstanding} tone="negative" />
            </span>
          );
        }
        return <span className="text-muted-foreground">Settled</span>;
      },
    },
    {
      key: "last_payment",
      header: "Last Payment",
      cell: (client) =>
        client.balance.last_payment_date ? (
          formatDate(client.balance.last_payment_date)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const rowActions: RowAction<Client>[] = [
    {
      key: "edit",
      label: "Edit",
      icon: <PencilIcon size={14} />,
      hidden: () => !canManage,
      onClick: (client) => {
        setClientToEdit(client);
        setShowModal(true);
      },
    },
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2Icon size={14} />,
      variant: "danger",
      hidden: () => !canManage,
      onClick: (client) => setDeleteTarget(client),
    },
  ];

  if (authLoading) return <PageLoadingSkeleton variant="admin" />;

  if (error && clients.length === 0) {
    return (
      <ErrorState title="Couldn't load clients" description={error} onRetry={() => fetchClients()} />
    );
  }

  return (
    <div className="container mx-auto animate-in space-y-6 fade-in duration-200 md:space-y-8">
      <PageHeader
        title="Clients"
        description="Companies our vehicles run for, and what they owe us."
        actions={
          canManage ? (
            <Button
              data-testid="clients-add-btn"
              className="w-full sm:w-auto"
              onClick={() => {
                setClientToEdit(null);
                setShowModal(true);
              }}
            >
              <PlusIcon size={16} style={{ marginRight: "0.5rem" }} /> Add Client
            </Button>
          ) : undefined
        }
      />

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Clients"
            value={summary.totalClients}
            icon={<Building2Icon size={18} />}
          />
          <StatCard
            title="Total Outstanding"
            value={<Money value={summary.totalOutstanding} />}
            icon={<HandCoinsIcon size={18} />}
            tone={summary.totalOutstanding > 0 ? "critical" : "neutral"}
            onClick={
              summary.totalOutstanding > 0
                ? () => {
                    setHasDues(true);
                    setPage(1);
                  }
                : undefined
            }
          />
          <StatCard
            title="Clients with Dues"
            value={summary.clientsWithDues}
            icon={<AlertTriangleIcon size={18} />}
          />
          <StatCard
            title="Advance Held"
            value={<Money value={summary.totalAdvance} />}
            icon={<CheckCircleIcon size={18} />}
            tone="positive"
          />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 sm:p-6">
          <div className="relative w-full max-w-sm">
            <SearchIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <Input
              data-testid="clients-search-input"
              placeholder="Search by name, location or GST..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 h-auto -translate-y-1/2 p-0 text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"
                aria-label="Clear search"
              >
                <XIcon size={16} />
              </Button>
            )}
          </div>

          <SegmentedControl
            idPrefix="client-party-kind"
            items={[
              { key: "", label: "All" },
              { key: "COMPANY", label: "Companies" },
              { key: "INDIVIDUAL", label: "Individuals" },
            ]}
            value={partyKind}
            onValueChange={(key) => {
              setPartyKind(key);
              setPage(1);
            }}
          />

          <Button
            variant="outline"
            size="sm"
            className={
              hasDues
                ? "border-destructive/40 bg-destructive-subtle text-destructive hover:bg-destructive-subtle"
                : "text-destructive"
            }
            onClick={() => {
              setHasDues((prev) => !prev);
              setPage(1);
            }}
          >
            Owes money
          </Button>
        </div>

        <div className="p-4 sm:p-6">
          {!fetching && clients.length === 0 ? (
            <EmptyState
              title="No clients found"
              description={
                debouncedSearch || hasDues
                  ? "Try adjusting your search or filter."
                  : "Add the companies your vehicles run for to start tracking what they owe."
              }
              actionLabel={
                debouncedSearch || hasDues
                  ? "Clear filters"
                  : canManage
                    ? "Add Client"
                    : undefined
              }
              onAction={
                debouncedSearch || hasDues
                  ? () => {
                      setHasDues(false);
                      clearSearch();
                    }
                  : canManage
                    ? () => {
                        setClientToEdit(null);
                        setShowModal(true);
                      }
                    : undefined
              }
              icon={Building2Icon}
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={clients}
                rowKey={(client) => String(client.id)}
                loading={fetching}
                rowClickable
                onRowClick={(client) => router.push(`/admin/clients/${client.id}`)}
                showActions={canManage}
                rowActions={rowActions}
              />
              <Pagination
                page={page}
                totalCount={total}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </>
          )}
        </div>
      </div>

      <ClientModal
        isOpen={showModal}
        clientToEdit={clientToEdit}
        onClose={() => setShowModal(false)}
        onSuccess={() => void fetchClients()}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
        title="Delete Client"
        description={`Delete ${deleteTarget?.name}? Only possible while their account is settled and their statement is empty — otherwise mark them inactive instead.`}
        confirmText="Delete"
        isLoading={deleteLoading}
        error={deleteError}
      />
    </div>
  );
}
