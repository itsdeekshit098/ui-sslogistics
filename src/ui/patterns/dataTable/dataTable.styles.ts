import styled, { css } from "styled-components";
import {
  color,
  fontWeight,
  leading,
  mix,
  motion,
  radius,
  shadow,
  space,
  tracking,
} from "../../tokens/tokens";
import { colorTransition, onDesktop, setLeading, stack, text } from "../../styles/mixins";

type Align = "left" | "center" | "right";

const mutedChevron = css`
  flex-shrink: 0;
  color: ${mix(color.mutedForeground, 60)};
`;

// ═══ Desktop table ═══════════════════════════════════════════════════════════

/** The bordered frame. Only from md up; phones get cards instead. */
export const Frame = styled.div<{ $maxHeight?: string | number }>`
  @layer ui {
    display: none;
    width: 100%;
    overflow: hidden;
    border-radius: ${radius.base};
    border-width: 1px;
    border-style: solid;
    border-color: ${color.border};
    background-color: ${color.card};
    box-shadow: ${shadow.card};

    ${(p) =>
      p.$maxHeight !== undefined &&
      css`
        max-height: ${typeof p.$maxHeight === "number" ? `${p.$maxHeight}px` : p.$maxHeight};
        overflow-y: auto;
      `}
  }

  ${onDesktop(css`
    display: block;
  `)}
`;

export const ScrollX = styled.div`
  @layer ui {
    width: 100%;
    overflow-x: auto;
  }
`;

export const Grid = styled.table`
  @layer ui {
    width: 100%;
    border-collapse: collapse;
    ${text("sm")}
  }
`;

export const Head = styled.thead<{ $sticky: boolean }>`
  @layer ui {
    ${(p) =>
      p.$sticky &&
      css`
        position: sticky;
        top: 0;
        z-index: 2;
      `}
  }
`;

export const HeadRow = styled.tr`
  @layer ui {
    border-bottom-style: solid;
    border-bottom-width: 1px;
    border-bottom-color: ${color.border};
    background-color: ${color.muted};
  }
`;

const headCell = css`
  background-color: ${color.muted};
  padding-inline: ${space[4]};
  padding-block: ${space[3]};
  ${text("xs")}
  font-weight: ${fontWeight.semibold};
  text-transform: uppercase;
  letter-spacing: ${tracking.wide};
  color: ${color.mutedForeground};
`;

export const Th = styled.th<{
  $align: Align;
  $sortable: boolean;
  $width?: string;
  $minWidth?: string;
}>`
  @layer ui {
    ${headCell}
    white-space: nowrap;
    user-select: none;
    text-align: ${(p) => p.$align};
    ${(p) => p.$sortable && "cursor: pointer;"}
    ${(p) => p.$width && `width: ${p.$width};`}
    ${(p) => p.$minWidth && `min-width: ${p.$minWidth};`}
  }
`;

export const ThTrailing = styled.th`
  @layer ui {
    ${headCell}
    text-align: right;
  }
`;

export const ThInner = styled.span`
  @layer ui {
    display: inline-flex;
    align-items: center;
    gap: ${space[1.5]};
  }
`;

export const SortGlyph = styled.span<{ $active: boolean }>`
  @layer ui {
    display: inline-flex;
    flex-direction: column;
    gap: 1px;
    transition-property: opacity;
    transition-timing-function: ${motion.easing};
    transition-duration: ${motion.duration};
    color: ${(p) => (p.$active ? color.primary : color.mutedForeground)};
    opacity: ${(p) => (p.$active ? "100%" : "30%")};
  }
`;

export const BodyRow = styled.tr<{ $clickable: boolean; $striped: boolean }>`
  @layer ui {
    border-bottom-style: solid;
    border-bottom-width: 1px;
    border-bottom-color: ${color.border};
    ${colorTransition}

    ${(p) =>
      p.$clickable &&
      css`
        cursor: pointer;

        @media (hover: hover) {
          &:hover {
            background-color: ${color.muted};
          }
        }
      `}

    ${(p) => p.$striped && `background-color: ${color.muted};`}
  }
`;

