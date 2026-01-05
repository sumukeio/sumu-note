"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ModeToggle } from "@/components/ModeToggle";
import NoteManager from "@/components/NoteManager";
import FolderManager from "@/components/FolderManager"; // 引入
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Loader2, Download, Search } from "lucide-react";
import { exportUserNotesToZip } from "@/lib/export-utils";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // 🔥 状态：当前查看的文件夹 (null 代表看根目录文件夹列表)
  const [currentFolder, setCurrentFolder] = useState<{id: string, name: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

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

  const handleGlobalSearchChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (!value.trim() || !user?.id) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const q = `%${value.trim()}%`;
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, content, folder_id, updated_at, tags")
      .eq("user_id", user.id)
      .or(`title.ilike.${q},content.ilike.${q},tags.ilike.${q}`);

    if (error) {
      console.error(error);
      setSearchResults([]);
    } else {
      setSearchResults(data || []);
    }
    setSearching(false);
  };

  const handleExport = async () => {
    if (!user?.id || exporting) return;
    try {
      setExporting(true);
      setExportMessage(null);
      await exportUserNotesToZip(user.id);
      setExportMessage("导出成功，已下载备份 zip 文件。");
    } catch (error: any) {
      console.error(error);
      setExportMessage(error?.message || "导出失败，请稍后重试。");
    } finally {
      setExporting(false);
      // 3 秒后自动清理提示
      setTimeout(() => setExportMessage(null), 3000);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      
      {/* 导航栏 */}
      <nav className="border-b border-border bg-background/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 font-bold text-lg shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm">
              S
            </div>
            <span className="hidden sm:inline">Sumu Note</span>
          </div>
          <div className="flex-1 max-w-md hidden sm:flex items-center">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <Input
                placeholder="全局搜索标题或内容..."
                value={searchQuery}
                onChange={handleGlobalSearchChange}
                className="pl-9 h-9 bg-accent/40 border-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 桌面端：文字按钮 */}
            <Link href="/dashboard/mind-notes" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm">
                思维笔记
              </Button>
            </Link>
            <Link href="/dashboard/stats" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm">
                统计
              </Button>
            </Link>
            {/* 手机端：图标按钮，保持导航简洁 */}
            <Link href="/dashboard/mind-notes" className="sm:hidden">
              <Button variant="ghost" size="icon" aria-label="思维笔记">
                🧠
              </Button>
            </Link>
            <Link href="/dashboard/stats" className="sm:hidden">
              <Button variant="ghost" size="icon" aria-label="统计">
                📊
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  导出中...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  导出备份
                </>
              )}
            </Button>
            <ModeToggle />
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* 内容区 */}
      <main className="max-w-4xl mx-auto py-8 px-4">
        {exportMessage && (
          <div className="mb-4 text-sm text-center text-muted-foreground bg-accent/60 border border-border px-3 py-2 rounded-lg">
            {exportMessage}
          </div>
        )}
        {searchQuery.trim() ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Search className="w-4 h-4" />
                搜索结果
              </h2>
              {searching && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  搜索中...
                </span>
              )}
            </div>
            {searchResults.length === 0 && !searching ? (
              <p className="text-xs text-muted-foreground">
                没有找到与 “{searchQuery}” 相关的笔记。
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {searchResults.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-lg border border-border bg-card/60 px-3 py-2 cursor-pointer hover:bg-accent/60 transition-colors"
                    onClick={() =>
                      router.push(`/notes/${encodeURIComponent(note.id)}`)
                    }
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium truncate">
                        {note.title || "未命名笔记"}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {note.updated_at
                          ? new Date(note.updated_at).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    {note.content && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {note.content}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : currentFolder ? (
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