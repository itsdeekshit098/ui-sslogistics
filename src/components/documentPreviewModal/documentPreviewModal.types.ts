export interface DocumentPreviewModalProps {
  /** Whether the preview modal is open. */
  isOpen: boolean;
  /** Called when the modal should close. */
  onClose: () => void;
  /** The storage file path to preview (e.g. "AP39UQ5739/rc_url.pdf"). */
  filePath: string;
  /** Human-readable label for the document (e.g. "Registration (RC)"). */
  label: string;
}
