import { describe, it, expect } from "vitest";
import { applyLoanField } from "@/components/loanModal/loanModal.utils";

const empty = { startDate: "", firstEmiDate: "", emiDayOfMonth: null as number | null };

describe("applyLoanField", () => {
  it("prefills the first EMI a month on and the EMI day from the start date", () => {
    expect(applyLoanField(empty, "startDate", "2026-01-15")).toEqual({
      startDate: "2026-01-15",
      firstEmiDate: "2026-02-15",
      emiDayOfMonth: 15,
    });
  });

  it("never runs past the end of the next month (31 Jan → 28 Feb, 30 Jan leap → 29 Feb)", () => {
    expect(applyLoanField(empty, "startDate", "2026-01-31").firstEmiDate).toBe("2026-02-28");
    expect(applyLoanField(empty, "startDate", "2028-01-31").firstEmiDate).toBe("2028-02-29");
    expect(applyLoanField(empty, "startDate", "2026-03-31").firstEmiDate).toBe("2026-04-30");
    expect(applyLoanField(empty, "startDate", "2026-12-31").firstEmiDate).toBe("2027-01-31");
  });

  it("leaves a first EMI date or EMI day the person already chose alone", () => {
    const chosen = { startDate: "", firstEmiDate: "2026-03-05", emiDayOfMonth: 5 };
    expect(applyLoanField(chosen, "startDate", "2026-01-31")).toEqual({
      startDate: "2026-01-31",
      firstEmiDate: "2026-03-05",
      emiDayOfMonth: 5,
    });
  });

  it("takes the EMI day from the first EMI date when only that is set", () => {
    expect(applyLoanField(empty, "firstEmiDate", "2026-02-09").emiDayOfMonth).toBe(9);
  });
});
