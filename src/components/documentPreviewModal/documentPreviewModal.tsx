"use client";

import { useState } from "react";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { DownloadIcon } from "@/components/ui/icon";
import { LoadingSpinner } from "@/components/loadingSpinner";
import type { DocumentPreviewModalProps } from "./documentPreviewModal.types";
import * as styles from "./documentPreviewModal.style";

/** Check whether a file path represents an image (vs. PDF/other). */
function isImageFile(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
}

/**
 * In-app document preview modal.
 *
 * - PDFs are rendered in an `<iframe>` pointing at the server-side proxy.
 * - Images are rendered via `<img>` with the same proxy URL.
 * - A download button is always available.
 *
 * The browser never sees the Supabase storage URL — only our own API route.
 */
export function DocumentPreviewModal({
  isOpen,
  onClose,
  filePath,
  label,
}: DocumentPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const proxyUrl = `/api/vehicles/documents/view?filePath=${encodeURIComponent(filePath)}`;
  const downloadUrl = `${proxyUrl}&download=true`;
  const isImage = isImageFile(filePath);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // Reset loading/error state whenever the modal opens with new content
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
    setIsLoading(true);
    setHasError(false);
  };

  return (
    <Modal open={isOpen} onOpenChange={handleOpenChange} nested>
      <ModalContent style={styles.previewContainer}>
        {/* ── Header ── */}
        <div className={styles.headerWrapper}>
          <h3 className={styles.headerTitle}>{label}</h3>
          <div className={styles.downloadButtonWrapper}>
            <a
              href={downloadUrl}
              download
              className={styles.downloadLink}
              aria-label="Download document"
              title="Download"
            >
              <DownloadIcon size={14} />
              <span className={styles.downloadLabel}>Download</span>
            </a>
          </div>
        </div>

        {/* ── Content area ── */}
        <div style={styles.contentArea}>
          {/* Loading overlay (shown while iframe/image is loading) */}
          {isLoading && !hasError && (
            <div style={styles.loadingContainer}>
              <LoadingSpinner size="md" centered label="Loading preview" />
            </div>
          )}

          {/* Error state */}
          {hasError && (
            <div style={styles.errorContainer}>
              <p>Failed to load the document.</p>
              <Button variant="outline" size="sm" onClick={() => onClose()}>
                Close
              </Button>
            </div>
          )}

          {/* PDF preview via iframe */}
          {!isImage && !hasError && (
            <iframe
              src={proxyUrl}
              title={`Preview: ${label}`}
              style={{
                ...styles.iframe,
                display: isLoading ? "none" : "block",
              }}
              onLoad={handleLoad}
              onError={handleError}
            />
          )}

          {/* Image preview */}
          {isImage && !hasError && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxyUrl}
              alt={label}
              style={{
                ...styles.previewImage,
                display: isLoading ? "none" : "block",
              }}
              onLoad={handleLoad}
              onError={handleError}
            />
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
