"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  UndoIcon,
  ReceiptIcon,
  HandCoinsIcon,
  CheckCircleIcon,
  PhoneIcon,
  TruckIcon,
  FileTextIcon,
} from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { isAdmin as isAdminRole } from "@/lib/routePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/statCard";
import { PageHeader } from "@/components/ui/pageHeader";
import { Money } from "@/components/ui/money";
import { DataTable } from "@/components/ui/dataTable/dataTable";
import type { ColumnDef } from "@/components/ui/dataTable/dataTable.types";
import { Pagination } from "@/components/pagination";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { BusyOverlay } from "@/components/busyOverlay";
import { ErrorState } from "@/components/errorState";
import { EmptyState } from "@/components/emptyState";
import { Modal, ModalBody, ModalContent, ModalHeader, ModalTitle, ModalDescription } from "@/components/ui/modal";
import { AttachmentsPanel } from "@/components/attachmentsPanel";
import { LedgerEntryModal } from "./ledgerEntryModal";
import { ContactModal } from "./contactModal";
import { DeploymentModal } from "./deploymentModal";
import type {
  Client,
  ClientBalance,
  ClientContact,
  ClientDeployment,
  LedgerEntry,
} from "@/components/clientsPage/clientsPage.types";
import { describeDeployment, describeFleetMix } from "@/components/clientsPage/clientsPage.utils";
import { formatBankAccountLabel } from "@/components/bankAccountsPage/bankAccountsPage.types";
import { formatCurrency, formatDate, formatMonth } from "@/lib/format";

const ConfirmModal = dynamic(
  () => import("@/components/confirmModal/confirmModal"),
  { ssr: false },
);

const ALL_TABS = [
  { key: "statement", label: "Statement" },
  { key: "contacts", label: "Contacts" },
  { key: "vehicles", label: "Vehicles" },
];

type ClientProfile = Omit<Client, "balance" | "deployment_mix">;

