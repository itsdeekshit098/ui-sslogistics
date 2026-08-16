export interface LookupOption {
  id: number;
  category: string;
  value: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
}

export interface LookupSelectProps {
  /** Which list to read, e.g. "loan_type" — see sql/29_add_lookup_options.sql. */
  category: string;
  /** The selected option's `value` (not its id), or "" for none. */
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  /** Singular noun used in the "+ Add new …" affordance, e.g. "loan type". */
  addLabel?: string;
  /** Set false to hide the inline add action for read-only contexts. */
  allowAdd?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  className?: string;
}
