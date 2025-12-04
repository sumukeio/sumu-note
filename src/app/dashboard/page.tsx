"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ModeToggle } from "@/components/ModeToggle";
import NoteManager from "@/components/NoteManager";
import FolderManager from "@/components/FolderManager"; // 引入
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 🔥 状态：当前查看的文件夹 (null 代表看根目录文件夹列表)
  const [currentFolder, setCurrentFolder] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      setUser(user);
      setLoading(false);
    };
    checkUser();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      
      {/* 导航栏 */}
      <nav className="border-b border-border bg-background/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm">S</div>
            Sumu Note
          </div>
          <div className="flex items-center gap-4">
            <ModeToggle />
            <Button variant="ghost" size="icon" onClick={handleSignOut}><LogOut className="w-5 h-5" /></Button>
          </div>
        </div>
      </nav>

      {/* 内容区 */}
      <main className="max-w-4xl mx-auto py-8 px-4">
        {currentFolder ? (
            // 👀 模式 B: 查看笔记
            <NoteManager 
                userId={user.id} 
                folderId={currentFolder.id} 
                folderName={currentFolder.name}
                onBack={() => setCurrentFolder(null)} // 返回到文件夹列表
            />
        ) : (
            // 👀 模式 A: 查看文件夹列表 (默认)
            <FolderManager 
                userId={user.id} 
                onEnterFolder={(id, name) => setCurrentFolder({ id, name })} 
            />
        )}
      </main>

    </div>
  );
}