import type { Session, User } from "@supabase/supabase-js";
import { supabase, handleAuthError } from "@/lib/supabase";
import { withRetries } from "@/lib/auth-session-resilience";

const AUTH_TIMEOUT_CODE = "AUTH_TIMEOUT";
const AUTH_STORAGE_KEY = "supabase.auth.token";

export type ResolveAuthResult =
  | { status: "ok"; user: User }
  | { status: "unauthenticated" }
  | { status: "error"; kind: "timeout" | "unknown"; message?: string };

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(AUTH_TIMEOUT_CODE)), ms);
    }),
  ]);
}

/**
 * 直接从 localStorage 解析 user（getSession 挂死/超时时的降级，issue002）。
 * 仅作进入 UI 的乐观依据，后台仍会 validateSession。
 */
export function readUserFromAuthStorage(
  storageKey: string = AUTH_STORAGE_KEY
): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // supabase-js v2 常见：整段 session，或嵌套 currentSession
    const sessionLike =
      (parsed?.user ? parsed : null) ||
      (parsed?.currentSession as Record<string, unknown> | undefined) ||
      (parsed?.session as Record<string, unknown> | undefined) ||
      parsed;
    const user = sessionLike?.user as User | undefined;
    if (user && typeof user.id === "string") return user;
    return null;
  } catch {
    return null;
  }
}

async function getSessionBounded(timeoutMs: number): Promise<{
  session: Session | null;
  sessionError: Error | null;
  timedOut: boolean;
}> {
  try {
    const { data, error } = await withTimeout(
      supabase.auth.getSession(),
      timeoutMs
    );
    return {
      session: data.session,
      sessionError: error,
      timedOut: false,
    };
  } catch (e) {
    if (e instanceof Error && e.message === AUTH_TIMEOUT_CODE) {
      return { session: null, sessionError: null, timedOut: true };
    }
    return {
      session: null,
      sessionError: e instanceof Error ? e : new Error(String(e)),
      timedOut: false,
    };
  }
}

/** 后台向服务端校验 session，失效时由 handleAuthError 清理 */
function validateSessionInBackground(): void {
  void supabase.auth.getUser().then(async ({ error }) => {
    await handleAuthError(error);
  });
}

/**
 * 优先读本地 session（快），无 session 时再带超时调用 getUser。
 * iOS：getSession 可能挂死 → 单次超时 + 短重试 + storage 降级（issue002）。
 */
export async function resolveAuthUser(options?: {
  timeoutMs?: number;
  sessionAttemptTimeoutMs?: number;
}): Promise<ResolveAuthResult> {
  const timeoutMs = options?.timeoutMs ?? 8_000;
  const sessionAttemptTimeoutMs = options?.sessionAttemptTimeoutMs ?? 2_500;

  const sessionResult = await withRetries(
    async () => getSessionBounded(sessionAttemptTimeoutMs),
    {
      attempts: 3,
      delayMs: 150,
      shouldRetry: ({ session, sessionError, timedOut }) =>
        !session?.user && !sessionError && timedOut,
    }
  );

  // 若因超时一直空，尝试 storage 降级
  if (!sessionResult.session?.user && sessionResult.timedOut) {
    const cached = readUserFromAuthStorage();
    if (cached) {
      validateSessionInBackground();
      return { status: "ok", user: cached };
    }
  }

  if (
    sessionResult.sessionError &&
    "message" in sessionResult.sessionError &&
    (await handleAuthError(sessionResult.sessionError as never))
  ) {
    return { status: "unauthenticated" };
  }

  if (sessionResult.session?.user) {
    validateSessionInBackground();
    return { status: "ok", user: sessionResult.session.user };
  }

  // 再试一次非超时路径的空结果：storage 降级
  const cachedUser = readUserFromAuthStorage();
  if (cachedUser) {
    validateSessionInBackground();
    return { status: "ok", user: cachedUser };
  }

  try {
    const {
      data: { user },
      error,
    } = await withTimeout(supabase.auth.getUser(), timeoutMs);

    if (error && (await handleAuthError(error))) {
      return { status: "unauthenticated" };
    }

    if (error) {
      return { status: "error", kind: "unknown", message: error.message };
    }

    if (!user) {
      return { status: "unauthenticated" };
    }

    return { status: "ok", user };
  } catch (e) {
    if (e instanceof Error && e.message === AUTH_TIMEOUT_CODE) {
      const again = readUserFromAuthStorage();
      if (again) {
        validateSessionInBackground();
        return { status: "ok", user: again };
      }
      return { status: "error", kind: "timeout" };
    }
    return {
      status: "error",
      kind: "unknown",
      message: e instanceof Error ? e.message : undefined,
    };
  }
}

/**
 * 密码登录后等待 session 写入本地存储（老设备 Safari 上可能略慢）。
 */
export async function ensureSessionAfterSignIn(
  maxWaitMs = 5000
): Promise<Session | null> {
  try {
    const { data } = await withTimeout(supabase.auth.getSession(), 2000);
    if (data.session) return data.session;
  } catch {
    // 继续轮询 / 事件
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (session: Session | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription.unsubscribe();
      resolve(session);
    };

    const timer = setTimeout(() => finish(null), maxWaitMs);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session);
    });

    const poll = async () => {
      for (let i = 0; i < 20 && !settled; i++) {
        await new Promise((r) => setTimeout(r, 100));
        try {
          const { data: next } = await withTimeout(
            supabase.auth.getSession(),
            1500
          );
          if (next.session) {
            finish(next.session);
            return;
          }
        } catch {
          // ignore attempt timeout
        }
      }
    };
    void poll();
  });
}
