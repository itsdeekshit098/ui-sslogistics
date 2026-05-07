import type React from "react";

export interface TypeaheadProps<TOption> {
  options: TOption[];
  value: string;
  onValueChange: (value: string, option: TOption | null) => void;
  getOptionLabel: (option: TOption) => string;
  getOptionValue: (option: TOption) => string;
  getOptionDescription?: (option: TOption) => React.ReactNode;
  getOptionKeywords?: (option: TOption) => string[];
  id?: string;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  inputClassName?: string;
  clearable?: boolean;
  "data-testid"?: string;
}
