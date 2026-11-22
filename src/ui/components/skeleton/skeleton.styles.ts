import styled from "styled-components";
import { animation, pulse } from "../../tokens/keyframes";
import { color } from "../../tokens/tokens";

export const StyledSkeleton = styled.span<{
  $width: string;
  $height: string;
  $radius: string;
  $tone: "default" | "muted";
  $block: boolean;
  $center: boolean;
}>`
  @layer ui {
    display: ${(p) => (p.$block || p.$center ? "block" : "inline-block")};
    width: ${(p) => p.$width};
    height: ${(p) => p.$height};
    border-radius: ${(p) => p.$radius};
    background-color: ${(p) => (p.$tone === "muted" ? color.muted : color.skeleton)};
    animation: ${pulse} ${animation.pulse};
    ${(p) => (p.$center ? "margin-inline: auto;" : "")}
  }
`;
