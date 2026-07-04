import { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { EyeIcon, Trash2Icon, UploadCloudIcon } from "@/components/ui/icon";
import { DocumentModalProps } from "./documentModal.types";
import { Vehicle } from "@/app/admin/vehicles/vehicles.types";
import { Skeleton } from "@/components/skeletonLoader";
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

  const docTypes = [
    { key: "rc_url", label: "Registration (RC)" },
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
    { key: "permit_url", label: "Permit" },
    { key: "pollution_url", label: "Pollution (PUC)" },
    { key: "tax_url", label: "Road Tax" },
  ];

  const [dateSaving, setDateSaving] = useState<string | null>(null);

  const handleDateChange = async (field: string, value: string) => {
    if (!localVehicle) return;

    setLocalVehicle((prev) =>
      prev ? ({ ...prev, [field]: value || null } as Vehicle) : null,
    );
    setDateSaving(field);
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
    } catch (error: unknown) {
      setErrorMsg(
        `Failed to save date: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setDateSaving(null);
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
                        <input
                          type="date"
                          className={DM_DATE_INPUT}
                          value={
                            (localVehicle[
                              doc.dateFields.start as keyof Vehicle
                            ] as string | undefined) ?? ""
                          }
                          disabled={!filePath || dateSaving === doc.dateFields.start}
                          onChange={(e) =>
                            handleDateChange(doc.dateFields!.start, e.target.value)
                          }
                        />
                      </div>
                      <div className={DM_DATE_ROW}>
                        <label className={DM_DATE_LABEL}>End</label>
                        <input
                          type="date"
                          className={DM_DATE_INPUT}
                          value={
                            (localVehicle[
                              doc.dateFields.end as keyof Vehicle
                            ] as string | undefined) ?? ""
                          }
                          disabled={!filePath || dateSaving === doc.dateFields.end}
                          onChange={(e) =>
                            handleDateChange(doc.dateFields!.end, e.target.value)
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
