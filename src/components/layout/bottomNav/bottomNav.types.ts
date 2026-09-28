export interface BottomNavProps {
  /** Opens the full-menu sheet (the "More" tab) */
  onOpenMenu: () => void;
  /** Highlights "More" while the sheet is open */
  menuOpen: boolean;
  className?: string;
}
