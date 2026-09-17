"use client";

import { useEffect } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import AuthLoadingScreen from "@/components/AuthLoadingScreen";
import { pushAuthDebug } from "@/lib/auth-login-handoff";
import DashboardHomeClient from "./DashboardHomeClient";

/**
 * 鉴权通过后直接渲染工作台。
 * 禁止：整页 dynamic() / 外包 Suspense(useSearchParams) —— iOS 上会永久「正在加载工作台」。
 */
function DashboardAuthGate() {
  const { user, loading, authError, retry } = useRequireAuth();

  useEffect(() => {
    if (user) {
      pushAuthDebug("dashboard:auth-ok", { userId: user.id });
    }
  }, [user]);

  if (!user) {
    return (
      <AuthLoadingScreen
        loading={loading}
        authError={authError}
        onRetry={retry}
      />
    );
  }

  return <DashboardHomeClient user={user} />;
}

export default function DashboardPage() {
  return <DashboardAuthGate />;
}
