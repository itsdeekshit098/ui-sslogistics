// Strict extraction of styling properties per architectural rules.
// Since the project natively utilizes TailwindCSS and Shadcn UI logic,
// styles are isolated as string constants here instead of forced styled-components.

export const DM_DIALOG_CONTENT =
  "w-[95vw] max-w-[44rem] p-0 overflow-hidden rounded-xl sm:rounded-2xl";
export const DM_GRID_CONTAINER =
  "grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 py-4 items-start";
export const DM_CARD_CONTAINER =
  "border rounded-lg p-3 md:p-4 flex flex-col space-y-3 shadow-sm bg-card";
export const DM_CARD_HEADER =
  "font-medium text-sm md:text-base flex items-center justify-between";

// Active Document View Styles
export const DM_ACTIVE_DOC_WRAPPER =
  "flex border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/30 px-3 rounded-lg items-center justify-center gap-3 h-[88px]";
export const DM_BUTTON_VIEW =
  "text-green-700 dark:text-green-400 bg-white dark:bg-black border-green-200 dark:border-green-900/50 hover:bg-green-100 dark:hover:bg-green-900/40";
export const DM_BUTTON_DELETE =
  "text-destructive bg-white dark:bg-black border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50";

// Upload Missing State Styles
export const DM_UPLOAD_WRAPPER = "";
export const DM_UPLOAD_DROPZONE =
  "relative border-2 border-dashed border-muted-foreground/25 rounded-lg flex flex-col items-center justify-center h-[88px] hover:bg-muted/50 transition-colors cursor-pointer w-full";
export const DM_UPLOAD_INPUT_FIELD =
  "absolute inset-0 w-full h-full opacity-0 cursor-pointer";
export const DM_UPLOAD_ICON_CONTAINER =
  "h-6 w-6 text-muted-foreground mb-1";
export const DM_UPLOAD_SUBTITLE = "text-xs text-muted-foreground";

export const DM_ERROR_WRAPPER = "bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-4 border border-destructive/20 flex justify-between items-center";
export const DM_ERROR_CLOSE = "text-destructive/70 hover:text-destructive text-lg font-bold leading-none cursor-pointer";

export const DM_LOADER_ICON = "h-4 w-4 animate-spin text-muted-foreground";

// Validity date inputs (insurance + FC only)
export const DM_DATE_ROW = "flex gap-2 items-center";
export const DM_DATE_LABEL = "text-xs text-muted-foreground w-10 shrink-0";
export const DM_DATE_INPUT =
  "flex-1 text-xs border rounded-md px-2 py-1 bg-background";
