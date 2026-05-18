"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ensureSessionAfterSignIn } from "@/lib/auth-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ArrowRight } from "lucide-react";

// 添加 Google 和 Apple 图标（使用 emoji 或 SVG）
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const AppleIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "login" | "register";
}

export default function AuthModal({ isOpen, onClose, defaultTab = "login" }: AuthModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  
  // 🔥 新增：控制当前显示的 Tab
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  // 当外部传入 defaultTab 变化时，同步更新内部状态
  useEffect(() => {
    if (isOpen) {
        setActiveTab(defaultTab);
        setErrorMsg("");
    }
  }, [isOpen, defaultTab]);

  const handleAuth = async (type: "login" | "register") => {
    setIsLoading(true);
    setErrorMsg("");

    try {
      if (type === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        const session =
          data.session ?? (await ensureSessionAfterSignIn());
        if (!session) {
          throw new Error("登录成功但会话未就绪，请重试");
        }

        // 使用 replace 避免历史中保留登录页，提升手机端返回手势体验
        router.replace("/dashboard");
        onClose();

      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        
        if (error) {
            // 🔥 核心逻辑：如果用户已存在
            if (error.message.includes("already registered") || error.message.includes("User already exists")) {
                toast({
                  title: "邮箱已注册",
                  description: "该邮箱已注册，请直接登录！",
                  variant: "default",
                });
                setActiveTab("login"); // 自动切到登录
                // 此时 email 状态还在，所以邮箱框里已经填好了
                // 用户只需要填密码点登录即可
                return;
            }
            throw error;
        }
        
        toast({
          title: "注册成功",
          description: "请检查邮箱验证链接",
          variant: "success",
        });
      }
    } catch (e: any) {
      setErrorMsg(e.message || "操作失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  // 处理 OAuth 登录（Google / Apple）
  const handleOAuthLogin = async (provider: "google" | "apple") => {
    setIsLoading(true);
    setErrorMsg("");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${location.origin}/auth/callback`,
        },
      });
      
      if (error) throw error;
      // OAuth 会重定向到提供商，成功后跳转回 callback，所以这里不需要手动 push
    } catch (e: any) {
      setErrorMsg(e.message || `${provider === "google" ? "Google" : "Apple"} 登录失败，请重试`);
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] bg-zinc-950 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">Sumu Note</DialogTitle>
          <DialogDescription className="text-center text-zinc-400">开启你的第二大脑</DialogDescription>
        </DialogHeader>

        {/* 🔥 修改：value 和 onValueChange 实现受控切换 */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register")} className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-zinc-900">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input placeholder="name@example.com" type="email" 
                className="bg-black border-zinc-700"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>密码</Label>
              <Input type="password" 
                className="bg-black border-zinc-700"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {errorMsg && <p className="text-red-500 text-xs">{errorMsg}</p>}
            
            <Button className="w-full bg-white text-black hover:bg-zinc-200 font-bold" onClick={() => handleAuth("login")} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "立即登录"}
            </Button>
            
            {/* 一键登录区域 */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-700"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-zinc-950 px-2 text-zinc-400">或使用</span>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800"
                onClick={() => handleOAuthLogin("google")}
                disabled={isLoading}
              >
                <GoogleIcon />
                <span className="ml-2">使用 Google 登录</span>
              </Button>
              <Button
                variant="outline"
                className="w-full border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800"
                onClick={() => handleOAuthLogin("apple")}
                disabled={isLoading}
              >
                <AppleIcon />
                <span className="ml-2">使用 Apple 登录</span>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="register" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input placeholder="name@example.com" type="email" 
                className="bg-black border-zinc-700"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>密码</Label>
              <Input type="password" placeholder="设置密码"
                className="bg-black border-zinc-700"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
             {errorMsg && <p className="text-red-500 text-xs">{errorMsg}</p>}

            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={() => handleAuth("register")} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="flex items-center gap-2">免费注册 <ArrowRight className="w-4 h-4"/></span>}
            </Button>
            
            {/* 一键登录区域（注册页也显示，方便新用户快速注册） */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-700"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-zinc-950 px-2 text-zinc-400">或使用</span>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800"
                onClick={() => handleOAuthLogin("google")}
                disabled={isLoading}
              >
                <GoogleIcon />
                <span className="ml-2">使用 Google 注册</span>
              </Button>
              <Button
                variant="outline"
                className="w-full border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800"
                onClick={() => handleOAuthLogin("apple")}
                disabled={isLoading}
              >
                <AppleIcon />
                <span className="ml-2">使用 Apple 注册</span>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}