import { color, mix } from "../tokens/tokens";

/**
 * The meaning a component expresses. Every new component in the library takes
 * `tone` (what it means) separately from `variant` (how it is drawn), so
 * "danger" looks like danger whether it is an alert, a chip or a toast.
 */
export type Tone = "neutral" | "primary" | "info" | "success" | "warning" | "danger";

export interface ToneColors {
  /** A filled surface and the readable colour on it. */
  solid: string;
  onSolid: string;
  /** A soft tinted surface, its text colour, and its border. */
  subtle: string;
  onSubtle: string;
  border: string;
  /** The tone as a plain accent (an icon, a border, a focus ring). */
  accent: string;
}

export const toneColors: Record<Tone, ToneColors> = {
  neutral: {
    solid: color.secondary,
    onSolid: color.secondaryForeground,
    subtle: color.muted,
    onSubtle: color.mutedForeground,
    border: color.border,
    accent: color.mutedForeground,
  },
  primary: {
    solid: color.primary,
    onSolid: color.primaryForeground,
    subtle: mix(color.primary, 10),
    onSubtle: color.primary,
    border: mix(color.primary, 25),
    accent: color.primary,
  },
  info: {
    solid: color.info,
    onSolid: color.infoForeground,
    subtle: color.infoSubtle,
    onSubtle: color.infoSubtleForeground,
    border: mix(color.info, 20),
    accent: color.info,
  },
  success: {
    solid: color.success,
    onSolid: color.successForeground,
    subtle: color.successSubtle,
    onSubtle: color.successSubtleForeground,
    border: mix(color.success, 20),
    accent: color.success,
  },
  warning: {
    solid: color.warning,
    onSolid: color.warningForeground,
    subtle: color.warningSubtle,
    onSubtle: color.warningSubtleForeground,
    border: mix(color.warning, 25),
    accent: color.warning,
  },
  danger: {
    solid: color.destructive,
    onSolid: color.destructiveForeground,
    subtle: color.destructiveSubtle,
    onSubtle: color.destructiveSubtleForeground,
    border: mix(color.destructive, 20),
    accent: color.destructive,
  },
};
