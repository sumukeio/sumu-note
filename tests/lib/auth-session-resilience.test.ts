import { describe, it, expect, vi } from "vitest";
import {
  withRetries,
  shouldHardNavigateAfterLogin,
} from "@/lib/auth-session-resilience";

describe("auth-session-resilience (issue002)", () => {
  it("withRetries：前几次失败后成功", async () => {
    let n = 0;
    const result = await withRetries(
      async () => {
        n += 1;
        return n >= 3 ? "ok" : null;
      },
      {
        attempts: 5,
        delayMs: 1,
        shouldRetry: (v) => v == null,
      }
    );
    expect(result).toBe("ok");
    expect(n).toBe(3);
  });

  it("withRetries：全部失败返回最后一次", async () => {
    const result = await withRetries(async () => null, {
      attempts: 3,
      delayMs: 1,
      shouldRetry: (v) => v == null,
    });
    expect(result).toBeNull();
  });

  it("shouldHardNavigateAfterLogin", () => {
    expect(shouldHardNavigateAfterLogin("localStorage")).toBe(true);
    expect(shouldHardNavigateAfterLogin("memory")).toBe(false);
    expect(shouldHardNavigateAfterLogin("unknown")).toBe(false);
  });
});
