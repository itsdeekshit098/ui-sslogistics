import { describe, it, expect, vi, afterEach } from "vitest";
import { logger } from "@/lib/logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes info messages to stdout as structured JSON", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    logger.info("something happened", { foo: "bar" });

    expect(stdout).toHaveBeenCalledTimes(1);
    const written = JSON.parse((stdout.mock.calls[0][0] as string).trim());
    expect(written).toMatchObject({
      level: "info",
      message: "something happened",
      context: { foo: "bar" },
    });
    expect(written.timestamp).toBeTruthy();
  });

  it("writes warn messages to stdout, not stderr", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    logger.warn("careful");

    expect(stdout).toHaveBeenCalledTimes(1);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("writes error messages to stderr, not stdout", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    logger.error("db down");

    expect(stderr).toHaveBeenCalledTimes(1);
    expect(stdout).not.toHaveBeenCalled();
  });

  it("omits the context key entirely when none is supplied", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    logger.info("no context here");

    const written = JSON.parse((stdout.mock.calls[0][0] as string).trim());
    expect(written).not.toHaveProperty("context");
  });
});
