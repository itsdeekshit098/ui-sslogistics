import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import { apiSuccess, apiError, serverError, handleApiError } from "@/lib/apiResponse";

async function json(res: Response) {
  return res.json();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("apiSuccess", () => {
  it("wraps data in the shared success envelope", async () => {
    const res = apiSuccess({ id: 1 });
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({
      success: true,
      data: { id: 1 },
      message: "Success",
    });
  });

  it("accepts a custom message and status", async () => {
    const res = apiSuccess({ ok: true }, "Created", 201);
    expect(res.status).toBe(201);
    expect((await json(res)).message).toBe("Created");
  });
});

describe("apiError", () => {
  it("wraps an error in the shared failure envelope, defaulting to 500", async () => {
    const res = apiError("Something broke");
    expect(res.status).toBe(500);
    expect(await json(res)).toEqual({ success: false, error: "Something broke" });
  });

  it("includes the machine-readable code only when given one", async () => {
    const withCode = await json(apiError("Unauthorized", 401, "SESSION_INVALID"));
    expect(withCode).toEqual({
      success: false,
      error: "Unauthorized",
      code: "SESSION_INVALID",
    });

    const withoutCode = await json(apiError("Bad request", 400));
    expect(withoutCode).not.toHaveProperty("code");
  });
});

describe("handleApiError", () => {
  it("maps UNAUTHORIZED-prefixed errors to 401 with SESSION_INVALID", async () => {
    const res = handleApiError(new Error("UNAUTHORIZED: Missing authentication instance"));
    expect(res.status).toBe(401);
    expect(await json(res)).toEqual({
      success: false,
      error: "Unauthorized",
      code: "SESSION_INVALID",
    });
  });

  it("maps FORBIDDEN-prefixed errors to 403", async () => {
    const res = handleApiError(new Error("FORBIDDEN: Insufficient role privileges"));
    expect(res.status).toBe(403);
    expect(await json(res)).toEqual({ success: false, error: "Forbidden" });
  });

  it("maps MAINTENANCE-prefixed errors to 503 with MAINTENANCE_MODE", async () => {
    const res = handleApiError(new Error("MAINTENANCE: system is down"));
    expect(res.status).toBe(503);
    expect(await json(res)).toEqual({
      success: false,
      error: "Under maintenance",
      code: "MAINTENANCE_MODE",
    });
  });

  it("never leaks the underlying message for an unrecognized error", async () => {
    const res = handleApiError(new Error("db connection string leaked: postgres://..."));
    expect(res.status).toBe(500);
    const body = await json(res);
    expect(body.error).toBe("Internal Server Error");
    expect(JSON.stringify(body)).not.toContain("postgres://");
  });

  it("reports unrecognized errors to Sentry but not the three expected auth/maintenance cases", () => {
    handleApiError(new Error("UNAUTHORIZED: x"));
    handleApiError(new Error("FORBIDDEN: x"));
    handleApiError(new Error("MAINTENANCE: x"));
    expect(Sentry.captureException).not.toHaveBeenCalled();

    handleApiError(new Error("boom"));
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("handles non-Error throws (e.g. a plain string) without crashing", async () => {
    const res = handleApiError("some string throw");
    expect(res.status).toBe(500);
    expect(Sentry.captureException).toHaveBeenCalledWith("some string throw");
  });
});

describe("serverError", () => {
  it("logs, reports to Sentry, and returns a generic 500 by default", async () => {
    const res = serverError({ message: "duplicate key", code: "23505" });
    expect(res.status).toBe(500);
    expect(await json(res)).toEqual({
      success: false,
      error: "Internal server error",
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("accepts a Supabase-shaped plain object error, not just an Error instance", () => {
    serverError({ message: "column does not exist", code: "42703", hint: "check spelling" });
    const loggedDetail = vi.mocked(logger.error).mock.calls[0][1] as Record<string, unknown>;
    expect(loggedDetail.error).toBe("column does not exist");
    expect(loggedDetail.code).toBe("42703");
    expect(loggedDetail.hint).toBe("check spelling");
  });

  it("supports a custom client-facing message distinct from the logged detail", async () => {
    const res = serverError(new Error("internal detail"), {}, "Could not save loan");
    expect(await json(res)).toEqual({
      success: false,
      error: "Could not save loan",
    });
  });
});
