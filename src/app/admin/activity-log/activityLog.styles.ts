export const AL_CONTAINER = "container mx-auto space-y-6 md:space-y-8";
export const AL_HEADER_TITLE = "text-2xl md:text-3xl font-bold tracking-tight";
export const AL_HEADER_DESC = "text-sm md:text-base text-muted-foreground";

// Action badge color mappings
export const ACTION_STYLES: Record<
  string,
  { bg: string; text: string; icon: string }
> = {
  CREATE_VEHICLE: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    icon: "text-emerald-500",
  },
  UPDATE_VEHICLE: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    icon: "text-blue-500",
  },
  DELETE_VEHICLE: {
    bg: "bg-red-50",
    text: "text-red-700",
    icon: "text-red-500",
  },
  UPLOAD_DOCUMENT: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    icon: "text-violet-500",
  },
  DELETE_DOCUMENT: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    icon: "text-amber-500",
  },
};

export const ACTION_LABELS: Record<string, string> = {
  CREATE_VEHICLE: "Created Vehicle",
  UPDATE_VEHICLE: "Updated Vehicle",
  DELETE_VEHICLE: "Deleted Vehicle",
  UPLOAD_DOCUMENT: "Uploaded Document",
  DELETE_DOCUMENT: "Deleted Document",
};
