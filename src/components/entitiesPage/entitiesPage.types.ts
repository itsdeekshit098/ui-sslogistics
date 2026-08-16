export const ENTITY_KINDS = [
  { value: "FIRM", label: "Firm" },
  { value: "PERSON", label: "Person" },
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number]["value"];

export const RELATIONSHIPS = [
  { value: "INTERNAL", label: "Ours" },
  { value: "EXTERNAL", label: "External" },
] as const;

export type EntityRelationship = (typeof RELATIONSHIPS)[number]["value"];

/**
 * A party the business acts as or deals with: our proprietorships and the
 * family members behind them, plus external parties whose vehicles we run.
 * Loans and fundings record whose name they're in by pointing here, and it
 * replaced the old vehicle_owners table (sql/28_add_entities.sql).
 */
export interface Entity {
  id: number;
  name: string;
  entity_kind: EntityKind;
  relationship: EntityRelationship;
  proprietor_entity_id: number | null;
  /** Resolved server-side for display; not a stored column. */
  proprietor_name?: string | null;
  phone: string | null;
  email: string | null;
  pan: string | null;
  gst_number: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** Present only when the list is requested with `with_counts=true`. */
  vehicle_count?: number;
}

export interface EntityListResponse {
  data: Entity[];
  total: number;
}

export const ENTITY_NOTES_MAX_LENGTH = 500;

export function getEntityKindLabel(kind: string): string {
  return ENTITY_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export function getRelationshipLabel(relationship: string): string {
  return RELATIONSHIPS.find((r) => r.value === relationship)?.label ?? relationship;
}