export const Td = styled.td<{ $dense: boolean; $align: Align }>`
  @layer ui {
    padding-block: ${(p) => (p.$dense ? space[2] : space[3.5])};
    padding-inline: ${space[4]};
    vertical-align: middle;
    ${setLeading(leading.relaxed)}
    color: ${color.foreground};
    text-align: ${(p) => p.$align};
  }
`;

export const TdTrailing = styled.td<{ $dense: boolean }>`
  @layer ui {
    padding-block: ${(p) => (p.$dense ? space[2] : space[3.5])};
    padding-inline: ${space[4]};
    text-align: right;
  }
`;

export const TrailingRow = styled.div`
  @layer ui {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${space[2]};
  }
`;

export const ActionGroup = styled.div`
  @layer ui {
    display: flex;
    align-items: center;
    gap: ${space[2]};
  }
`;

export const RowChevron = styled.span`
  @layer ui {
    display: inline-flex;
    ${mutedChevron}
  }
`;

export const EmptyBox = styled.div`
  @layer ui {
    padding: ${space[12]};
    text-align: center;
  }
`;

export const EmptyColumn = styled.div`
  @layer ui {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${space[3]};
    color: ${color.mutedForeground};
  }
`;

export const EmptyText = styled.p`
  @layer ui {
    font-size: 0.9rem;
    font-weight: ${fontWeight.medium};
  }
`;

// ─── Loading placeholders ────────────────────────────────────────────────────

export const SkeletonRow = styled.tr`
  @layer ui {
    border-bottom-style: solid;
    border-bottom-width: 1px;
    border-bottom-color: ${color.border};
  }
`;

export const SkeletonCell = styled.td`
  @layer ui {
    padding-inline: ${space[4]};
    padding-block: ${space[3.5]};
  }
`;


// ─── Row action buttons ──────────────────────────────────────────────────────

export const ActionBtn = styled.button<{ $danger: boolean; $disabled: boolean }>`
  @layer ui {
    display: inline-flex;
    height: 2.125rem;
    width: 2.125rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: ${radius.base};
    transition-property: all;
    transition-timing-function: ${motion.easing};
    transition-duration: 150ms;

    &:focus-visible {
      outline-style: none;
      box-shadow:
        0 0 0 2px ${color.card},
        0 0 0 4px ${color.ring};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 40%;
    }

    ${(p) =>
      p.$danger
        ? css`
            background-color: ${color.destructiveSubtle};
            color: ${color.destructive};

            @media (hover: hover) {
              &:hover {
                background-color: ${mix(color.destructive, 20)};
              }
            }
          `
        : css`
            background-color: ${color.muted};
            color: ${color.mutedForeground};

            @media (hover: hover) {
              &:hover {
                background-color: ${color.accent};
                color: ${color.accentForeground};
              }
            }
          `}

    ${(p) =>
      !p.$disabled &&
      css`
        @media (hover: hover) {
          &:hover {
            scale: 105%;
          }
        }

        &:active {
          scale: 95%;
        }
      `}
  }
`;

/** Wraps a disabled action so a tooltip can explain why. */
export const DisabledWrap = styled.span`
  @layer ui {
    display: inline-block;
    cursor: not-allowed;
  }
`;

export const DisabledInner = styled.span`
  @layer ui {
    pointer-events: none;
    display: inline-flex;
  }
`;

// ═══ Phone cards ═════════════════════════════════════════════════════════════

export const CardList = styled.div<{ $timeline: boolean; $loading: boolean }>`
  @layer ui {
    ${(p) =>
      p.$timeline
        ? css`
            margin-left: ${space[1.5]};
            border-left-style: solid;
            border-left-width: 2px;
            border-left-color: ${color.border};
          `
        : css`
            display: flex;
            flex-direction: column;
            gap: ${space[3]};
          `}

    ${(p) =>
      p.$loading &&
      css`
        opacity: 70%;
        transition-property: opacity;
        transition-timing-function: ${motion.easing};
        transition-duration: ${motion.duration};
      `}
  }

  ${onDesktop(css`
    display: none;
  `)}
`;

