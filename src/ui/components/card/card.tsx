"use client";

import { forwardRef, type HTMLAttributes } from "react";
import {
  StyledCard,
  StyledCardContent,
  StyledCardDescription,
  StyledCardFooter,
  StyledCardHeader,
  StyledCardTitle,
} from "./card.styles";

type DivProps = HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, DivProps>(function Card(props, ref) {
  return <StyledCard ref={ref} data-ui="card" {...props} />;
});

export const CardHeader = forwardRef<HTMLDivElement, DivProps>(function CardHeader(props, ref) {
  return <StyledCardHeader ref={ref} data-ui="card-header" {...props} />;
});

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle(props, ref) {
    return <StyledCardTitle ref={ref} data-ui="card-title" {...props} />;
  },
);

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function CardDescription(props, ref) {
    return <StyledCardDescription ref={ref} data-ui="card-description" {...props} />;
  },
);

export const CardContent = forwardRef<HTMLDivElement, DivProps>(function CardContent(props, ref) {
  return <StyledCardContent ref={ref} data-ui="card-content" {...props} />;
});

export const CardFooter = forwardRef<HTMLDivElement, DivProps>(function CardFooter(props, ref) {
  return <StyledCardFooter ref={ref} data-ui="card-footer" {...props} />;
});
