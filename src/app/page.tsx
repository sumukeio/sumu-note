"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import AuthModal from "@/components/AuthModal"; // 引入刚才写的弹窗
import { supabase } from "@/lib/supabase";

export default function LandingPage() {
  const router = useRouter();
  // 控制弹窗状态
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");

  // 打开弹窗的辅助函数
  const openAuth = (tab: "login" | "register") => {
    setAuthTab(tab);
    setIsAuthOpen(true);
  };

  // 近期登录过的用户自动跳转到 dashboard（无需再次输入密码）
  useEffect(() => {
    let cancelled = false;

    const checkUser = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          if (error.message?.includes("Refresh Token") || error.message?.includes("JWT")) {
            await supabase.auth.signOut();
            return;
          }
        }

        if (!cancelled && session?.user) {
          router.replace("/dashboard");
        }
      } catch (e) {
        // 静默失败，保持在落地页
        console.warn("Failed to check auth on landing:", e);
      }
    };

    checkUser();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      
      {/* 顶部导航 */}
      <nav className="flex items-center justify-between p-6 max-w-6xl mx-auto w-full z-10">
        <div className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          Sumu Note
        </div>
        <div className="flex gap-4">
          {/* 登录按钮 -> 弹窗 Login Tab */}
          <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={() => openAuth("login")}>
            登录
          </Button>
          
          {/* 开始使用(改为立即注册) -> 弹窗 Register Tab */}
          <Button className="bg-white text-black hover:bg-zinc-200 font-bold" onClick={() => openAuth("register")}>
            立即注册
          </Button>
        </div>
      </nav>

      {/* Hero 区域 */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 mt-20 relative">
        {/* 背景光效 (氛围感) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/20 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 z-10">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          v1.0 公测中 · 永久免费
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent max-w-4xl z-10">
          不仅是笔记，更是你的<br />
          <span className="text-white">第二大脑</span>
        </h1>
        
        <p className="text-lg text-zinc-400 max-w-2xl mb-10 leading-relaxed z-10">
          极简设计，AI 驱动。支持长按多选、智能 Dock 交互，以及 AWS 企业级数据存储。<br />
          专为独立开发者和高效能人士打造。
        </p>

        <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 z-10">
          {/* 立即免费开始 -> 弹窗 Register Tab */}
          <Button size="lg" className="h-12 px-8 text-lg bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold shadow-lg shadow-blue-900/50" onClick={() => openAuth("register")}>
            立即免费开始 <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
          
          <Button size="lg" variant="outline" className="h-12 px-8 text-lg border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-full">
            查看演示视频
          </Button>
        </div>

        {/* 底部特性 */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-4xl w-full border-t border-zinc-800 pt-12 z-10">
            <FeatureItem title="极速体验" desc="基于 Next.js App Router 构建，快如闪电。" />
            <FeatureItem title="数据安全" desc="Supabase + AWS S3 双重保障，数据归你所有。" />
            <FeatureItem title="AI 赋能" desc="内置 Gemini 3 Pro 模型，自动整理与续写。" />
        </div>
      </main>

      <footer className="py-8 text-center text-zinc-600 text-sm z-10">
        © 2025 Sumu Note. Built with Vibe Coding.
      </footer>

      {/* 🔥 挂载 Auth 弹窗组件 */}
      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        defaultTab={authTab}
      />
    </div>
  );
}

function FeatureItem({ title, desc }: { title: string, desc: string }) {
    return (
        <div className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div>
                <h3 className="font-bold text-zinc-200">{title}</h3>
                <p className="text-sm text-zinc-500 mt-1">{desc}</p>
            </div>
        </div>
    )
}