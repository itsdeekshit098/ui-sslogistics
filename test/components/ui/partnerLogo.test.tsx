// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PartnerLogo } from "@/components/ui/partnerLogo/partnerLogo";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (props: any) => <img alt={props.alt} src={props.src} />,
}));

afterEach(cleanup);

describe("PartnerLogo", () => {
  it("renders the registered image for a known partner", () => {
    render(<PartnerLogo name="ACT" />);
    expect(screen.getByAltText("ACT Plast Paints Logo")).toBeInTheDocument();
  });

  it("falls back to rendering the raw name for an unknown partner", () => {
    render(<PartnerLogo name="UNKNOWN PARTNER" />);
    expect(screen.getByText("UNKNOWN PARTNER")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
