/**
 * 登录 → dashboard 交接（issue002）
 * iOS 上 getSession 可能挂死/空；用短时 handoff + 硬跳转优先放行。
 * 调试日志写入 localStorage，避免软跳/硬跳后「看不见绿条」。
 */

const HANDOFF_KEY = "sumu:auth-handoff";
const DEBUG_KEY = "sumu:auth-debug";
const DEBUG_FLAG_KEY = "sumu:debugAuth";
const HANDOFF_TTL_MS = 60_000;

export type AuthHandoffPayload = {
  at: number;
  userId: string;
  email?: string | null;
};

function writeJson(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

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
  // session + local 双写：部分 WebView 硬跳后 sessionStorage 偶发不可用
  writeJson(window.sessionStorage, HANDOFF_KEY, payload);
  writeJson(window.localStorage, HANDOFF_KEY, payload);
  pushAuthDebug("handoff:marked", payload);
}

export function peekAuthHandoff(): AuthHandoffPayload | null {
  if (typeof window === "undefined") return null;
  const fromSession = readJson<AuthHandoffPayload>(
    window.sessionStorage,
    HANDOFF_KEY
  );
  const fromLocal = readJson<AuthHandoffPayload>(
    window.localStorage,
    HANDOFF_KEY
  );
  const parsed = fromSession ?? fromLocal;
  if (!parsed?.userId || !parsed?.at) return null;
  if (Date.now() - parsed.at > HANDOFF_TTL_MS) {
    clearAuthHandoff();
    return null;
  }
  return parsed;
}

export function clearAuthHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    // ignore
  }
  try {
    window.localStorage.removeItem(HANDOFF_KEY);
  } catch {
    // ignore
  }
}

export function pushAuthDebug(step: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  const entry = { t: Date.now(), step, detail };
  try {
    const prev = window.localStorage.getItem(DEBUG_KEY);
    const list: { t: number; step: string; detail?: unknown }[] = prev
      ? JSON.parse(prev)
      : [];
    list.push(entry);
    window.localStorage.setItem(DEBUG_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    // ignore
  }
  if (typeof console !== "undefined") {
    console.info("[sumu-auth]", step, detail ?? "");
  }
}

export function readAuthDebugLog(): {
  t: number;
  step: string;
  detail?: unknown;
}[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DEBUG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as { t: number; step: string; detail?: unknown }[];
  } catch {
    return [];
  }
}

/** URL ?debugAuth=1 会写入 localStorage，之后各页都能开调试条 */
export function isAuthDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("debugAuth");
    if (q === "1") {
      window.localStorage.setItem(DEBUG_FLAG_KEY, "1");
      return true;
    }
    if (q === "0") {
      window.localStorage.removeItem(DEBUG_FLAG_KEY);
      return false;
    }
    return window.localStorage.getItem(DEBUG_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function dashboardUrlWithDebug(): string {
  // 故意不带 ?debugAuth=1：避免 iOS 上 useSearchParams/Suspense 卡死；
  // 调试开关已写入 localStorage，绿条仍会显示。
  return "/dashboard";
}
