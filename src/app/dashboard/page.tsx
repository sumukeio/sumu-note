"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { User } from "@supabase/supabase-js";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import AuthLoadingScreen from "@/components/AuthLoadingScreen";
import { pushAuthDebug } from "@/lib/auth-login-handoff";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * 鉴权 chunk 必须保持轻量：勿静态 import DashboardHomeClient（会把 NoteManager 打进首包，
 * iPhone 上 JS 解析不过来 → 永久停在 SSR「正在验证登录状态」）。
 */
function LazyDashboardHome({ user }: { user: User }) {
  const router = useRouter();
  const [Home, setHome] = useState<ComponentType<{ user: User }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setHome(null);
    setError(null);
    pushAuthDebug("dashboard-home:import-start");

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      pushAuthDebug("dashboard-home:import-timeout");
      setError(
        "工作台脚本加载超时。可能是网络慢或机型内存不足，请点重试或返回首页。"
      );
    }, 15_000);

    import("./DashboardHomeClient")
      .then((mod) => {
        if (cancelled) return;
        window.clearTimeout(timer);
        pushAuthDebug("dashboard-home:import-ok");
        setHome(() => mod.default);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        window.clearTimeout(timer);
        const msg = e instanceof Error ? e.message : String(e);
        pushAuthDebug("dashboard-home:import-fail", { msg });
        setError(`工作台加载失败：${msg}`);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tick]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 bg-background text-foreground">
        <p className="text-sm text-muted-foreground text-center max-w-sm">{error}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.replace("/")}>
            返回首页
          </Button>
          <Button onClick={() => setTick((n) => n + 1)}>重试</Button>
        </div>
      </div>
    );
  }

  if (!Home) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background px-6">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground text-center">
          正在加载工作台…
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => router.replace("/")}
        >
          返回首页
        </Button>
      </div>
    );
  }

  return <Home user={user} />;
}

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

  return <LazyDashboardHome user={user} />;
}

export default function DashboardPage() {
  return <DashboardAuthGate />;
}