export function ClientDetailPage({ clientId }: { clientId: number }) {
  const { userRole, loading: authLoading } = useAuth();
  const canManage = isAdminRole(userRole);

  const [client, setClient] = useState<ClientProfile | null>(null);
  const [balance, setBalance] = useState<ClientBalance | null>(null);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [deployments, setDeployments] = useState<ClientDeployment[]>([]);
  const [fleetMix, setFleetMix] = useState<Record<string, number>>({});

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [entriesPage, setEntriesPage] = useState(1);
  const [entriesPageSize, setEntriesPageSize] = useState(10);

  const [activeTab, setActiveTab] = useState("statement");
  const [fetching, setFetching] = useState(true);
  const [entriesFetching, setEntriesFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ledgerModal, setLedgerModal] = useState<"BILL" | "PAYMENT" | null>(null);
  const [contactModal, setContactModal] = useState<{ contact: ClientContact | null } | null>(
    null,
  );
  const [deploymentModal, setDeploymentModal] = useState<{
    deployment: ClientDeployment | null;
  } | null>(null);
  const [attachmentsEntry, setAttachmentsEntry] = useState<LedgerEntry | null>(null);

  const [confirm, setConfirm] = useState<
    | { kind: "reverse"; entry: LedgerEntry }
    | { kind: "contact"; contact: ClientContact }
    | { kind: "deployment"; deployment: ClientDeployment }
    | null
  >(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const fetchClient = useCallback(async () => {
    try {
      setFetching(true);
      setError(null);
      const res = await fetch(`/api/clients/${clientId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load client");

      setClient(json.data.client);
      setBalance(json.data.balance);
      setContacts(json.data.contacts ?? []);
      setDeployments(json.data.deployments ?? []);
      setFleetMix(json.data.fleet_mix ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setFetching(false);
    }
  }, [clientId]);

  const fetchEntries = useCallback(async () => {
    try {
      setEntriesFetching(true);
      const params = new URLSearchParams({
        page: String(entriesPage),
        page_size: String(entriesPageSize),
      });
      const res = await fetch(`/api/clients/${clientId}/entries?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load statement");

      setEntries(json.data.data ?? []);
      setEntriesTotal(json.data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setEntriesFetching(false);
    }
  }, [clientId, entriesPage, entriesPageSize]);

  useEffect(() => {
    if (!authLoading) void fetchClient();
  }, [authLoading, fetchClient]);

  useEffect(() => {
    if (!authLoading) void fetchEntries();
  }, [authLoading, fetchEntries]);

  /** Any money change alters the balance as well as the list it happened in. */
  const refreshAll = () => {
    void fetchClient();
    void fetchEntries();
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    setConfirmLoading(true);
    setConfirmError(null);

    try {
      let res: Response;
      if (confirm.kind === "reverse") {
        res = await fetch(
          `/api/clients/${clientId}/entries/${confirm.entry.id}/reverse`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        );
      } else if (confirm.kind === "contact") {
        res = await fetch(
          `/api/clients/${clientId}/contacts?contact_id=${confirm.contact.id}`,
          { method: "DELETE" },
        );
      } else {
        res = await fetch(
          `/api/clients/${clientId}/deployments?deployment_id=${confirm.deployment.id}`,
          { method: "DELETE" },
        );
      }

      if (!res.ok) {
        const json = await res.json();
        setConfirmError(json.error || "Failed");
        return;
      }

      setConfirm(null);
      refreshAll();
    } catch {
      setConfirmError("Network error");
    } finally {
      setConfirmLoading(false);
    }
  };

  if (authLoading || (fetching && !client)) {
    return <PageLoadingSkeleton variant="admin" />;
  }

  if (error && !client) {
    return (
      <ErrorState title="Couldn't load client" description={error} onRetry={fetchClient} />
    );
  }

  if (!client) return null;

  const outstanding = Number(balance?.outstanding ?? 0);
  const advance = Number(balance?.advance_amount ?? 0);
  const fleetSummary = describeFleetMix(fleetMix);
  // A refresh after a save keeps the page on screen, so the figures are dimmed
  // while they are known to be stale rather than silently standing still.
  const refreshing = fetching;

  const entryColumns: ColumnDef<LedgerEntry>[] = [
    { key: "date", header: "Date", cell: (entry) => formatDate(entry.entry_date) },
    {
      key: "type",
      header: "Type",
      mobile: "subtitle",
      cell: (entry) => (
        <Badge variant={entry.direction === "CREDIT" ? "secondary" : "outline"}>
          {entry.entry_type}
        </Badge>
      ),
    },
    {
      key: "description",
      header: "Description",
      cell: (entry) => (
        <div className="flex flex-col">
          <span>{entry.description ?? "—"}</span>
          <span className="text-xs text-muted-foreground">
            {[
              entry.invoice_no && `Inv ${entry.invoice_no}`,
              entry.period_month && formatMonth(entry.period_month),
              entry.reference,
              entry.payment_method,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      ),
    },
    {
      key: "debit",
      header: "Debit",
      mobile: "trailing",
      align: "right",
      cell: (entry) =>
        entry.direction === "DEBIT" ? (
          <Money value={entry.amount} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "credit",
      header: "Credit",
      mobile: "trailing",
      align: "right",
      cell: (entry) =>
        entry.direction === "CREDIT" ? (
          <Money value={entry.amount} tone="positive" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      cell: (entry) => (
        <span className="font-semibold">
          <Money value={entry.running_balance} />
        </span>
      ),
    },
    {
      key: "proof",
      header: "",
      align: "right",
      cell: (entry) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setAttachmentsEntry(entry)}
          aria-label="Payment proof"
        >
          <FileTextIcon size={14} style={{ marginRight: entry.attachment_count > 0 ? "0.375rem" : 0 }} />
          {entry.attachment_count > 0 && entry.attachment_count}
        </Button>
      ),
    },
    ...(canManage
      ? [
          {
            key: "action",
            header: "",
            align: "right" as const,
            // Reversals can't be reversed, nor can anything already undone.
            cell: (entry: LedgerEntry) =>
              !entry.is_reversed && !entry.is_reversal ? (
                <div className="flex justify-end opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirm({ kind: "reverse", entry })}
                    aria-label="Reverse entry"
                  >
                    <UndoIcon size={14} />
                  </Button>
                </div>
              ) : null,
          },
        ]
      : []),
  ];

  const confirmCopy = () => {
    if (!confirm) return { title: "", description: "" };
    if (confirm.kind === "reverse") {
      return {
        title: "Reverse Entry",
        description: `This cancels ${formatCurrency(confirm.entry.amount)} dated ${formatDate(confirm.entry.entry_date)}. Both the original and the correction stay on the statement, so it still reconciles.`,
      };
    }
    if (confirm.kind === "contact") {
      return {
        title: "Remove Contact",
        description: `Remove ${confirm.contact.name} from this client's contacts?`,
      };
    }
    return {
      title: "Remove Vehicle",
      description: "Remove this deployment from the client?",
    };
  };

  // An individual has no separate points of contact — they are their own
  // contact — so the Contacts tab only makes sense for a company.
  const isIndividual = client.party_kind === "INDIVIDUAL";
  const tabs = isIndividual ? ALL_TABS.filter((t) => t.key !== "contacts") : ALL_TABS;
  const effectiveTab = isIndividual && activeTab === "contacts" ? "statement" : activeTab;

  return (
    <div className="container mx-auto animate-in space-y-6 fade-in duration-200">
      <PageHeader
        backHref="/admin/clients"
        backLabel="Back to clients"
        title={client.name}
        badge={
          <>
            <Badge variant="outline">{client.client_type}</Badge>
            {!client.is_active && <Badge variant="secondary">Inactive</Badge>}
          </>
        }
        description={
          [
            client.location,
            client.gst_number && `GST ${client.gst_number}`,
            fleetSummary,
            client.bank_accounts
              ? `Pays into ${formatBankAccountLabel(client.bank_accounts, client.bank_accounts.entities?.name)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || "No details recorded yet."
        }
        actions={
          canManage ? (
            <>
              <Button onClick={() => setLedgerModal("BILL")}>
                <PlusIcon size={16} style={{ marginRight: "0.5rem" }} />
                Add Bill
              </Button>
              <Button variant="outline" onClick={() => setLedgerModal("PAYMENT")}>
                <ReceiptIcon size={16} style={{ marginRight: "0.5rem" }} />
                Record Payment
              </Button>
            </>
          ) : undefined
        }
      />

      <div
        className={
          refreshing
            ? "grid grid-cols-2 gap-3 opacity-60 transition-opacity duration-200 sm:grid-cols-3 sm:gap-4 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2"
            : "grid grid-cols-2 gap-3 transition-opacity duration-200 sm:grid-cols-3 sm:gap-4 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2"
        }
      >
        <StatCard
          title={advance > 0 ? "Advance Held" : "Outstanding"}
          value={<Money value={advance > 0 ? advance : outstanding} />}
          icon={advance > 0 ? <CheckCircleIcon size={18} /> : <HandCoinsIcon size={18} />}
          tone={advance > 0 ? "positive" : outstanding > 0 ? "critical" : "neutral"}
        />
        <StatCard
          title="Total Billed"
          value={<Money value={balance?.total_billed ?? 0} />}
          icon={<ReceiptIcon size={18} />}
        />
        <StatCard
          title="Total Received"
          value={<Money value={balance?.total_paid ?? 0} />}
          icon={<CheckCircleIcon size={18} />}
          tone="positive"
        />
      </div>

      <div className="ss-panel overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b border-border p-4 sm:p-6">
          <Tabs
            idPrefix="client-detail"
            items={tabs}
            value={effectiveTab}
            onValueChange={setActiveTab}
          />
        </div>

        <div
          className="p-4 sm:p-6"
          role="tabpanel"
          id={`client-detail-panel-${effectiveTab}`}
          aria-labelledby={`client-detail-tab-${effectiveTab}`}
        >
          {error && (
            <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {effectiveTab === "statement" ? (
            <BusyOverlay busy={entriesFetching}>
              {/* The empty state waits for the fetch to settle, so a freshly
                  added bill never flashes "nothing here yet" on its way in. */}
              {!entriesFetching && entries.length === 0 ? (
              <EmptyState
                title="Nothing on the statement yet"
                description="Add a bill or record a payment to start this client's account."
                actionLabel={canManage ? "Add Bill" : undefined}
                onAction={canManage ? () => setLedgerModal("BILL") : undefined}
                icon={ReceiptIcon}
              />
            ) : (
              <>
                <DataTable
                  columns={entryColumns}
                  data={entries}
                  rowKey={(entry) => entry.id}
                  showActions={false}
                  rowClassName={(entry) => (entry.is_reversed ? "opacity-50 line-through" : "")}
                  mobileLayout="timeline"
                />

                <Pagination
                  page={entriesPage}
                  totalCount={entriesTotal}
                  pageSize={entriesPageSize}
                  loading={entriesFetching}
                  onPageChange={setEntriesPage}
                  onPageSizeChange={(size) => {
                    setEntriesPageSize(size);
                    setEntriesPage(1);
                  }}
                />
              </>
              )}
            </BusyOverlay>
          ) : effectiveTab === "contacts" ? (
            <div className="space-y-4">
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setContactModal({ contact: null })}
                >
                  <PlusIcon size={16} style={{ marginRight: "0.5rem" }} />
                  Add Contact
                </Button>
              )}

              <BusyOverlay busy={refreshing}>
                {!refreshing && contacts.length === 0 ? (
                <EmptyState
                  title="No contacts yet"
                  description="Add the people at this company worth having a number for."
                  icon={PhoneIcon}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="rounded-xl border bg-card p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {contact.name}
                            </span>
                            {contact.is_primary && (
                              <Badge variant="secondary">Primary</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {[contact.role, contact.designation]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </div>
                        {canManage && (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setContactModal({ contact })}
                              aria-label={`Edit ${contact.name}`}
                            >
                              <PencilIcon size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setConfirm({ kind: "contact", contact })}
                              aria-label={`Remove ${contact.name}`}
                            >
                              <Trash2Icon size={14} />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {contact.phone && (
                          <a
                            href={`tel:${contact.phone}`}
                            className="hover:text-foreground"
                          >
                            {contact.phone}
                          </a>
                        )}
                        {contact.alt_phone && <span>{contact.alt_phone}</span>}
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="truncate hover:text-foreground"
                          >
                            {contact.email}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </BusyOverlay>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {fleetSummary ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Running here: </span>
                    <span className="font-medium text-foreground">{fleetSummary}</span>
                  </p>
                ) : (
                  <span />
                )}
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeploymentModal({ deployment: null })}
                  >
                    <PlusIcon size={16} style={{ marginRight: "0.5rem" }} />
                    Add Vehicle
                  </Button>
                )}
              </div>

              <BusyOverlay busy={refreshing}>
                {!refreshing && deployments.length === 0 ? (
                <EmptyState
                  title="No vehicles recorded"
                  description="Add the vehicles running for this client — either from your fleet or described by type."
                  icon={TruckIcon}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {deployments.map((deployment) => (
                    <div
                      key={deployment.id}
                      className={
                        deployment.is_active
                          ? "rounded-xl border bg-card p-4"
                          : "rounded-xl border bg-muted/30 p-4 opacity-70"
                      }
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">
                              {deployment.vehicles?.vehicle_number ??
                                `${deployment.quantity} × ${describeDeployment(deployment).split(" · ")[0]}`}
                            </span>
                            {!deployment.vehicle_id && (
                              <Badge variant="outline">Not in fleet</Badge>
                            )}
                            {!deployment.is_active && (
                              <Badge variant="secondary">Ended</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {describeDeployment(deployment)}
                          </div>
                        </div>
                        {canManage && (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeploymentModal({ deployment })}
                              aria-label="Edit deployment"
                            >
                              <PencilIcon size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setConfirm({ kind: "deployment", deployment })}
                              aria-label="Remove deployment"
                            >
                              <Trash2Icon size={14} />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {deployment.monthly_rate != null && (
                          <span>{formatCurrency(deployment.monthly_rate)}/month</span>
                        )}
                        {deployment.start_date && (
                          <span>from {formatDate(deployment.start_date)}</span>
                        )}
                        {deployment.end_date && (
                          <span>to {formatDate(deployment.end_date)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </BusyOverlay>
            </div>
          )}
        </div>
      </div>

      {ledgerModal && (
        <LedgerEntryModal
          isOpen
          clientId={clientId}
          kind={ledgerModal}
          outstanding={outstanding}
          onClose={() => setLedgerModal(null)}
          onSuccess={refreshAll}
        />
      )}

      {contactModal && (
        <ContactModal
          isOpen
          clientId={clientId}
          contactToEdit={contactModal.contact}
          onClose={() => setContactModal(null)}
          onSuccess={() => void fetchClient()}
        />
      )}

      {deploymentModal && (
        <DeploymentModal
          isOpen
          clientId={clientId}
          deploymentToEdit={deploymentModal.deployment}
          onClose={() => setDeploymentModal(null)}
          onSuccess={() => void fetchClient()}
        />
      )}

      {attachmentsEntry && (
        <Modal
          open
          onOpenChange={(open) => {
            if (open) return;
            setAttachmentsEntry(null);
            // The row's attachment_count badge only refreshes with the list.
            void fetchEntries();
          }}
        >

          <ModalContent style={{ maxWidth: "32rem" }}>
            <ModalHeader className="border-b border-border !px-5 !py-4 sm:!px-6">
              <ModalTitle>Payment Proof</ModalTitle>
              <ModalDescription>
                {attachmentsEntry.entry_type} · {formatDate(attachmentsEntry.entry_date)}
              </ModalDescription>
            </ModalHeader>
            <ModalBody className="!p-4 sm:!p-6">
              <AttachmentsPanel
                ownerType="client_entry"
                ownerId={attachmentsEntry.id}
                canManage={canManage}
                accept="image/*,application/pdf,text/plain"
                layout="list"
              />
            </ModalBody>
          </ModalContent>
        </Modal>
      )}

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => {
          setConfirm(null);
          setConfirmError(null);
        }}
        onConfirm={handleConfirm}
        title={confirmCopy().title}
        description={confirmCopy().description}
        confirmText={confirm?.kind === "reverse" ? "Reverse" : "Remove"}
        isLoading={confirmLoading}
        error={confirmError}
      />
    </div>
  );
}
