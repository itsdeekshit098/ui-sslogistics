// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { SalaryDriverModal } from "@/components/salariesPage/salaryDriverModal";
import type { SalaryDriverDetail } from "@/components/salariesPage/salariesPage.types";

function detailFixture(overrides: Partial<SalaryDriverDetail> = {}): SalaryDriverDetail {
  return {
    month: "2026-06",
    days_in_month: 30,
    is_provisional: false,
    row: {
      driver_id: 1,
      name: "Ravi Kumar",
      place: "Chennai",
      is_active: true,
      pay_type: "MONTHLY",
      monthly_salary: 30000,
      rate_per_trip: null,
      trip_count: null,
      days_present: 28,
      absent_days: 2,
      leave_days: 0,
      holiday_days: 0,
      unmarked_days: 0,
      unpaid_days: 2,
      attendance_cut: 2000,
      advances: 0,
      deductions: 0,
      net_pay: 28000,
      carry_forward_in: 0,
      is_settled: false,
    },
    rates: [{ id: 1, driver_id: 1, monthly_salary: 30000, effective_from: "2026-01-01", note: null, created_at: "2026-01-01" }],
    payTypes: [],
    tripCount: null,
    entries: [],
    settlement: null,
    ...overrides,
  };
}

function mockDetailFetch(detail: SalaryDriverDetail) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: detail }),
  });
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SalaryDriverModal", () => {
  it("renders nothing when driverId is null", () => {
    render(
      <SalaryDriverModal driverId={null} month="2026-06" onClose={vi.fn()} onChanged={vi.fn()} />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("loads the driver's detail and shows the computed net pay", async () => {
    vi.stubGlobal("fetch", mockDetailFetch(detailFixture()));
    render(
      <SalaryDriverModal driverId={1} month="2026-06" onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByText("Net pay")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark paid/i })).toBeEnabled();
  });

  it("disables Mark paid and explains why when no salary is set", async () => {
    vi.stubGlobal(
      "fetch",
      mockDetailFetch(
        detailFixture({
          row: { ...detailFixture().row, monthly_salary: null, net_pay: null },
        }),
      ),
    );
    render(
      <SalaryDriverModal driverId={1} month="2026-06" onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    await screen.findByText("Salary not set");
    expect(screen.getByRole("button", { name: /mark paid/i })).toBeDisabled();
    expect(screen.getByText(/set a salary before settling/i)).toBeInTheDocument();
  });

  it("settling with the exact computed amount records it with no carry-forward preview", async () => {
    const detail = detailFixture();
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.toString().endsWith("/settle")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: detail }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onChanged = vi.fn();

    render(
      <SalaryDriverModal driverId={1} month="2026-06" onClose={vi.fn()} onChanged={onChanged} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /mark paid/i }));
    expect(screen.getByLabelText(/amount actually paid/i)).toHaveValue(28000);
    // Exact amount: no carry-forward preview text.
    expect(screen.queryByText(/carry forward/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /confirm paid/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const settleCall = fetchMock.mock.calls.find((c) => c[0].toString().endsWith("/settle"));
    expect(settleCall).toBeDefined();
    const body = JSON.parse(settleCall![1]!.body as string);
    expect(body).toMatchObject({ period_month: "2026-06", amount_paid: 28000, note: null });
  });

  it("shows the overpaid carry-forward preview when the amount is more than net pay", async () => {
    vi.stubGlobal("fetch", mockDetailFetch(detailFixture()));
    render(
      <SalaryDriverModal driverId={1} month="2026-06" onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /mark paid/i }));
    fireEvent.change(screen.getByLabelText(/amount actually paid/i), {
      target: { value: "29000" },
    });

    expect(
      await screen.findByText(/paying .*1,000.* more than owed/i),
    ).toBeInTheDocument();
  });

  it("rejects an empty or negative settle amount without calling the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: detailFixture() }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SalaryDriverModal driverId={1} month="2026-06" onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /mark paid/i }));
    fireEvent.change(screen.getByLabelText(/amount actually paid/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm paid/i }));

    expect(await screen.findByText(/enter the amount actually paid/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((c) => c[0].toString().endsWith("/settle"))).toBe(false);
  });

  it("shows a settled receipt with Undo, and undoing calls the DELETE route", async () => {
    const settled = detailFixture({
      row: { ...detailFixture().row, is_settled: true },
      settlement: {
        id: 7,
        period_month: "2026-06-01",
        net_pay_computed: 28000,
        amount_paid: 28000,
        note: null,
        carry_forward: 0,
        carry_forward_entry_id: null,
        created_at: "2026-07-01T00:00:00Z",
      },
    });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: settled }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onChanged = vi.fn();

    render(
      <SalaryDriverModal driverId={1} month="2026-06" onClose={vi.fn()} onChanged={onChanged} />,
    );

    expect(await screen.findByText(/✓ Paid/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /undo settlement/i }));
    fireEvent.click(screen.getByRole("button", { name: /^undo$/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const deleteCall = fetchMock.mock.calls.find((c) => c[1]?.method === "DELETE");
    expect(deleteCall?.[0]).toBe("/api/driver-salaries/1/settle/7");
  });

  it("shows the carry-forward explanation on a settlement that under/overpaid", async () => {
    const settled = detailFixture({
      row: { ...detailFixture().row, is_settled: true },
      settlement: {
        id: 7,
        period_month: "2026-06-01",
        net_pay_computed: 28000,
        amount_paid: 26000,
        note: null,
        carry_forward: -2000,
        carry_forward_entry_id: 99,
        created_at: "2026-07-01T00:00:00Z",
      },
    });
    vi.stubGlobal("fetch", mockDetailFetch(settled));

    render(
      <SalaryDriverModal driverId={1} month="2026-06" onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    expect(await screen.findByText(/paid .*2,000.* short/i)).toBeInTheDocument();
    expect(screen.getByText(/carried forward to/i)).toBeInTheDocument();
  });

  it("adds an advance via the Add advance form", async () => {
    const detail = detailFixture();
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.toString().endsWith("/entries")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: detail }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onChanged = vi.fn();

    render(
      <SalaryDriverModal driverId={1} month="2026-06" onClose={vi.fn()} onChanged={onChanged} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /add advance/i }));
    fireEvent.change(screen.getByLabelText(/^amount/i), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /record advance/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const entryCall = fetchMock.mock.calls.find((c) => c[0].toString().endsWith("/entries"));
    expect(entryCall).toBeDefined();
    const body = JSON.parse(entryCall![1]!.body as string);
    expect(body).toMatchObject({ entry_type: "ADVANCE", amount: 500, period_month: "2026-06" });
  });

  it("rejects a zero-amount entry without calling the API", async () => {
    vi.stubGlobal("fetch", mockDetailFetch(detailFixture()));
    render(
      <SalaryDriverModal driverId={1} month="2026-06" onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /add deduction/i }));
    fireEvent.click(screen.getByRole("button", { name: /record deduction/i }));

    expect(await screen.findByText(/enter an amount greater than zero/i)).toBeInTheDocument();
  });

  it("does not show a Reverse button on a carry-forward entry", async () => {
    const detail = detailFixture({
      entries: [
        {
          id: 1,
          driver_id: 1,
          entry_type: "ADVANCE",
          amount: 2000,
          entry_date: "2026-06-01",
          period_month: "2026-06-01",
          description: "Carried forward: overpaid for 2026-05",
          reverses_entry_id: null,
          created_at: "2026-06-01T00:00:00Z",
          is_reversed: false,
          is_reversal: false,
          is_carry_forward: true,
        },
      ],
    });
    vi.stubGlobal("fetch", mockDetailFetch(detail));

    render(
      <SalaryDriverModal driverId={1} month="2026-06" onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    expect(await screen.findByText("Carried in")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^reverse$/i })).toBeNull();
  });

  it("shows a Reverse button on an ordinary entry and reverses it", async () => {
    const detail = detailFixture({
      entries: [
        {
          id: 2,
          driver_id: 1,
          entry_type: "DEDUCTION",
          amount: 300,
          entry_date: "2026-06-05",
          period_month: "2026-06-01",
          description: "Tyre damage",
          reverses_entry_id: null,
          created_at: "2026-06-05T00:00:00Z",
          is_reversed: false,
          is_reversal: false,
          is_carry_forward: false,
        },
      ],
    });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.toString().includes("/reverse")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: detail }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onChanged = vi.fn();

    render(
      <SalaryDriverModal driverId={1} month="2026-06" onClose={vi.fn()} onChanged={onChanged} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /^reverse$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^reverse$/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const reverseCall = fetchMock.mock.calls.find((c) => c[0].toString().includes("/reverse"));
    expect(reverseCall?.[0]).toBe("/api/driver-salaries/1/entries/2/reverse");
  });

  it("shows a PER_TRIP driver's rate and trip count instead of a monthly salary", async () => {
    const perTripDetail = detailFixture({
      row: {
        ...detailFixture().row,
        pay_type: "PER_TRIP",
        monthly_salary: null,
        rate_per_trip: 500,
        trip_count: 40,
        unpaid_days: 0,
        attendance_cut: 0,
        net_pay: 20000,
      },
      rates: [],
      payTypes: [
        {
          id: 1,
          driver_id: 1,
          pay_type: "PER_TRIP",
          rate_per_trip: 500,
          effective_from: "2026-01-01",
          note: null,
          created_at: "2026-01-01",
        },
      ],
      tripCount: {
        id: 1,
        driver_id: 1,
        period_month: "2026-06-01",
        trip_count: 40,
        note: null,
        created_at: "2026-06-01",
      },
    });
    vi.stubGlobal("fetch", mockDetailFetch(perTripDetail));

    render(
      <SalaryDriverModal driverId={1} month="2026-06" onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    expect(await screen.findByText("Per trip")).toBeInTheDocument();
    // Split across two spans ("40" and "trips entered"), so match the
    // container's full text instead of one literal string.
    expect(
      screen.getByText((_, el) => el?.textContent === "40 trips entered"),
    ).toBeInTheDocument();
    expect(screen.getByText(/₹20,000/)).toBeInTheDocument();
  });

  it("switching a MONTHLY driver to PER_TRIP sends the pay-type change before the net pay reloads", async () => {
    const detail = detailFixture();
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.toString().endsWith("/pay-type")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: detail }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onChanged = vi.fn();

    render(
      <SalaryDriverModal driverId={1} month="2026-06" onClose={vi.fn()} onChanged={onChanged} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("radio", { name: "Per trip" }));
    fireEvent.change(screen.getByLabelText(/rate.*per trip/i), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const payTypeCall = fetchMock.mock.calls.find((c) => c[0].toString().endsWith("/pay-type"));
    expect(payTypeCall).toBeDefined();
    const body = JSON.parse(payTypeCall![1]!.body as string);
    expect(body).toMatchObject({ pay_type: "PER_TRIP", rate_per_trip: 500, effective_month: "2026-06" });
    // A pay-type switch never also writes a monthly rate.
    expect(fetchMock.mock.calls.some((c) => c[0].toString().endsWith("/rates"))).toBe(false);
  });

  it("entering trips for a PER_TRIP driver posts to the trip-count route", async () => {
    const perTripDetail = detailFixture({
      row: {
        ...detailFixture().row,
        pay_type: "PER_TRIP",
        monthly_salary: null,
        rate_per_trip: 500,
        trip_count: null,
        unpaid_days: 0,
        attendance_cut: 0,
        net_pay: null,
      },
      rates: [],
    });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.toString().endsWith("/trip-count")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: perTripDetail }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onChanged = vi.fn();

    render(
      <SalaryDriverModal driverId={1} month="2026-06" onClose={vi.fn()} onChanged={onChanged} />,
    );

    // With nothing entered yet, the trip-count form opens directly — same
    // convention as a first-time salary/rate entry.
    fireEvent.change(await screen.findByLabelText(/trips this month/i), {
      target: { value: "40" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save trips/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const tripCall = fetchMock.mock.calls.find((c) => c[0].toString().endsWith("/trip-count"));
    expect(tripCall).toBeDefined();
    const body = JSON.parse(tripCall![1]!.body as string);
    expect(body).toMatchObject({ period_month: "2026-06", trip_count: 40 });
  });

  it("rejects a non-whole trip count without calling the API", async () => {
    const perTripDetail = detailFixture({
      row: {
        ...detailFixture().row,
        pay_type: "PER_TRIP",
        monthly_salary: null,
        rate_per_trip: 500,
        trip_count: 40,
        unpaid_days: 0,
        attendance_cut: 0,
        net_pay: 20000,
      },
      rates: [],
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: perTripDetail }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SalaryDriverModal driverId={1} month="2026-06" onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Change" }));
    fireEvent.change(screen.getByLabelText(/trips this month/i), { target: { value: "3.5" } });
    fireEvent.click(screen.getByRole("button", { name: /save trips/i }));

    expect(await screen.findByText(/whole number of trips/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((c) => c[0].toString().endsWith("/trip-count"))).toBe(false);
  });
});