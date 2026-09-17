"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { resolveAuthUser, readUserFromAuthStorage } from "@/lib/auth-utils";
import {
  clearAuthHandoff,
  peekAuthHandoff,
  pushAuthDebug,
} from "@/lib/auth-login-handoff";
import AuthDebugPanel from "@/components/AuthDebugPanel";

function userFromHandoff(handoff: {
  userId: string;
  email?: string | null;
}): User {
  return {
    id: handoff.userId,
    email: handoff.email ?? undefined,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as User;
}

function admitUser(
  user: User,
  source: string,
  setUser: (u: User) => void,
  setLoading: (v: boolean) => void
): void {
  pushAuthDebug(`requireAuth:admit:${source}`, { userId: user.id });
  setUser(user);
  setLoading(false);
}

export function useRequireAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const admittedRef = useRef(false);

  const runCheck = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true;
      setAuthError(null);
      pushAuthDebug("requireAuth:start", {
        path: window.location.pathname + window.location.search,
        force,
        alreadyAdmitted: admittedRef.current,
      });

      // —— 快路径：handoff（刚登录）——
      const handoff = peekAuthHandoff();
      if (handoff) {
        clearAuthHandoff();
        admittedRef.current = true;
        admitUser(userFromHandoff(handoff), "handoff", setUser, setLoading);
        void resolveAuthUser({
          sessionAttemptTimeoutMs: 1_500,
          timeoutMs: 4_000,
        }).then((result) => {
          pushAuthDebug("requireAuth:bg-validate", { status: result.status });
          if (result.status === "ok") setUser(result.user);
        });
        return;
      }

      // —— 快路径：localStorage 已有 session.user（跳过可能挂死的 getSession）——
      if (!force) {
        const cached = readUserFromAuthStorage();
        if (cached) {
          admittedRef.current = true;
          admitUser(cached, "storage", setUser, setLoading);
          void resolveAuthUser({
            sessionAttemptTimeoutMs: 1_500,
            timeoutMs: 4_000,
          }).then((result) => {
            pushAuthDebug("requireAuth:bg-validate", { status: result.status });
            if (result.status === "ok") setUser(result.user);
            if (result.status === "unauthenticated") {
              admittedRef.current = false;
              setUser(null);
              router.replace("/?auth=required");
            }
          });
          return;
        }
      }

      // 已放行过则不要因 effect 重跑再进转圈
      if (admittedRef.current && !force) {
        pushAuthDebug("requireAuth:skip-rerun");
        setLoading(false);
        return;
      }

      setLoading(true);
      let settled = false;
      const safety = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        pushAuthDebug("requireAuth:safety-timeout");
        setAuthError(
          "验证登录状态超时，请重试。若反复出现，请关闭无痕模式后重试。"
        );
        setLoading(false);
      }, 6_000);

      try {
        const result = await resolveAuthUser({
          sessionAttemptTimeoutMs: 1_500,
          timeoutMs: 4_000,
        });
        pushAuthDebug("requireAuth:resolve", { status: result.status });

        if (settled) return;
        settled = true;

        if (result.status === "ok") {
          admittedRef.current = true;
          setUser(result.user);
          setLoading(false);
          pushAuthDebug("requireAuth:ok", { userId: result.user.id });
          return;
        }

        if (result.status === "unauthenticated") {
          admittedRef.current = false;
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
    },
    [router]
  );

  useEffect(() => {
    void runCheck();
    // 仅首挂；retry 走显式 force
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = useCallback(() => {
    admittedRef.current = false;
    void runCheck({ force: true });
  }, [runCheck]);

  return { user, loading, authError, retry };
}

/** @deprecated 调试条已挂到根 layout；保留导出避免旧引用报错 */
export function RequireAuthDebugMount() {
  return null;
}

export { AuthDebugPanel };
