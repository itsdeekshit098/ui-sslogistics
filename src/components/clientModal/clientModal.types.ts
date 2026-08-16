import type { Client } from "@/components/clientsPage/clientsPage.types";

export interface ClientModalProps {
  isOpen: boolean;
  /** Passing a client switches the modal to edit mode. */
  clientToEdit?: Client | null;
  onClose: () => void;
  /** Fired after a successful save; the caller refetches. */
  onSuccess: () => void;
  mode?: "standalone" | "nested";
}
