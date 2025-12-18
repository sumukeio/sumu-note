"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // 从 URL 中获取 code 参数（OAuth 回调会包含这个）
        const code = searchParams.get("code");
        
        if (code) {
          // 如果有 code，使用 exchangeCodeForSession 交换 session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error("Auth callback error:", error);
            router.push("/?error=auth_failed");
            return;
          }

          if (data.session) {
            router.push("/dashboard");
            return;
          }
        }

        // 如果没有 code 或 exchange 失败，尝试直接获取 session（可能是其他类型的回调）
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth session error:", error);
          router.push("/?error=auth_failed");
          return;
        }

        if (data.session) {
          router.push("/dashboard");
        } else {
          router.push("/?error=no_session");
        }
      } catch (e) {
        console.error("Auth callback exception:", e);
        router.push("/?error=auth_failed");
      }
    };

    handleAuthCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">正在完成登录...</p>
      </div>
    </div>
  );
}

