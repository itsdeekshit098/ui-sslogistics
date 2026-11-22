import styled, { css } from "styled-components";
import type { CSSProperties } from "react";
import { color, fontWeight, radius, space, zIndex } from "../../tokens/tokens";
import { colorTransition, onDesktop, text } from "../../styles/mixins";
import { Button } from "../button";
import { Input } from "../input";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "../../icons";

export interface Placement {
  left: number;
  width: number;
  /** Open downward: distance from the viewport top. */
  top?: number;
  /** Open upward: distance from the viewport bottom. */
  bottom?: number;
  maxHeight: number;
}

export const Root = styled.div`
  @layer ui {
    position: relative;
    width: 100%;
    scroll-margin-top: ${space[12]};
  }
`;

const insideField = css`
  pointer-events: none;
  position: absolute;
  top: 50%;
  z-index: 10;
  translate: 0 -50%;
  color: ${color.mutedForeground};
`;

export const LeadingIcon = styled(SearchIcon)`
  @layer ui {
    ${insideField}
    left: ${space[3]};
  }
`;

export const TrailingIcon = styled(ChevronDownIcon)`
  @layer ui {
    ${insideField}
    right: ${space[3]};
  }
`;

export const Field = styled(Input)<{ $invalid: boolean }>`
  @layer ui {
    height: var(--input-height);
    padding-left: ${space[9]};
    padding-right: ${space[16]};

    ${(p) =>
      p.$invalid &&
      css`
        border-color: ${color.destructive};

        &:focus-visible {
          box-shadow:
            0 0 0 2px ${color.background},
            0 0 0 4px ${color.destructive};
        }
      `}
  }
`;

export const ClearButton = styled(Button)`
  @layer ui {
    position: absolute;
    right: ${space[8]};
    top: 50%;
    z-index: 10;
    display: inline-flex;
    height: ${space[8]};
    width: ${space[8]};
    padding: 0;
    translate: 0 -50%;
    align-items: center;
    justify-content: center;
    border-radius: ${radius.base};
    color: ${color.mutedForeground};
    ${colorTransition}

    @media (hover: hover) {
      &:hover {
        background-color: ${color.secondary};
        color: ${color.foreground};
      }
    }

    &:focus-visible {
      outline-style: none;
      box-shadow: 0 0 0 2px ${color.ring};
    }
  }

  ${onDesktop(css`
    height: ${space[6]};
    width: ${space[6]};
  `)}
`;

/*
 * The list is positioned against the input's measured box and the visual
 * viewport (so it clears the on-screen keyboard); those numbers change on
 * scroll and resize, so they travel as CSS custom properties rather than as a
 * new class per pixel value.
 */
export const Listbox = styled.div.attrs<{ $placement: Placement }>((p) => ({
  style: {
    "--cb-left": `${p.$placement.left}px`,
    "--cb-width": `${p.$placement.width}px`,
    "--cb-top": p.$placement.top != null ? `${p.$placement.top}px` : "auto",
    "--cb-bottom": p.$placement.bottom != null ? `${p.$placement.bottom}px` : "auto",
    "--cb-max-height": `${p.$placement.maxHeight}px`,
  } as CSSProperties,
}))<{ $placement: Placement }>`
  @layer ui {
    position: fixed;
    left: var(--cb-left);
    width: var(--cb-width);
    top: var(--cb-top);
    bottom: var(--cb-bottom);
    max-height: var(--cb-max-height);
    z-index: ${zIndex.popover};
    overflow-y: auto;
    border-radius: ${radius.base};
    border-width: 1px;
    border-style: solid;
    border-color: ${color.popupBorder};
    background-color: ${color.background};
    padding: ${space[1]};
    ${text("sm")}
    color: ${color.foreground};
    box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
    filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.15));
  }
`;

export const Option = styled(Button)<{ $highlighted: boolean; $selected: boolean }>`
  @layer ui {
    display: flex;
    min-height: ${space[11]};
    width: 100%;
    height: auto;
    align-items: center;
    justify-content: flex-start;
    gap: ${space[3]};
    border-radius: calc(${radius.input} - 1px);
    padding-block: ${space[2]};
    padding-left: ${space[3]};
    padding-right: ${space[3]};
    text-align: left;
    outline-style: none;
    font-weight: ${fontWeight.normal};
    ${colorTransition}

    ${(p) =>
      p.$highlighted &&
      css`
        background-color: ${color.secondary};
        color: ${color.foreground};
      `}

    ${(p) =>
      p.$selected &&
      css`
        font-weight: ${fontWeight.semibold};
      `}
  }
`;

export const OptionText = styled.span`
  @layer ui {
    min-width: 0;
    flex: 1;
  }
`;

const ellipsis = css`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const OptionLabel = styled.span`
  @layer ui {
    ${ellipsis}
  }
`;

export const OptionDescription = styled.span`
  @layer ui {
    ${ellipsis}
    margin-top: ${space[0.5]};
    ${text("xs")}
    font-weight: ${fontWeight.normal};
    color: ${color.mutedForeground};
  }
`;

export const SelectedMark = styled(CheckIcon)`
  @layer ui {
    flex-shrink: 0;
    color: ${color.primary};
  }
`;

export const Empty = styled.div`
  @layer ui {
    padding-inline: ${space[3]};
    padding-block: ${space[3]};
    ${text("sm")}
    color: ${color.mutedForeground};
  }
`;

/** An action in the listbox footer, e.g. "+ Add new firm", set apart by a top border. */
export const FooterAction = styled(Button)`
  @layer ui {
    display: flex;
    width: 100%;
    align-items: center;
    gap: ${space[2]};
    border-radius: 0;
    border-top-style: solid;
    border-top-width: 1px;
    border-top-color: ${color.border};
    padding-inline: ${space[3]};
    padding-block: ${space[2.5]};
    text-align: left;
    ${text("sm")}
    font-weight: ${fontWeight.medium};
    color: ${color.primary};

    @media (hover: hover) {
      &:hover {
        background-color: ${color.accent};
      }
    }
  }
`;
