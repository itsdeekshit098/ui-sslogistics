import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabaseAdmin } from "@test/supabaseMock";

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { logger } from "@/lib/logger";
import { logActivity } from "@/lib/activityLog";
import { supabaseAdmin } from "@/lib/supabase";

beforeEach(() => {
  vi.clearAllMocks();
});

/** Returns the row array passed to the most recent `.insert([...])` call on `supabaseAdmin`. */
function lastInsertArg(table: string) {
  const builder = (supabaseAdmin.from as ReturnType<typeof vi.fn>).mock.results.at(-1)!
    .value as Record<string, ReturnType<typeof vi.fn>>;
  void table;
  return builder.insert.mock.calls.at(-1)![0];
}

describe("logActivity", () => {
  it("inserts a row with the expected shape", async () => {
    const supa = mockSupabaseAdmin({
      activity_log: [{ data: null, error: null }],
    });

    await logActivity({
      action: "CREATE_DRIVER",
      userId: "user-1",
      userEmail: "admin@test.com",
      userDisplayName: "Admin",
      tableName: "drivers",
      recordId: 42,
      details: { name: "Ravi" },
    });

    expect(supa.callCount("activity_log")).toBe(1);
    const [row] = lastInsertArg("activity_log");
    expect(row).toMatchObject({
      action: "CREATE_DRIVER",
      user_id: "user-1",
      user_email: "admin@test.com",
      user_display_name: "Admin",
      table_name: "drivers",
      record_id: 42,
      details: { name: "Ravi" },
    });
  });

  it("falls back to userEmail as the display name when none is given", async () => {
    mockSupabaseAdmin({
      activity_log: [{ data: null, error: null }],
    });

    await logActivity({
      action: "CREATE_DRIVER",
      userId: "user-1",
      userEmail: "admin@test.com",
      tableName: "drivers",
      recordId: 42,
    });

    const [row] = lastInsertArg("activity_log");
    expect(row.user_display_name).toBe("admin@test.com");
  });

  it("coerces a string recordId to a number", async () => {
    mockSupabaseAdmin({
      activity_log: [{ data: null, error: null }],
    });

    await logActivity({
      action: "CREATE_DRIVER",
      userId: "user-1",
      userEmail: "admin@test.com",
      tableName: "drivers",
      recordId: "42",
    });

    const [row] = lastInsertArg("activity_log");
    expect(row.record_id).toBe(42);
  });

  it("stores a null record_id as null, not 0", async () => {
    mockSupabaseAdmin({
      activity_log: [{ data: null, error: null }],
    });

    await logActivity({
      action: "PURGE_ACTIVITY_LOG",
      userId: "user-1",
      userEmail: "admin@test.com",
      tableName: "activity_log",
      recordId: null,
    });

    const [row] = lastInsertArg("activity_log");
    expect(row.record_id).toBeNull();
  });

  it("defaults details to an empty object when not supplied", async () => {
    mockSupabaseAdmin({
      activity_log: [{ data: null, error: null }],
    });

    await logActivity({
      action: "CREATE_DRIVER",
      userId: "user-1",
      userEmail: "admin@test.com",
      tableName: "drivers",
      recordId: 1,
    });

    const [row] = lastInsertArg("activity_log");
    expect(row.details).toEqual({});
  });

  it("never throws when the underlying insert throws — logs and resolves instead", async () => {
    mockSupabaseAdmin({
      activity_log: [
        () => {
          throw new Error("connection refused");
        },
      ],
    });

    await expect(
      logActivity({
        action: "CREATE_DRIVER",
        userId: "user-1",
        userEmail: "admin@test.com",
        tableName: "drivers",
        recordId: 1,
      }),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to write activity log",
      expect.objectContaining({ action: "CREATE_DRIVER" }),
    );
  });
});
