import type { Entity } from "@/components/entitiesPage/entitiesPage.types";

export interface EntityModalProps {
  isOpen: boolean;
  /** Passing an entity switches the modal to edit mode. */
  entityToEdit?: Entity | null;
  onClose: () => void;
  onSuccess: (entity: Entity) => void;
  /** Stack above an already-open modal, for inline "+ Add" from a dropdown. */
  nested?: boolean;
}
