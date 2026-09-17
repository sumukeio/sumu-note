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

    const result = await resolveAuthUser();

    if (result.status === "ok") {
      setUser(result.user);
      setLoading(false);
      return;
    }

    if (result.status === "unauthenticated") {
      setUser(null);
      setLoading(false);
      // 带回标记，落地页可提示并打开登录（避免「进不去又不报错」）
      router.replace("/?auth=required");
      return;
    }

    if (result.kind === "timeout") {
      setAuthError("网络较慢或连接超时，请检查网络后重试");
    } else {
      setAuthError(result.message ?? "验证登录状态失败，请重试");
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  return { user, loading, authError, retry: runCheck };
}
