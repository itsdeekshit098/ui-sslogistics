import { keyframes } from "styled-components";

/** The library's own animations, so no component depends on Tailwind's `animate-*`. */
export const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/** A placeholder block fading in and out while content loads. */
export const pulse = keyframes`
  50% { opacity: 0.5; }
`;

/** Three loading dots bouncing in turn. */
export const bounceDot = keyframes`
  0%, 80%, 100% { transform: scale(0.4); opacity: 0.3; }
  40% { transform: scale(1); opacity: 1; }
`;

/** Shared timing for the animations above. */
export const animation = {
  spin: "1s linear infinite",
  pulse: "2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
  bounceDot: "1.4s ease-in-out infinite",
} as const;

interface EnterFrom {
  opacity?: number;
  x?: string;
  y?: string;
  scale?: number;
}

/**
 * An "enter" animation: the element starts at the given opacity, offset and
 * scale and settles to its natural state. Use with `enterAnimation`.
 * (Replaces Tailwind's `animate-in fade-in-0 slide-in-from-* zoom-in-95`.)
 */
export const enterFrom = ({ opacity = 1, x = "0", y = "0", scale = 1 }: EnterFrom) => keyframes`
  from {
    opacity: ${opacity};
    transform: translate3d(${x}, ${y}, 0) scale3d(${scale}, ${scale}, ${scale});
  }
`;

/** The matching "exit" animation: settles from the natural state to the given one. */
export const exitTo = ({ opacity = 1, x = "0", y = "0", scale = 1 }: EnterFrom) => keyframes`
  to {
    opacity: ${opacity};
    transform: translate3d(${x}, ${y}, 0) scale3d(${scale}, ${scale}, ${scale});
  }
`;
