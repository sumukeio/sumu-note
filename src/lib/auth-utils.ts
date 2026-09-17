import type { Session, User } from "@supabase/supabase-js";
import { supabase, handleAuthError } from "@/lib/supabase";
import { withRetries } from "@/lib/auth-session-resilience";

const AUTH_TIMEOUT_CODE = "AUTH_TIMEOUT";

export type ResolveAuthResult =
  | { status: "ok"; user: User }
  | { status: "unauthenticated" }
  | { status: "error"; kind: "timeout" | "unknown"; message?: string };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(AUTH_TIMEOUT_CODE)), ms);
    }),
  ]);
}

/** 后台向服务端校验 session，失效时由 handleAuthError 清理 */
function validateSessionInBackground(): void {
  void supabase.auth.getUser().then(async ({ error }) => {
    await handleAuthError(error);
  });
}

/**
 * 优先读本地 session（快），无 session 时再带超时调用 getUser。
 * iOS 上登录后立刻读 session 偶发为空，故对 getSession 做短重试（issue002）。
 */
export async function resolveAuthUser(options?: {
  timeoutMs?: number;
}): Promise<ResolveAuthResult> {
  const timeoutMs = options?.timeoutMs ?? 12_000;

  const sessionResult = await withRetries(
    async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      return { session, sessionError };
    },
    {
      attempts: 6,
      delayMs: 120,
      shouldRetry: ({ session, sessionError }) =>
        !session?.user && !sessionError,
    }
  );

  if (
    sessionResult.sessionError &&
    (await handleAuthError(sessionResult.sessionError))
  ) {
    return { status: "unauthenticated" };
  }

  if (sessionResult.session?.user) {
    validateSessionInBackground();
    return { status: "ok", user: sessionResult.session.user };
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
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

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
        const { data: next } = await supabase.auth.getSession();
        if (next.session) {
          finish(next.session);
          return;
        }
      }
    };
    void poll();
  });
}
