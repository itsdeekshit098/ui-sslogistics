// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { FloatingActionButton } from "@ui/components/floatingActionButton";
import { RouteAccent } from "@/components/layout/routeAccent";
import { matchNavItem } from "@/components/layout/navConfig";
import { styleOf } from "@test/uiStyles";

const pathname = vi.hoisted(() => ({ value: "/admin/loans" as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

afterEach(cleanup);

describe("RouteAccent", () => {
  it("gives the floating button the accent of the module the page belongs to", async () => {
    pathname.value = "/admin/diesel-records";
    const accent = matchNavItem(pathname.value)?.item.accent;
    expect(accent).toBeTruthy();

    render(
      <RouteAccent>
        <FloatingActionButton label="Add" onClick={vi.fn()} />
      </RouteAccent>,
    );
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    expect(styleOf(screen.getByRole("button")).background).toBe(accent);
  });

  it("leaves the default colour when the path matches no module", async () => {
    pathname.value = "/somewhere/else";
    render(
      <RouteAccent>
        <FloatingActionButton label="Add" onClick={vi.fn()} />
      </RouteAccent>,
    );
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    expect(styleOf(screen.getByRole("button")).background).toBeUndefined();
  });
});
