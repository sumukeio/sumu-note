"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import TodoManager from "@/components/TodoManager";
import { initReminderSystem, cleanupReminderSystem } from "@/lib/todo-reminder";

export default function TodosPageClient() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        // 处理 refresh token 错误
        if (error) {
          console.error("Auth error:", error);
          if (error.message?.includes("Refresh Token") || error.message?.includes("JWT")) {
            await supabase.auth.signOut();
            router.replace("/");
            return;
          }
        }

        if (!user) {
          router.replace("/");
          return;
        }
        setUser(user);
        setLoading(false);
        
        // 初始化提醒系统
        initReminderSystem(user.id).catch((err) => {
          console.error("Failed to init reminder system:", err);
        });
      } catch (err) {
        console.error("Failed to check user:", err);
        router.replace("/");
      }
    };
    checkUser();
    
    // 清理函数：组件卸载时清理提醒系统
    return () => {
      cleanupReminderSystem();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <TodoManager userId={user.id} />;
}

