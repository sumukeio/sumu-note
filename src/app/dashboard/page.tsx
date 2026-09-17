"use client";

import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import AuthLoadingScreen from "@/components/AuthLoadingScreen";
import { pushAuthDebug } from "@/lib/auth-login-handoff";
import { Loader2 } from "lucide-react";

/**
 * 鉴权必须在 Suspense(useSearchParams) 之外。
 * iOS 上整页包进 Suspense 时，searchParams 可能永不 resolve → 永久白屏转圈，
 * 且 useRequireAuth 根本不会执行（日志里看不到 requireAuth:*）。
 */
const DashboardHomeClient = dynamic(
  () => import("./DashboardHomeClient"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">正在加载工作台…</p>
      </div>
    ),
  }
);

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

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">正在加载工作台…</p>
        </div>
      }
    >
      <DashboardHomeClient user={user} />
    </Suspense>
  );
}

export default function DashboardPage() {
  return <DashboardAuthGate />;
}
