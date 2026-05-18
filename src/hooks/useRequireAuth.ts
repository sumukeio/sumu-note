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
      router.replace("/");
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
