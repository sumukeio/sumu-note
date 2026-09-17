import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  withRetries,
  shouldHardNavigateAfterLogin,
} from "@/lib/auth-session-resilience";
import { readUserFromAuthStorage } from "@/lib/auth-utils";

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

describe("readUserFromAuthStorage (issue002)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("无数据 → null", () => {
    expect(readUserFromAuthStorage()).toBeNull();
  });

  it("解析 session.user", () => {
    window.localStorage.setItem(
      "supabase.auth.token",
      JSON.stringify({
        access_token: "x",
        user: { id: "u1", email: "a@b.c" },
      })
    );
    expect(readUserFromAuthStorage()?.id).toBe("u1");
  });

  it("损坏 JSON → null", () => {
    window.localStorage.setItem("supabase.auth.token", "{");
    expect(readUserFromAuthStorage()).toBeNull();
  });
});
