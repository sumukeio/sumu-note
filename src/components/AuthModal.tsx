"use client";

import { useState, useEffect } from "react";
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
  defaultTab?: "login" | "register";
}

export default function AuthModal({ isOpen, onClose, defaultTab = "login" }: AuthModalProps) {
  const router = useRouter();
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
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
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
                alert("该邮箱已注册，请直接登录！");
                setActiveTab("login"); // 自动切到登录
                // 此时 email 状态还在，所以邮箱框里已经填好了
                // 用户只需要填密码点登录即可
                return;
            }
            throw error;
        }
        
        alert("🎉 注册成功！请检查邮箱验证链接。");
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}