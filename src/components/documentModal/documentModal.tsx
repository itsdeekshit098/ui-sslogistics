import { useState, useEffect, useRef } from "react";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { EyeIcon, Trash2Icon, UploadCloudIcon, XIcon } from "@/components/ui/icon";
import { DocumentModalProps } from "./documentModal.types";
import { Vehicle } from "@/app/admin/vehicles/vehicles.types";
import { Skeleton } from "@/components/ui/skeletonLoader";
import { ConfirmModal } from "@/components/confirmModal";
import { DocumentPreviewModal } from "@/components/documentPreviewModal";
import {
  DM_DIALOG_CONTENT,
  DM_GRID_CONTAINER,
  DM_CARD_CONTAINER,
  DM_CARD_HEADER,
  DM_ACTIVE_DOC_WRAPPER,
  DM_BUTTON_VIEW,
  DM_BUTTON_DELETE,
  DM_UPLOAD_WRAPPER,
  DM_UPLOAD_DROPZONE,
  DM_UPLOAD_INPUT_FIELD,
  DM_UPLOAD_ICON_CONTAINER,
  DM_UPLOAD_SUBTITLE,
  DM_ERROR_WRAPPER,
  DM_ERROR_CLOSE,
  DM_DATE_ROW,
  DM_DATE_LABEL,
  DM_DATE_INPUT,
} from "./documentModal.style";

interface DocumentApiResponse {
  error?: string;
  filePath?: string;
}

/** Years a validity date can plausibly have; anything else is a half-typed year. */
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const DATE_SAVE_DELAY_MS = 700;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Date input that keeps what the user types in a draft and saves once the
 * value is a whole, plausible date (or cleared). Typing "2025" passes through
 * 0002, 0020, 0202 on the way, and each of those is a valid date to the browser,
 * so saving on every change stored junk and — by disabling the field mid-save —
 * dropped focus after the first digit.
 */
function DateField({
  value,
  disabled,
  onCommit,
}: {
  value: string;
  disabled: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A change waiting out the delay; flushed on blur and on unmount so closing
  // the dialog right after typing (Escape never blurs) doesn't lose it.
  const pending = useRef<string | null>(null);
  const latest = useRef({ value, onCommit });
  useEffect(() => {
    latest.current = { value, onCommit };
  });

  // Follow the saved value when it changes from outside (delete, reopen).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (next !== null && next !== latest.current.value) latest.current.onCommit(next);
  };

  useEffect(() => flush, []);

  const isWholeDate = (v: string) => {
    const year = Number(v.slice(0, 4));
    return /^\d{4}-\d{2}-\d{2}$/.test(v) && year >= MIN_YEAR && year <= MAX_YEAR;
  };

  const schedule = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    // An empty value is what the browser reports while a segment is being
    // retyped, so only a whole date is ever saved from typing.
    if (next === value || !isWholeDate(next)) return;
    pending.current = next;
    timer.current = setTimeout(flush, DATE_SAVE_DELAY_MS);
  };

  const cancelPending = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  };

  return (
    <div className="flex flex-1 items-center gap-1">
      <input
        type="date"
        className={DM_DATE_INPUT}
        value={draft}
        min={`${MIN_YEAR}-01-01`}
        max={`${MAX_YEAR}-12-31`}
        disabled={disabled}
        onChange={(e) => {
          setDraft(e.target.value);
          schedule(e.target.value);
        }}
        onBlur={() => {
          if (isWholeDate(draft)) {
            pending.current = draft;
            flush();
          } else {
            // Empty or half-typed: never saved, so show what is. Clearing a
            // date is the button's job — a blur can't tell "retyping a
            // segment" from "meant to clear".
            cancelPending();
            setDraft(value);
          }
        }}
      />
      {value && !disabled && (
        <button
          type="button"
          aria-label="Clear date"
          title="Clear date"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          onClick={() => {
            cancelPending();
            setDraft("");
            onCommit("");
          }}
        >
          <XIcon size={14} />
        </button>
      )}
    </div>
  );
}