export const Card = styled.div<{ $clickable: boolean }>`
  @layer ui {
    /* Same reason as TimelineRow: long unbroken text wraps. */
    overflow-wrap: anywhere;
    border-radius: ${radius.phoneCard};
    border-width: 1px;
    border-style: solid;
    border-color: ${color.border};
    background-color: ${color.card};
    padding-inline: ${space[3.5]};
    padding-block: ${space[3]};
    box-shadow: ${shadow.phoneCard};
    transition-property: transform, translate, scale, rotate;
    transition-timing-function: ${motion.easing};
    transition-duration: ${motion.duration};

    ${(p) =>
      p.$clickable &&
      css`
        cursor: pointer;

        &:active {
          scale: 0.99;
          background-color: ${mix(color.muted, 50)};
        }
      `}
  }
`;

export const CardHeader = styled.div`
  @layer ui {
    display: flex;
    align-items: flex-start;
    gap: ${space[3]};
  }
`;

export const CardBody = styled.div`
  @layer ui {
    display: flex;
    align-items: flex-start;
    gap: ${space[2]};
  }
`;

export const Grow = styled.div`
  @layer ui {
    min-width: 0;
    flex: 1;
  }
`;

export const Titles = styled.div`
  @layer ui {
    min-width: 0;
    flex: 1;
    ${stack(space[0.5])}
  }
`;

export const Title = styled.div<{ $timeline: boolean }>`
  @layer ui {
    font-size: 0.9375rem;
    font-weight: ${(p) => (p.$timeline ? fontWeight.semibold : fontWeight.extrabold)};
    color: ${color.foreground};
  }
`;

export const Subtitle = styled.div`
  @layer ui {
    font-size: 12.5px;
    color: ${color.mutedForeground};
  }
`;

export const Side = styled.div`
  @layer ui {
    display: flex;
    max-width: 50%;
    flex-shrink: 0;
    flex-direction: column;
    align-items: flex-end;
    gap: ${space[1]};
    text-align: right;
    ${text("sm")}
  }
`;

export const MenuButton = styled.button`
  @layer ui {
    margin-right: calc(${space[2]} * -1);
    margin-top: calc(${space[1.5]} * -1);
    display: flex;
    height: ${space[9]};
    width: ${space[9]};
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: ${radius.base};
    color: ${color.mutedForeground};
    ${colorTransition}

    @media (hover: hover) {
      &:hover {
        background-color: ${color.muted};
      }
    }

    &:active {
      background-color: ${color.muted};
    }
  }
`;

export const CardChevron = styled.span`
  @layer ui {
    margin-top: ${space[0.5]};
    display: inline-flex;
    ${mutedChevron}
  }
`;

export const FooterRow = styled.div<{ $timeline: boolean }>`
  @layer ui {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: ${space[2]};

    ${(p) =>
      p.$timeline
        ? css`
            margin-top: ${space[2]};
          `
        : css`
            margin-top: ${space[3]};
            border-top-style: solid;
            border-top-width: 1px;
            border-top-color: ${color.border};
            padding-top: ${space[3]};
          `}
  }
`;

export const MinZero = styled.div`
  @layer ui {
    min-width: 0;
  }
`;

export const Fields = styled.dl`
  @layer ui {
    margin-top: ${space[2.5]};
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: ${space[4]};
    row-gap: ${space[2.5]};
  }
`;

export const FieldLabel = styled.dt`
  @layer ui {
    font-size: 10.5px;
    color: ${color.mutedForeground};
  }
`;

export const FieldValue = styled.dd`
  @layer ui {
    font-size: 13px;
    font-weight: ${fontWeight.semibold};
    color: ${color.foreground};
  }
`;

// ─── Timeline layout ─────────────────────────────────────────────────────────

export const TimelineItem = styled.div`
  @layer ui {
    position: relative;
    padding-bottom: ${space[5]};
    padding-left: ${space[5]};

    &:last-child {
      padding-bottom: 0;
    }
  }
`;

export const TimelineDot = styled.span`
  @layer ui {
    position: absolute;
    left: calc(7px * -1);
    top: ${space[1.5]};
    height: ${space[3]};
    width: ${space[3]};
    border-radius: 9999px;
    border-width: 2px;
    border-style: solid;
    border-color: ${color.background};
    background-color: ${color.primary};
  }
`;

