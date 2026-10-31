import { describe, expect, it } from "vitest";
import { shiftsToShow } from "@/components/attendancePage/attendancePage.utils";

describe("shiftsToShow", () => {
  it("offers only the driver's own shifts when the mark fits", () => {
    expect(shiftsToShow(2, { shifts: ["A"], status: null })).toEqual(["A", "B"]);
    expect(shiftsToShow(3, { shifts: [], status: null })).toEqual(["A", "B", "C"]);
  });

  it("keeps a stored shift the driver no longer runs, so it can be seen and cleared", () => {
    // Count cut to 1 part-way through a month that already had A + B marked.
    expect(shiftsToShow(1, { shifts: ["A", "B"], status: null })).toEqual(["A", "B"]);
    expect(shiftsToShow(2, { shifts: ["C"], status: null })).toEqual(["A", "B", "C"]);
  });
});
