"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { resolveAuthUser } from "@/lib/auth-utils";

export function useRequireAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setAuthError(null);

    let settled = false;
    // 总闸：避免 iOS 上 getSession 挂死导致永久白屏转圈
    const safety = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      setAuthError(
        "验证登录状态超时，请重试。若反复出现，请关闭无痕模式后重试。"
      );
      setLoading(false);
    }, 10_000);

    try {
      const result = await resolveAuthUser();
      if (settled) return;
      settled = true;

      if (result.status === "ok") {
        setUser(result.user);
        setLoading(false);
        return;
      }

      if (result.status === "unauthenticated") {
        setUser(null);
        setLoading(false);
        router.replace("/?auth=required");
        return;
      }

      if (result.kind === "timeout") {
        setAuthError("网络较慢或连接超时，请检查网络后重试");
      } else {
        setAuthError(result.message ?? "验证登录状态失败，请重试");
      }
      setLoading(false);
    } finally {
      window.clearTimeout(safety);
    }
  }, [router]);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  return { user, loading, authError, retry: runCheck };
}