export const TimelineRow = styled.div<{ $clickable: boolean }>`
  @layer ui {
    border-radius: ${radius.base};
    /* A long unbroken value (a reference number, pasted text) wraps instead of
       running off the screen. Inherited by everything inside the row. */
    overflow-wrap: anywhere;

    ${(p) =>
      p.$clickable &&
      css`
        cursor: pointer;

        &:active {
          background-color: ${mix(color.muted, 50)};
        }
      `}
  }
`;

export const TimelineFields = styled.dl`
  @layer ui {
    margin-top: ${space[1.5]};
    display: flex;
    flex-wrap: wrap;
    column-gap: ${space[4]};
    row-gap: ${space[1]};
    ${text("xs")}
  }
`;

export const TimelineField = styled.div`
  @layer ui {
    display: flex;
    min-width: 0;
    align-items: baseline;
    gap: ${space[1.5]};
  }
`;

export const TimelineLabel = styled.dt`
  @layer ui {
    /* Keeps its width when the value beside it is a long unbroken string. */
    flex-shrink: 0;
    color: ${color.mutedForeground};
  }
`;

export const TimelineValue = styled.dd`
  @layer ui {
    min-width: 0;
    color: ${color.foreground};
  }
`;

// ─── Phone states ────────────────────────────────────────────────────────────

export const SkeletonCardBox = styled.div`
  @layer ui {
    border-radius: ${radius.phoneCard};
    border-width: 1px;
    border-style: solid;
    border-color: ${color.border};
    background-color: ${color.card};
    padding-inline: ${space[3.5]};
    padding-block: ${space[3]};
    ${stack(space[3])}
  }
`;

export const SkeletonSplit = styled.div`
  @layer ui {
    display: flex;
    justify-content: space-between;
    gap: ${space[4]};
  }
`;

export const SkeletonGrid = styled.div`
  @layer ui {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${space[3]};
  }
`;

export const EmptyCard = styled.div`
  @layer ui {
    border-radius: ${radius.phoneCard};
    border-width: 1px;
    border-style: dashed;
    border-color: ${color.border};
    background-color: ${color.card};
    padding: ${space[8]};
    text-align: center;
  }

  ${onDesktop(css`
    display: none;
  `)}
`;

export const EmptyCardColumn = styled.div`
  @layer ui {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${space[4]};
    color: ${color.mutedForeground};
  }
`;

export const EmptyCardIcon = styled.span`
  @layer ui {
    display: flex;
    height: ${space[16]};
    width: ${space[16]};
    align-items: center;
    justify-content: center;
    border-radius: ${radius.phoneCard};
    background-color: ${color.border};
  }
`;

export const EmptyCardText = styled.p`
  @layer ui {
    ${text("base")}
    font-weight: ${fontWeight.semibold};
    color: ${color.foreground};
  }
`;

// ─── Phone action sheet ──────────────────────────────────────────────────────

export const SheetMenu = styled.div`
  @layer ui {
    display: flex;
    flex-direction: column;
    padding-block: ${space[1]};
  }
`;

export const MenuItem = styled.button<{ $danger: boolean }>`
  @layer ui {
    display: flex;
    min-height: ${space[12]};
    width: 100%;
    align-items: center;
    gap: ${space[3]};
    border-radius: ${radius.base};
    padding-inline: ${space[3]};
    padding-block: ${space[2]};
    text-align: left;
    font-size: 15px;
    font-weight: ${fontWeight.medium};
    color: ${(p) => (p.$danger ? color.destructive : color.foreground)};
    ${colorTransition}

    &:active {
      background-color: ${color.muted};
    }

    &:disabled {
      opacity: 50%;
    }
  }
`;

export const MenuIcon = styled.span`
  @layer ui {
    display: flex;
    height: ${space[5]};
    width: ${space[5]};
    flex-shrink: 0;
    align-items: center;
    justify-content: center;

    & svg {
      height: 18px;
      width: 18px;
    }
  }
`;

export const MenuText = styled.span`
  @layer ui {
    min-width: 0;
  }
`;

export const Block = styled.span`
  @layer ui {
    display: block;
  }
`;

export const MenuReason = styled.span`
  @layer ui {
    display: block;
    ${text("xs")}
    font-weight: ${fontWeight.normal};
    color: ${color.mutedForeground};
  }
`;

