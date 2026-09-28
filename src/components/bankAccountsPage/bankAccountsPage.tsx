"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  SearchIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { canEdit as canEditRole, isAdmin as isAdminRole } from "@/lib/routePermissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/pageHeader";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import { DataTable } from "@/components/ui/dataTable/dataTable";
import type { ColumnDef, RowAction } from "@/components/ui/dataTable/dataTable.types";
import {
  formatBankAccountLabel,
  getAccountTypeLabel,
  type BankAccount,
} from "./bankAccountsPage.types";

const BankAccountModal = dynamic(
  () => import("@/components/bankAccountModal").then((m) => m.BankAccountModal),
  { ssr: false },
);
const ConfirmModal = dynamic(
  () => import("@/components/confirmModal/confirmModal"),
  { ssr: false },
);

export function BankAccountsPage() {
  const { userRole, loading: authLoading } = useAuth();
  const canEdit = canEditRole(userRole);
  const canManage = isAdminRole(userRole);

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<BankAccount | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchAccounts = useCallback(
    async (opts?: { overrideSearch?: string }) => {
      const search = opts?.overrideSearch ?? debouncedSearch;

      try {
        setFetching(true);
        setError(null);

        const params = new URLSearchParams({ with_counts: "true" });
        if (search) params.set("search", search);

        const res = await fetch(`/api/bank-accounts?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");

        const json = await res.json();
        setAccounts(json.data?.data ?? []);
        setDebouncedSearch(search);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      } finally {
        setFetching(false);
      }
    },
    [debouncedSearch],
  );

  useEffect(() => {
    if (searchQuery === debouncedSearch) return;

    debounceRef.current = setTimeout(() => {
      fetchAccounts({ overrideSearch: searchQuery });
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!authLoading && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const handleSuccess = () => fetchAccounts();

  const handleEdit = (account: BankAccount) => {
    setAccountToEdit(account);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setAccountToEdit(null);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/bank-accounts?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error || "Failed to delete");
      } else {
        setAccounts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    } catch {
      setDeleteError("Network error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ColumnDef<BankAccount>[] = [
    {
      key: "account",
      header: "Account",
      cell: (account) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">
            {formatBankAccountLabel(account)}
          </span>
          {(account.ifsc || account.branch) && (
            <span className="text-xs text-muted-foreground">
              {[account.ifsc, account.branch].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "holder",
      header: "Holder",
      mobile: "subtitle",
      cell: (account) => account.entities?.name ?? "—",
    },
    {
      key: "account_type",
      header: "Type",
      cell: (account) => <Badge variant="secondary">{getAccountTypeLabel(account.account_type)}</Badge>,
    },
    {
      key: "loan_count",
      header: "Loans",
      align: "right",
      cell: (account) =>
        account.loan_count ? (
          <span className="font-medium">{account.loan_count}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "is_active",
      header: "Status",
      mobile: "trailing",
      cell: (account) => (
        <Badge variant={account.is_active ? "secondary" : "outline"}>
          {account.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  const rowActions: RowAction<BankAccount>[] = [
    {
      key: "edit",
      label: "Edit",
      icon: <PencilIcon size={14} />,
      hidden: () => !canManage,
      onClick: handleEdit,
    },
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2Icon size={14} />,
      variant: "danger",
      hidden: () => !canManage,
      onClick: (account) => setDeleteTarget(account),
    },
  ];

  if (authLoading) return <PageLoadingSkeleton variant="admin" />;

  if (error && accounts.length === 0) {
    return <ErrorState title="Error" description={error} onRetry={() => fetchAccounts()} />;
  }

  const clearSearch = () => {
    setSearchQuery("");
    fetchAccounts({ overrideSearch: "" });
  };

  return (
    <div className="container mx-auto animate-in space-y-6 fade-in duration-200 md:space-y-8">
      <PageHeader
        title="Bank Accounts"
        description="Our own accounts, so a loan can record which one its EMI mandate debits from."
        primaryAction={
          canEdit
            ? { label: "Add Account", testId: "bank-accounts-add-btn", onClick: handleAddNew }
            : undefined
        }
      />

      <div className="ss-panel overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="space-y-4 border-b border-border p-4 sm:p-6">
          <div className="relative w-full max-w-sm">
            <SearchIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <Input
              data-testid="bank-accounts-search-input"
              placeholder="Search by bank, nickname or number..."
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
        </div>

        <div className="p-4 pb-2 sm:p-6 sm:pb-4">
          {error ? (
            <ErrorState
              title="Couldn't load"
              description={error}
              onRetry={() => fetchAccounts()}
            />
          ) : !fetching && accounts.length === 0 ? (
            <EmptyState
              title="No bank accounts yet"
              description={
                debouncedSearch
                  ? "Try adjusting your search query."
                  : "Add the accounts loans auto-debit from."
              }
              actionLabel={debouncedSearch ? "Clear Search" : "Add Account"}
              onAction={debouncedSearch ? clearSearch : handleAddNew}
              icon={SearchIcon}
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={accounts}
                rowKey={(a) => String(a.id)}
                loading={fetching}
                showActions={canManage}
                rowActions={rowActions}
              />
            

            </>
          )}
        </div>
      </div>

      <BankAccountModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
        accountToEdit={accountToEdit}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
        title="Delete Bank Account"
        description={`Are you sure you want to delete ${deleteTarget ? formatBankAccountLabel(deleteTarget) : ""}? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteLoading}
        error={deleteError}
      />
    </div>
  );
}
