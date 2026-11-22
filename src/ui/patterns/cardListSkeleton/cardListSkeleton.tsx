"use client";

import { Skeleton } from "../../components/skeleton";
import {
  CardActions,
  CardHeaderRow,
  CardList,
  SkeletonCard,
  Stack2,
} from "./cardListSkeleton.styles";
import type { CardListSkeletonProps } from "./cardListSkeleton.types";

export function CardListSkeleton({ count = 4, lines = 2, className }: CardListSkeletonProps) {
  return (
    <CardList data-ui="card-list-skeleton" $default={className === undefined} className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i}>
          <CardHeaderRow>
            <Stack2>
              <Skeleton width="140px" height="18px" />
              <Skeleton width="100px" height="14px" />
            </Stack2>
            <Skeleton width="60px" height="20px" borderRadius="9999px" />
          </CardHeaderRow>
          <Stack2 $spaceBelow>
            {Array.from({ length: lines }).map((_, j) => (
              <Skeleton key={j} width={j % 2 === 0 ? "80%" : "55%"} height="14px" />
            ))}
          </Stack2>
          <CardActions>
            <Skeleton width="70px" height="32px" borderRadius="6px" />
            <Skeleton width="70px" height="32px" borderRadius="6px" />
          </CardActions>
        </SkeletonCard>
      ))}
    </CardList>
  );
}
