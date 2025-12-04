"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "login" | "register"; // 允许外部控制默认打开哪个标签
}

export default function AuthModal({ isOpen, onClose, defaultTab = "login" }: AuthModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // 处理登录/注册逻辑
  const handleAuth = async (type: "login" | "register") => {
    setIsLoading(true);
    setErrorMsg("");

    try {
      if (type === "login") {
        // --- 登录逻辑 ---
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // 登录成功，跳转后台
        router.push("/dashboard");
        onClose(); // 关闭弹窗

      } else {
        // --- 注册逻辑 ---
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        
        // 注册成功提示 (Supabase 默认需要验证邮箱，或者你可以关掉验证直接登录)
        alert("🎉 注册成功！如果开启了邮箱验证，请去邮箱确认；如果没有，请直接登录。");
        // 如果 Supabase 设置了"关闭邮箱验证"，这里可以直接 auto login，或者让用户切到登录 tab
      }
    } catch (e: any) {
      setErrorMsg(e.message || "操作失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] bg-zinc-950 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            欢迎来到 Sumu Note
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-400">
            您的第二大脑，从这里开启。
          </DialogDescription>
        </DialogHeader>

        {/* 标签页切换 */}
        <Tabs defaultValue={defaultTab} className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-zinc-900">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>

          {/* === 登录表单 === */}
          <TabsContent value="login" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-login">邮箱</Label>
              <Input id="email-login" placeholder="name@example.com" type="email" 
                className="bg-black border-zinc-700 focus-visible:ring-blue-600"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-login">密码</Label>
              <Input id="password-login" type="password" 
                className="bg-black border-zinc-700 focus-visible:ring-blue-600"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {errorMsg && <p className="text-red-500 text-xs">{errorMsg}</p>}
            
            <Button className="w-full bg-white text-black hover:bg-zinc-200 font-bold" onClick={() => handleAuth("login")} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "立即登录"}
            </Button>
          </TabsContent>

          {/* === 注册表单 === */}
          <TabsContent value="register" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-register">邮箱</Label>
              <Input id="email-register" placeholder="name@example.com" type="email" 
                className="bg-black border-zinc-700 focus-visible:ring-blue-600"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-register">密码</Label>
              <Input id="password-register" type="password" placeholder="设置一个强密码"
                className="bg-black border-zinc-700 focus-visible:ring-blue-600"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
             {errorMsg && <p className="text-red-500 text-xs">{errorMsg}</p>}

            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={() => handleAuth("register")} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="flex items-center gap-2">免费注册 <ArrowRight className="w-4 h-4"/></span>}
            </Button>
            <p className="text-[10px] text-zinc-500 text-center px-4">
                点击注册即表示您同意我们的服务条款和隐私政策。
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}