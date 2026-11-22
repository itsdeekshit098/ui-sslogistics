import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names and resolves conflicting Tailwind utilities (the last one
 * wins), e.g. `cn("p-4", "p-2")` -> `"p-2"`. For feature code that still styles
 * itself with Tailwind; the UI library (`src/ui`) does not use it.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
