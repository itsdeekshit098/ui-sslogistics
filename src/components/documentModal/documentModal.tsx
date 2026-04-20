import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Trash2, UploadCloud, Loader2 } from "lucide-react";
import { DocumentModalProps } from "./documentModal.types";
import { Vehicle } from "@/app/admin/vehicles/vehicles.types";
import { Skeleton } from "@/components/skeletonLoader";
import { ConfirmModal } from "@/components/confirmModal";
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
} from "./documentModal.style";

interface DocumentApiResponse {
  error?: string;
  filePath?: string;
}

interface SignedUrlResponse {
  signedUrl?: string;
  error?: string;
}

/**
 * Fetches a time-limited signed URL from the backend for a private storage file path.
 */
async function fetchSignedUrl(filePath: string): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/vehicles/documents?filePath=${encodeURIComponent(filePath)}`,
    );
    if (!res.ok) return null;
    const data: SignedUrlResponse = await res.json();
    return data.signedUrl || null;
  } catch {
    return null;
  }
}

export function DocumentModal({
  isOpen,
  onClose,
  vehicle,
  onUpdate,
}: DocumentModalProps) {
  const [loadingFields, setLoadingFields] = useState<string[]>([]);
  const [viewingFields, setViewingFields] = useState<string[]>([]);
  const [localVehicle, setLocalVehicle] = useState<Vehicle | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<{
    key: string;
    filePath: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync prop to local state so we can mutate cleanly without parent waterfall
  useEffect(() => {
    setLocalVehicle(vehicle);
  }, [vehicle]);

  const docTypes = [
    { key: "rc_url", label: "Registration (RC)" },
    { key: "fc_url", label: "Fitness Certificate (FC)" },
    { key: "insurance_url", label: "Insurance" },
    { key: "permit_url", label: "Permit" },
    { key: "pollution_url", label: "Pollution (PUC)" },
    { key: "tax_url", label: "Road Tax" },
  ];

  /**
   * View a document by fetching a signed URL from the backend,
   * then opening it in a new tab.
   */
  const handleView = async (filePath: string, docKey: string) => {
    setViewingFields((prev) =>
      prev.includes(docKey) ? prev : [...prev, docKey],
    );
    try {
      const signedUrl = await fetchSignedUrl(filePath);
      if (signedUrl) {
        window.open(signedUrl, "_blank", "noreferrer");
      } else {
        setErrorMsg("Failed to generate secure document link. Please retry.");
      }
    } catch {
      setErrorMsg("Failed to open document.");
    } finally {
      setViewingFields((prev) => prev.filter((key) => key !== docKey));
    }
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

      let resData: DocumentApiResponse = {};
      try {
        resData = await res.json();
      } catch {}

      if (!res.ok) {
        throw new Error(resData.error || "Upload failed");
      }

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
      console.error("Upload error:", error);
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

      let errData: DocumentApiResponse = {};
      try {
        errData = await res.json();
      } catch {}

      if (!res.ok) {
        throw new Error(errData.error || "Delete failed");
      }

      // Clean the UI up instantly so the 'Upload' button returns immediately
      setLocalVehicle((prev) =>
        prev ? ({ ...prev, [documentType]: null } as Vehicle) : null,
      );

      onUpdate(documentType, null);
    } catch (error: unknown) {
      console.error("Delete error:", error);
      setErrorMsg(
        `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoadingFields((prev) => prev.filter((key) => key !== documentType));
    }
  };

  if (!localVehicle) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={DM_DIALOG_CONTENT}>
        <DialogHeader>
          <DialogTitle>Document Management</DialogTitle>
          <DialogDescription>
            Documents for {localVehicle.vehicle_number} | {localVehicle.company}{" "}
            {localVehicle.model}
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className={DM_ERROR_WRAPPER}>
            <span>{errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className={DM_ERROR_CLOSE}
            >
              &times;
            </button>
          </div>
        )}

        <div className={DM_GRID_CONTAINER}>
          {docTypes.map((doc) => {
            const filePath = localVehicle[doc.key as keyof Vehicle] as
              | string
              | undefined;
            const isLoading = loadingFields.includes(doc.key);
            const isViewing = viewingFields.includes(doc.key);

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
                      variant="outline"
                      size="sm"
                      className={DM_BUTTON_VIEW}
                      onClick={() => handleView(filePath, doc.key)}
                      disabled={isViewing}
                    >
                      {isViewing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4 mr-2" />
                      )}
                      {isViewing ? "Opening..." : "View"}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className={DM_BUTTON_DELETE}
                      onClick={() =>
                        setDeleteDocTarget({ key: doc.key, filePath })
                      }
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4" />
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
                      <UploadCloud className={DM_UPLOAD_ICON_CONTAINER} />
                      <span className={DM_UPLOAD_SUBTITLE}>
                        Upload Document
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>

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
    </Dialog>
  );
}
