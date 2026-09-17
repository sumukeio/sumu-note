"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { resolveAuthUser } from "@/lib/auth-utils";
import {
  clearAuthHandoff,
  peekAuthHandoff,
  pushAuthDebug,
} from "@/lib/auth-login-handoff";
import AuthDebugPanel from "@/components/AuthDebugPanel";

export function useRequireAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    pushAuthDebug("requireAuth:start", { path: window.location.pathname });

    let settled = false;
    const safety = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      pushAuthDebug("requireAuth:safety-timeout");
      setAuthError(
        "验证登录状态超时，请重试。若反复出现，请关闭无痕模式后重试。"
      );
      setLoading(false);
    }, 10_000);

    try {
      let result = await resolveAuthUser();
      pushAuthDebug("requireAuth:resolve", { status: result.status });

      // 刚登录交接：session API 尚未就绪时，用 handoff 乐观放行一次
      if (result.status === "unauthenticated") {
        const handoff = peekAuthHandoff();
        if (handoff) {
          pushAuthDebug("requireAuth:handoff-retry", handoff);
          await new Promise((r) => setTimeout(r, 300));
          result = await resolveAuthUser({
            sessionAttemptTimeoutMs: 3_000,
            timeoutMs: 6_000,
          });
          pushAuthDebug("requireAuth:resolve-after-handoff", {
            status: result.status,
          });

          if (result.status !== "ok") {
            // 仍失败：用 handoff 构造最小 user 进入（后台再校验）
            pushAuthDebug("requireAuth:handoff-optimistic", {
              userId: handoff.userId,
            });
            clearAuthHandoff();
            if (settled) return;
            settled = true;
            setUser({
              id: handoff.userId,
              email: handoff.email ?? undefined,
              app_metadata: {},
              user_metadata: {},
              aud: "authenticated",
              created_at: "",
            } as User);
            setLoading(false);
            return;
          }
        }
      }

      if (settled) return;
      settled = true;

      if (result.status === "ok") {
        clearAuthHandoff();
        setUser(result.user);
        setLoading(false);
        pushAuthDebug("requireAuth:ok", { userId: result.user.id });
        return;
      }

      if (result.status === "unauthenticated") {
        setUser(null);
        setLoading(false);
        pushAuthDebug("requireAuth:kick-home");
        router.replace("/?auth=required");
        return;
      }

      if (result.kind === "timeout") {
        setAuthError("网络较慢或连接超时，请检查网络后重试");
      } else {
        setAuthError(result.message ?? "验证登录状态失败，请重试");
      }
      setLoading(false);
      pushAuthDebug("requireAuth:error", result);
    } finally {
      window.clearTimeout(safety);
    }
  }, [router]);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  return { user, loading, authError, retry: runCheck };
}

/** 在需鉴权的页面根部挂载调试条（可选） */
export function RequireAuthDebugMount() {
  return <AuthDebugPanel />;
}
