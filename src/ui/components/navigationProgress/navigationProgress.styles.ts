import styled from "styled-components";
import type { CSSProperties } from "react";

/** The thin rail fixed to the top edge, above everything. */
export const Rail = styled.div<{ $visible: boolean }>`
  @layer ui {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    z-index: 9999;
    pointer-events: none;
    opacity: ${(p) => (p.$visible ? 1 : 0)};
    transition: opacity 0.35s ease;
  }
`;

/*
 * The bar's width changes every ~120ms while loading, so it is passed as one
 * CSS custom property rather than generating a class per percentage.
 */
export const Bar = styled.div.attrs<{ $progress: number }>((p) => ({
  style: { "--progress": `${p.$progress}%` } as CSSProperties,
}))<{ $progress: number; $done: boolean }>`
  @layer ui {
    /* Positioned so the shimmer (absolute) anchors to this bar's right edge. */
    position: relative;
    height: 100%;
    width: var(--progress);
    border-radius: 0 1px 1px 0;
    background: linear-gradient(90deg, #6366f1 0%, #818cf8 40%, #a78bfa 70%, #c084fc 100%);
    box-shadow:
      0 0 8px rgba(99, 102, 241, 0.5),
      0 0 3px rgba(99, 102, 241, 0.3);
    transition: ${(p) => (p.$done ? "width 0.15s ease-out" : "width 120ms ease-in-out")};
  }
`;

/** A bright dot at the bar's tip. */
export const Shimmer = styled.div<{ $done: boolean }>`
  @layer ui {
    position: absolute;
    right: 0;
    top: -1px;
    width: 80px;
    height: 4px;
    border-radius: 0 2px 2px 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6));
    opacity: ${(p) => (p.$done ? 0 : 1)};
    transition: opacity 0.2s ease;
  }
`;
