import styled from "styled-components";
import { color, fontWeight } from "../../tokens/tokens";

const SIZE = {
  sm: { box: "1.75rem", font: "0.6875rem" },
  md: { box: "2.25rem", font: "0.8125rem" },
  lg: { box: "3rem", font: "1rem" },
} as const;

export const Root = styled.span<{ $size: "sm" | "md" | "lg" }>`
  @layer ui {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    width: ${(p) => SIZE[p.$size].box};
    height: ${(p) => SIZE[p.$size].box};
    border-radius: 9999px;
    background-color: ${color.primary};
    color: ${color.primaryForeground};
    font-size: ${(p) => SIZE[p.$size].font};
    font-weight: ${fontWeight.semibold};
    line-height: 1;
    user-select: none;
  }
`;

export const Photo = styled.img`
  @layer ui {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;
