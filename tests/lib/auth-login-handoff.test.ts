import { describe, it, expect, beforeEach } from "vitest";
import {
  markAuthHandoff,
  peekAuthHandoff,
  clearAuthHandoff,
} from "@/lib/auth-login-handoff";

describe("auth-login-handoff (issue002)", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("标记后可读，清除后为空", () => {
    expect(peekAuthHandoff()).toBeNull();
    markAuthHandoff({ id: "u-1", email: "a@b.c" });
    expect(peekAuthHandoff()?.userId).toBe("u-1");
    clearAuthHandoff();
    expect(peekAuthHandoff()).toBeNull();
  });
});
