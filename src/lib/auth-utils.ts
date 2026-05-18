import type { Session, User } from "@supabase/supabase-js";
import { supabase, handleAuthError } from "@/lib/supabase";

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
 */
export async function resolveAuthUser(options?: {
  timeoutMs?: number;
}): Promise<ResolveAuthResult> {
  const timeoutMs = options?.timeoutMs ?? 12_000;

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError && (await handleAuthError(sessionError))) {
    return { status: "unauthenticated" };
  }

  if (session?.user) {
    validateSessionInBackground();
    return { status: "ok", user: session.user };
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
  maxWaitMs = 3000
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
      for (let i = 0; i < 10 && !settled; i++) {
        await new Promise((r) => setTimeout(r, 80));
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
