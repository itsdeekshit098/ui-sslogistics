import styled, { keyframes } from "styled-components";

const shimmer = keyframes`
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
`;

export const SkeletonBase = styled.span<{
    $width: string;
    $height: string;
    $borderRadius: string;
}>`
  display: inline-block;
  background: linear-gradient(
  90deg,
  rgb(240, 240, 240) 25%,
  rgb(220, 220, 220) 50%,
  rgb(240, 240, 240) 75%
);
  background-size: 200% 100%;
  animation: ${shimmer} 1.5s infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  width: ${({ $width }) => $width};
  height: ${({ $height }) => $height};
  border-radius: ${({ $borderRadius }) => $borderRadius};
`;