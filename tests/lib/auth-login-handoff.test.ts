import { describe, it, expect, beforeEach } from "vitest";
import {
  markAuthHandoff,
  peekAuthHandoff,
  clearAuthHandoff,
  isAuthDebugEnabled,
  dashboardUrlWithDebug,
  pushAuthDebug,
  readAuthDebugLog,
} from "@/lib/auth-login-handoff";

describe("auth-login-handoff (issue002)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("标记后可读，清除后为空（session + local 双写）", () => {
    expect(peekAuthHandoff()).toBeNull();
    markAuthHandoff({ id: "u-1", email: "a@b.c" });
    expect(peekAuthHandoff()?.userId).toBe("u-1");
    expect(localStorage.getItem("sumu:auth-handoff")).toBeTruthy();
    clearAuthHandoff();
    expect(peekAuthHandoff()).toBeNull();
  });

  it("仅 localStorage 残留时仍可读", () => {
    localStorage.setItem(
      "sumu:auth-handoff",
      JSON.stringify({ at: Date.now(), userId: "u-2", email: null })
    );
    expect(peekAuthHandoff()?.userId).toBe("u-2");
  });

  it("debugAuth=1 持久化；dashboardUrl 带参", () => {
    window.history.replaceState({}, "", "/?debugAuth=1");
    expect(isAuthDebugEnabled()).toBe(true);
    expect(localStorage.getItem("sumu:debugAuth")).toBe("1");
    window.history.replaceState({}, "", "/");
    expect(isAuthDebugEnabled()).toBe(true);
    expect(dashboardUrlWithDebug()).toBe("/dashboard?debugAuth=1");
  });

  it("调试日志写入 localStorage", () => {
    pushAuthDebug("t1", { a: 1 });
    expect(readAuthDebugLog().some((e) => e.step === "t1")).toBe(true);
  });
});
