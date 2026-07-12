export interface LocationSuggestion {
  label: string;
  latitude: number;
  longitude: number;
}

export interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "data-testid"?: string;
}
