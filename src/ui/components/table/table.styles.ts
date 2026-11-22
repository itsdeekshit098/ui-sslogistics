import styled from "styled-components";
import { color, fontWeight, mix, space } from "../../tokens/tokens";
import { colorTransition, text } from "../../styles/mixins";

/** The scroll container the table sits in. */
export const Scroller = styled.div`
  @layer ui {
    position: relative;
    width: 100%;
    overflow: auto;
  }
`;

export const StyledTable = styled.table`
  @layer ui {
    width: 100%;
    caption-side: bottom;
    ${text("sm")}
  }
`;

export const Head = styled.thead`
  @layer ui {
    & tr {
      border-bottom-style: solid;
      border-bottom-width: 1px;
    }
  }
`;

export const Body = styled.tbody`
  @layer ui {
    & tr:last-child {
      border-width: 0;
    }
  }
`;

export const Foot = styled.tfoot`
  @layer ui {
    border-top-style: solid;
    border-top-width: 1px;
    background-color: ${mix(color.muted, 50)};
    font-weight: ${fontWeight.medium};

    & > tr:last-child {
      border-bottom-width: 0;
    }
  }
`;

export const Row = styled.tr`
  @layer ui {
    border-bottom-style: solid;
    border-bottom-width: 1px;
    ${colorTransition}

    @media (hover: hover) {
      &:hover {
        background-color: ${mix(color.muted, 50)};
      }
    }

    &[data-state="selected"] {
      background-color: ${color.muted};
    }
  }
`;

export const HeadCell = styled.th`
  @layer ui {
    height: ${space[12]};
    padding-inline: ${space[4]};
    text-align: left;
    vertical-align: middle;
    font-weight: ${fontWeight.medium};
    color: ${color.mutedForeground};

    &:has([role="checkbox"]) {
      padding-right: 0;
    }
  }
`;

export const Cell = styled.td`
  @layer ui {
    padding: ${space[4]};
    vertical-align: middle;

    &:has([role="checkbox"]) {
      padding-right: 0;
    }
  }
`;

export const Caption = styled.caption`
  @layer ui {
    margin-top: ${space[4]};
    ${text("sm")}
    color: ${color.mutedForeground};
  }
`;
