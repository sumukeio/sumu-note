/**
 * 登录 → dashboard 交接（issue002）
 * iOS 上软跳后 getSession 可能仍为空，用 sessionStorage 短时交接避免被踢回首页。
 */

const HANDOFF_KEY = "sumu:auth-handoff";
const DEBUG_KEY = "sumu:auth-debug";
const HANDOFF_TTL_MS = 30_000;

export type AuthHandoffPayload = {
  at: number;
  userId: string;
  email?: string | null;
};

export function markAuthHandoff(user: {
  id: string;
  email?: string | null;
}): void {
  if (typeof window === "undefined") return;
  const payload: AuthHandoffPayload = {
    at: Date.now(),
    userId: user.id,
    email: user.email ?? null,
  };
  try {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
  pushAuthDebug("handoff:marked", payload);
}

export function peekAuthHandoff(): AuthHandoffPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthHandoffPayload;
    if (!parsed?.userId || !parsed?.at) return null;
    if (Date.now() - parsed.at > HANDOFF_TTL_MS) {
      window.sessionStorage.removeItem(HANDOFF_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearAuthHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    // ignore
  }
}

export function pushAuthDebug(step: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  try {
    const prev = window.sessionStorage.getItem(DEBUG_KEY);
    const list: { t: number; step: string; detail?: unknown }[] = prev
      ? JSON.parse(prev)
      : [];
    list.push({ t: Date.now(), step, detail });
    // 只保留最近 30 条
    const trimmed = list.slice(-30);
    window.sessionStorage.setItem(DEBUG_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
  if (typeof console !== "undefined") {
    console.info("[sumu-auth]", step, detail ?? "");
  }
}

export function readAuthDebugLog(): { t: number; step: string; detail?: unknown }[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(DEBUG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as { t: number; step: string; detail?: unknown }[];
  } catch {
    return [];
  }
}

export function isAuthDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem("sumu:debugAuth") === "1") return true;
    return new URLSearchParams(window.location.search).get("debugAuth") === "1";
  } catch {
    return false;
  }
}
