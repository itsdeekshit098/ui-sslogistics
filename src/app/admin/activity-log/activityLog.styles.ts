import {
  PAGE_CONTAINER,
  PAGE_HEADER_TITLE,
  PAGE_HEADER_DESC,
} from "@/lib/designTokens";

// Re-export shared tokens for backward compatibility
export const AL_CONTAINER = PAGE_CONTAINER;
export const AL_HEADER_TITLE = PAGE_HEADER_TITLE;
export const AL_HEADER_DESC = PAGE_HEADER_DESC;

export const ACTION_STYLES: Record<
  string,
  { bg: string; text: string; icon: string }
> = {
  CREATE_VEHICLE: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: "text-emerald-500 dark:text-emerald-400",
  },
  UPDATE_VEHICLE: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-400",
    icon: "text-blue-500 dark:text-blue-400",
  },
  DELETE_VEHICLE: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    icon: "text-destructive",
  },
  UPLOAD_DOCUMENT: {
    bg: "bg-violet-50 dark:bg-violet-500/10",
    text: "text-violet-700 dark:text-violet-400",
    icon: "text-violet-500 dark:text-violet-400",
  },
  DELETE_DOCUMENT: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    icon: "text-amber-500 dark:text-amber-400",
  },
};

export const ACTION_LABELS: Record<string, string> = {
  CREATE_VEHICLE: "Created Vehicle",
  UPDATE_VEHICLE: "Updated Vehicle",
  DELETE_VEHICLE: "Deleted Vehicle",
  UPLOAD_DOCUMENT: "Uploaded Document",
  DELETE_DOCUMENT: "Deleted Document",
};
