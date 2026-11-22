"use client";

import {
  AdminPage,
  AdminStatGrid,
  LoginCard,
  LoginField,
  LoginForm,
  LoginHeading,
  LoginPage,
} from "./pageSkeleton.styles";
import { Skeleton } from "../../components/skeleton";
import { radius } from "../../tokens/tokens";
import type { PageSkeletonProps } from "./pageSkeleton.types";

// The placeholders use the theme's --skeleton fill (a translucent white in dark
// mode), not --muted: they render on top of muted and card surfaces that are
// nearly the same tone as --muted in dark mode, so a --muted fill would be
// invisible there.

function AdminSkeleton() {
  return (
    <AdminPage>
      <Skeleton block width="12rem" height="2.25rem" borderRadius={radius.base} />
      <AdminStatGrid>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton block width="auto" height="7rem" borderRadius={radius.base} key={i} />
        ))}
      </AdminStatGrid>
      <Skeleton block width="100%" height="16rem" borderRadius={radius.base} />
    </AdminPage>
  );
}

function LoginSkeleton() {
  return (
    <LoginPage>
      <LoginCard>
        <LoginHeading>
          {/* Logo placeholder */}
          <Skeleton block width="10rem" height="2.25rem" borderRadius={radius.base} center />
          <Skeleton block width="7rem" height="1rem" borderRadius={radius.base} center />
        </LoginHeading>
        {/* Form placeholder */}
        <LoginForm>
          <LoginField>
            <Skeleton block width="6rem" height="1rem" borderRadius="0.25rem" />
            <Skeleton block width="100%" height="2.5rem" borderRadius={radius.base} />
          </LoginField>
          <LoginField>
            <Skeleton block width="5rem" height="1rem" borderRadius="0.25rem" />
            <Skeleton block width="100%" height="2.5rem" borderRadius={radius.base} />
          </LoginField>
          <Skeleton block width="100%" height="2.75rem" borderRadius={radius.base} />
        </LoginForm>
      </LoginCard>
    </LoginPage>
  );
}

const skeletonMap = {
  admin: AdminSkeleton,
  login: LoginSkeleton,
} as const;

export function PageSkeleton({ variant }: PageSkeletonProps) {
  const Variant = skeletonMap[variant];
  return <Variant />;
}
