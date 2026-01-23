"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ModeToggle } from "@/components/ModeToggle";
import NoteManager from "@/components/NoteManager";
import FolderManager from "@/components/FolderManager"; // 引入
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Loader2, Download, Search } from "lucide-react";
import ExportDialog from "@/components/ExportDialog";
import { cn } from "@/lib/utils";

// 高亮关键词的工具函数
function highlightText(text: string, query: string): React.ReactNode {
  if (!text || !query.trim()) return text;
  
  const regex = new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) => 
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 dark:bg-yellow-900 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// 获取内容摘要，包含关键词上下文
function getContentSnippet(content: string, query: string, maxLength: number = 120): string {
  if (!content) return "";
  if (!query.trim()) return content.slice(0, maxLength);
  
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.trim().toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);
  
  if (index === -1) {
    return content.slice(0, maxLength);
  }
  
  const start = Math.max(0, index - 40);
  const end = Math.min(content.length, index + query.length + 80);
  return content.slice(start, end);
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // 🔥 状态：当前查看的文件夹 (null 代表看根目录文件夹列表)
  const [currentFolder, setCurrentFolder] = useState<{id: string, name: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  
  // 防抖和请求取消相关
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchResultsRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        // 处理 refresh token 错误
        if (error) {
          console.error("Auth error:", error);
          // 如果是 refresh token 错误，清除 session 并重定向
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
      } catch (err) {
        console.error("Failed to check user:", err);
        router.replace("/");
      }
    };
    checkUser();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || !user?.id) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的 AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setSearching(true);
    const q = `%${query.trim()}%`;
    
    try {
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, content, folder_id, updated_at, tags")
      .eq("user_id", user.id)
      .or(`title.ilike.${q},content.ilike.${q},tags.ilike.${q}`);

      // 检查是否被取消
      if (abortController.signal.aborted) {
        return;
      }

    if (error) {
      console.error(error);
      setSearchResults([]);
      setSelectedResultIndex(-1);
    } else {
      setSearchResults(data || []);
      // 重置选中索引，如果有结果则选中第一个
      setSelectedResultIndex(data && data.length > 0 ? 0 : -1);
    }
    } catch (err: any) {
      // 忽略取消请求的错误
      if (err.name !== 'AbortError') {
        console.error(err);
        setSearchResults([]);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setSearching(false);
      }
    }
  }, [user?.id]);

  const handleGlobalSearchChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // 清除之前的防抖定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!value.trim() || !user?.id) {
      setSearchResults([]);
      setSearching(false);
      setSelectedResultIndex(-1);
      return;
    }

    // 设置防抖：300ms 后执行搜索
    debounceTimerRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  }, [user?.id, performSearch]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 搜索结果键盘导航
  useEffect(() => {
    if (!searchQuery.trim() || searchResults.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 只在搜索结果区域时响应键盘事件
      if (searchResults.length === 0) return;

      // 上下箭头键切换选中结果
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedResultIndex((prev) => {
          const next = prev < searchResults.length - 1 ? prev + 1 : 0; // 循环到第一个
          // 滚动到选中结果
          scrollToSelectedResult(next);
          return next;
        });
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedResultIndex((prev) => {
          const next = prev > 0 ? prev - 1 : searchResults.length - 1; // 循环到最后一个
          // 滚动到选中结果
          scrollToSelectedResult(next);
          return next;
        });
        return;
      }

      // Enter 键打开选中的结果
      if (e.key === "Enter" && selectedResultIndex >= 0 && selectedResultIndex < searchResults.length) {
        e.preventDefault();
        const note = searchResults[selectedResultIndex];
        const searchParam = searchQuery.trim() 
          ? `?search=${encodeURIComponent(searchQuery.trim())}` 
          : '';
        router.push(`/notes/${encodeURIComponent(note.id)}${searchParam}`);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery, searchResults, selectedResultIndex, router]);

  // 滚动到选中的结果
  const scrollToSelectedResult = (index: number) => {
    if (searchResultsRef.current && index >= 0) {
      const items = searchResultsRef.current.querySelectorAll("li");
      if (items[index]) {
        items[index].scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  };

  const handleExport = () => {
    if (!user?.id) return;
    setIsExportDialogOpen(true);
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
          <div className="flex items-center gap-1">
            {/* 导航链接组 - 使用更紧凑的样式 */}
            <div className="flex items-center gap-0.5 border-r border-border/50 pr-2 mr-2">
              <Link href="/dashboard/mind-notes" className="hidden sm:inline-flex">
                <Button variant="ghost" size="sm" className="h-8 px-3 text-sm">
                  思维笔记
                </Button>
              </Link>
              <Link href="/dashboard/todos" className="hidden sm:inline-flex">
                <Button variant="ghost" size="sm" className="h-8 px-3 text-sm">
                  任务管理
                </Button>
              </Link>
              <Link href="/dashboard/stats" className="hidden sm:inline-flex">
                <Button variant="ghost" size="sm" className="h-8 px-3 text-sm">
                  统计
                </Button>
              </Link>
              {/* 手机端：图标按钮 */}
              <Link href="/dashboard/mind-notes" className="sm:hidden">
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="思维笔记">
                  🧠
                </Button>
              </Link>
              <Link href="/dashboard/todos" className="sm:hidden">
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="任务管理">
                  ✅
                </Button>
              </Link>
              <Link href="/dashboard/stats" className="sm:hidden">
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="统计">
                  📊
                </Button>
              </Link>
            </div>
            
            {/* 操作按钮组 */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                className="h-8 px-2 text-sm hidden sm:flex items-center gap-1.5"
                title="导出笔记"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">导出</span>
              </Button>
              {/* 移动端导出按钮 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleExport}
                className="h-8 w-8 sm:hidden"
                title="导出笔记"
              >
                <Download className="w-4 h-4" />
              </Button>
              <ModeToggle />
              <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-8 w-8" title="退出登录">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* 内容区 */}
      <main className="max-w-4xl mx-auto py-8 px-4">
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
              <ul ref={searchResultsRef} className="space-y-2 text-sm">
                {searchResults.map((note, index) => (
                  <li
                    key={note.id}
                    className={cn(
                      "rounded-lg border px-3 py-2 cursor-pointer transition-colors",
                      index === selectedResultIndex
                        ? "border-blue-500 bg-blue-500/10 shadow-[0_0_0_1px_#3b82f6]"
                        : "border-border bg-card/60 hover:bg-accent/60"
                    )}
                    onClick={() => {
                      const searchParam = searchQuery.trim() 
                        ? `?search=${encodeURIComponent(searchQuery.trim())}` 
                        : '';
                      router.push(`/notes/${encodeURIComponent(note.id)}${searchParam}`);
                    }}
                    onMouseEnter={() => setSelectedResultIndex(index)}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium truncate">
                        {highlightText(note.title || "未命名笔记", searchQuery)}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {note.updated_at
                          ? new Date(note.updated_at).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    {note.content && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {highlightText(getContentSnippet(note.content, searchQuery), searchQuery)}
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
      
      {/* 导出对话框 */}
      {user?.id && (
        <ExportDialog
          isOpen={isExportDialogOpen}
          onClose={() => setIsExportDialogOpen(false)}
          userId={user.id}
        />
      )}
    </div>
  );
}