export function DocumentModal({
  isOpen,
  onClose,
  vehicle,
  onUpdate,
}: DocumentModalProps) {
  const [loadingFields, setLoadingFields] = useState<string[]>([]);
  const [localVehicle, setLocalVehicle] = useState<Vehicle | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<{
    key: string;
    filePath: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** State for the in-app document preview modal. */
  const [previewFile, setPreviewFile] = useState<{
    path: string;
    label: string;
  } | null>(null);

  // Sync prop to local state so we can mutate cleanly without parent waterfall
  useEffect(() => {
    setLocalVehicle(vehicle);
  }, [vehicle]);

  // FC and Insurance are the two document types with validity dates, which
  // makes their cards taller (two date inputs, plus a helper line when
  // empty) than the plain upload/view cards below. Ordered so those two
  // share the first grid row instead of each being paired with a shorter
  // card and leaving a gap underneath it.
  const docTypes = [
    {
      key: "fc_url",
      label: "Fitness Certificate (FC)",
      dateFields: { start: "fc_start_date", end: "fc_end_date" } as const,
    },
    {
      key: "insurance_url",
      label: "Insurance",
      dateFields: {
        start: "insurance_start_date",
        end: "insurance_end_date",
      } as const,
    },
    { key: "rc_url", label: "Registration (RC)" },
    { key: "permit_url", label: "Permit" },
    { key: "pollution_url", label: "Pollution (PUC)" },
    { key: "tax_url", label: "Road Tax" },
  ];

  const handleDateChange = async (field: string, value: string) => {
    if (!localVehicle) return;

    const previous = (localVehicle as unknown as Record<string, unknown>)[field];
    setLocalVehicle((prev) =>
      prev ? ({ ...prev, [field]: value || null } as Vehicle) : null,
    );
    setErrorMsg(null);

    try {
      const res = await fetch("/api/vehicles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: localVehicle.id, [field]: value || null }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save date");
      }

      // fc_status/insurance_status are computed server-side from these
      // dates, so a plain local patch of the raw date can't refresh them —
      // tell the parent to refetch.
      onUpdate(field, value || null);
    } catch (error: unknown) {
      // Put back what the server still has so the field doesn't show a date
      // that was refused.
      // Only if the field still holds the value that failed: a later edit may
      // have already replaced it, and must not be undone by this older failure.
      setLocalVehicle((prev) =>
        prev && ((prev as unknown as Record<string, unknown>)[field] ?? "") === value
          ? ({ ...prev, [field]: previous ?? null } as Vehicle)
          : prev,
      );
      setErrorMsg(
        `Failed to save date: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  /**
   * View a document in an in-app preview modal.
   * The preview modal uses a server-side proxy — Supabase URLs are never exposed.
   */
  const handleView = (filePath: string, label: string) => {
    setPreviewFile({ path: filePath, label });
  };

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    documentType: string,
  ) => {
    if (!e.target.files || e.target.files.length === 0 || !vehicle) return;
    const file = e.target.files[0];

    setErrorMsg(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setErrorMsg(`Upload failed: "${file.name}" exceeds the 10 MB limit`);
      e.target.value = "";
      return;
    }
    setLoadingFields((prev) =>
      prev.includes(documentType) ? prev : [...prev, documentType],
    );

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("vehicleId", vehicle.id.toString());
      // Package the human-readable number securely, formatting spaces out for URLs
      formData.append(
        "vehicleNumber",
        vehicle.vehicle_number.replace(/\s+/g, "-").toUpperCase(),
      );
      formData.append("documentType", documentType);

      const res = await fetch("/api/vehicles/documents", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || json.data?.error || "Upload failed");
      }
      const resData: DocumentApiResponse = json.data ?? {};

      // Immediately update the local state with the file path
      if (resData.filePath) {
        setLocalVehicle((prev) =>
          prev
            ? ({ ...prev, [documentType]: resData.filePath } as Vehicle)
            : null,
        );
      }

      onUpdate(documentType, resData.filePath); // Pass updated file path to parent
    } catch (error: unknown) {
      setErrorMsg(
        `Upload failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoadingFields((prev) => prev.filter((key) => key !== documentType));
      e.target.value = ""; // Reset input
    }
  };

  const executeDelete = async () => {
    if (!vehicle || !deleteDocTarget) return;

    setErrorMsg(null);
    const { key: documentType, filePath } = deleteDocTarget;
    setDeleteDocTarget(null);
    setLoadingFields((prev) =>
      prev.includes(documentType) ? prev : [...prev, documentType],
    );
    try {
      const res = await fetch("/api/vehicles/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: vehicle.id,
          documentType,
          filePath,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || json.data?.error || "Delete failed");
      }

      // The API also clears the paired start/end validity dates for
      // fc_url/insurance_url (a deleted document shouldn't leave a stale
      // expiry date behind) — mirror that locally and tell the parent.
      const dateFields = docTypes.find((d) => d.key === documentType)
        ?.dateFields;

      setLocalVehicle((prev) => {
        if (!prev) return null;
        const next = { ...prev, [documentType]: null } as Vehicle;
        if (dateFields) {
          (next as unknown as Record<string, unknown>)[dateFields.start] =
            null;
          (next as unknown as Record<string, unknown>)[dateFields.end] = null;
        }
        return next;
      });

      onUpdate(documentType, null);
      if (dateFields) {
        onUpdate(dateFields.start, null);
        onUpdate(dateFields.end, null);
      }
    } catch (error: unknown) {
      setErrorMsg(
        `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoadingFields((prev) => prev.filter((key) => key !== documentType));
    }
  };

  if (!localVehicle) return null;

  return (
    <Modal open={isOpen} onOpenChange={onClose}>
      <ModalContent className={DM_DIALOG_CONTENT}>
        <div className="max-h-[85vh] overflow-y-auto p-4 md:p-6 scrollbar-custom">
          <ModalHeader>
            <ModalTitle>Document Management</ModalTitle>
            <ModalDescription>
              Documents for {localVehicle.vehicle_number} |{" "}
              {localVehicle.company} {localVehicle.model}
            </ModalDescription>
          </ModalHeader>

          {errorMsg && (
            <div className={DM_ERROR_WRAPPER}>
              <span>{errorMsg}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setErrorMsg(null)}
                className={DM_ERROR_CLOSE}
              >
                &times;
              </Button>
            </div>
          )}

          <div className={DM_GRID_CONTAINER}>
            {docTypes.map((doc) => {
              const filePath = localVehicle[doc.key as keyof Vehicle] as
                | string
                | undefined;
              const isLoading = loadingFields.includes(doc.key);

              return (
                <div key={doc.key} className={DM_CARD_CONTAINER}>
                  <div>
                    <h4 className={DM_CARD_HEADER}>{doc.label}</h4>
                  </div>

                  {isLoading ? (
                    <div className="mt-auto w-full h-[88px]">
                      <Skeleton width="100%" height="100%" borderRadius="8px" />
                    </div>
                  ) : filePath ? (
                    <div className={DM_ACTIVE_DOC_WRAPPER}>
                      <Button
                        data-testid="components-documentModal-documentModal-button-1"
                        variant="outline"
                        size="sm"
                        className={DM_BUTTON_VIEW}
                        onClick={() => handleView(filePath, doc.label)}
                      >
                        <EyeIcon size={16} style={{ marginRight: "0.5rem" }} />
                        View
                      </Button>
                      <Button
                        data-testid="components-documentModal-documentModal-button-2"
                        variant="outline"
                        size="icon"
                        className={DM_BUTTON_DELETE}
                        onClick={() =>
                          setDeleteDocTarget({ key: doc.key, filePath })
                        }
                        disabled={isLoading}
                      >
                        <Trash2Icon size={16} />
                      </Button>
                    </div>
                  ) : (
                    <div className={DM_UPLOAD_WRAPPER}>
                      <div className={DM_UPLOAD_DROPZONE}>
                        <input
                          type="file"
                          className={DM_UPLOAD_INPUT_FIELD}
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => handleUpload(e, doc.key)}
                          disabled={isLoading}
                        />
                        <UploadCloudIcon size={20} className={DM_UPLOAD_ICON_CONTAINER} />
                        <span className={DM_UPLOAD_SUBTITLE}>
                          Upload Document
                        </span>
                      </div>
                    </div>
                  )}

                  {doc.dateFields && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <div className={DM_DATE_ROW}>
                        <label className={DM_DATE_LABEL}>Start</label>
                        <DateField
                          value={
                            (localVehicle[
                              doc.dateFields.start as keyof Vehicle
                            ] as string | undefined) ?? ""
                          }
                          disabled={!filePath}
                          onCommit={(v) =>
                            handleDateChange(doc.dateFields!.start, v)
                          }
                        />
                      </div>
                      <div className={DM_DATE_ROW}>
                        <label className={DM_DATE_LABEL}>End</label>
                        <DateField
                          value={
                            (localVehicle[
                              doc.dateFields.end as keyof Vehicle
                            ] as string | undefined) ?? ""
                          }
                          disabled={!filePath}
                          onCommit={(v) =>
                            handleDateChange(doc.dateFields!.end, v)
                          }
                        />
                      </div>
                      {!filePath && (
                        <p className="text-xs text-muted-foreground">
                          Upload the document to set validity dates.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ModalContent>

      <ConfirmModal
        isOpen={!!deleteDocTarget}
        onClose={() =>
          (!deleteDocTarget || !loadingFields.includes(deleteDocTarget.key)) &&
          setDeleteDocTarget(null)
        }
        onConfirm={executeDelete}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Delete"
        isLoading={
          !!deleteDocTarget && loadingFields.includes(deleteDocTarget.key)
        }
      />

      {/* In-app document preview — renders via server-side proxy, never exposes Supabase URLs */}
      {previewFile && (
        <DocumentPreviewModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          filePath={previewFile.path}
          label={previewFile.label}
        />
      )}
    </Modal>
  );
}
