"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Link2, Loader2, ChevronUp, ChevronDown, X } from "lucide-react";
import { findAllMatches, getNextMatchIndex, getPreviousMatchIndex, type Match } from "@/lib/search-utils";
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  title: string | null;
  content: string | null;
  updated_at: string | null;
}

interface BacklinkItem {
  id: string;
  title: string | null;
  content: string | null;
  updated_at: string | null;
}

export default function NoteDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [note, setNote] = useState<Note | null>(null);
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBacklinks, setLoadingBacklinks] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  
  // 搜索结果切换相关状态
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [highlightElements, setHighlightElements] = useState<HTMLElement[]>([]);

  const noteIdOrTitle = decodeURIComponent(params.id);
  const searchQuery = searchParams.get('search') || '';

  useEffect(() => {
    const run = async () => {
      try {
        // 1. 先按 id 精确查找
        let { data: noteById, error: noteByIdError } = await supabase
          .from("notes")
          .select("*")
          .eq("id", noteIdOrTitle)
          .maybeSingle();

        if (noteByIdError) {
          // 记录错误但不立即抛出，继续尝试按标题
          console.warn("Fetch note by id error:", noteByIdError.message);
        }

        let targetNote: any = noteById;

        // 2. 如果按 id 没找到，则按标题尝试（取第一条）
        if (!targetNote) {
          const { data: notesByTitle, error: noteByTitleError } =
            await supabase
              .from("notes")
              .select("*")
              .ilike("title", noteIdOrTitle)
              .limit(1);

          if (noteByTitleError) {
            console.warn(
              "Fetch note by title error:",
              noteByTitleError.message
            );
          }

          if (notesByTitle && notesByTitle.length > 0) {
            targetNote = notesByTitle[0];
          }
        }

        if (!targetNote) {
          setError("未找到这篇笔记");
          setLoading(false);
          setLoadingBacklinks(false);
          return;
        }

        setNote(targetNote);
        setLoading(false);

        // 3. 查询 Backlinks
        const idPattern = `%[[${targetNote.id}%`;
        const titlePattern = targetNote.title
          ? `%[[${targetNote.title}]]%`
          : null;

        let query = supabase
          .from("notes")
          .select("id, title, content, updated_at")
          .neq("id", targetNote.id);

        // 通过 ILIKE 模糊匹配 content
        if (titlePattern) {
          query = query.or(
            `content.ilike.${idPattern},content.ilike.${titlePattern}`
          );
        } else {
          query = query.ilike("content", idPattern);
        }

        const { data: backlinksData, error: backlinksError } = await query;

        if (backlinksError) {
          console.warn("Fetch backlinks error:", backlinksError.message);
          setBacklinks([]);
        } else {
          setBacklinks(backlinksData || []);
        }
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "加载笔记失败");
      } finally {
        setLoadingBacklinks(false);
      }
    };

    run();
  }, [noteIdOrTitle]);

  // 查找所有匹配项并高亮
  useEffect(() => {
    if (!searchQuery.trim() || !note?.content || !contentRef.current) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      // 清除之前的高亮
      highlightElements.forEach(el => {
        if (el.parentNode) {
          const parent = el.parentNode;
          const textNode = document.createTextNode(el.textContent || '');
          parent.replaceChild(textNode, el);
          parent.normalize();
        }
      });
      setHighlightElements([]);
      hasScrolledRef.current = false;
      return;
    }

    // 等待 ReactMarkdown 渲染完成
    const timer = setTimeout(() => {
      if (!contentRef.current) return;

      const query = searchQuery.trim();
      // 使用 search-utils 查找所有匹配项（基于纯文本）
      const textMatches = findAllMatches(note.content, query, false);
      setMatches(textMatches);

      // 清除之前的高亮
      highlightElements.forEach(el => {
        if (el.parentNode) {
          const parent = el.parentNode;
          const textNode = document.createTextNode(el.textContent || '');
          parent.replaceChild(textNode, el);
          parent.normalize();
        }
      });

      // 在 DOM 中查找并高亮所有匹配项
      const lowerQuery = query.toLowerCase();
      const walker = document.createTreeWalker(
        contentRef.current,
        NodeFilter.SHOW_TEXT,
        null
      );

      const newHighlights: HTMLElement[] = [];
      let node: Node | null;

      while ((node = walker.nextNode())) {
        const nodeText = node.textContent || '';
        const nodeLowerText = nodeText.toLowerCase();
        
        // 查找所有匹配位置
        let searchIndex = 0;
        while ((searchIndex = nodeLowerText.indexOf(lowerQuery, searchIndex)) !== -1) {
          try {
            const range = document.createRange();
            range.setStart(node, searchIndex);
            range.setEnd(node, searchIndex + query.length);
            
            const highlight = document.createElement('mark');
            highlight.className = 'bg-yellow-200 dark:bg-yellow-900 px-0.5 rounded search-match';
            highlight.style.scrollMarginTop = '100px';
            
            range.surroundContents(highlight);
            newHighlights.push(highlight);
            searchIndex += query.length;
          } catch (e) {
            // 如果无法包围（跨节点），跳过
            searchIndex += query.length;
          }
        }
      }

      setHighlightElements(newHighlights);
      
      // 如果有匹配项，滚动到第一个
      if (textMatches.length > 0 && !hasScrolledRef.current) {
        setCurrentMatchIndex(0);
        scrollToMatch(0, newHighlights);
        hasScrolledRef.current = true;
      } else if (textMatches.length > 0) {
        // 如果已经滚动过，确保当前索引有效
        if (currentMatchIndex < 0 || currentMatchIndex >= newHighlights.length) {
          setCurrentMatchIndex(0);
        }
        scrollToMatch(currentMatchIndex >= 0 ? currentMatchIndex : 0, newHighlights);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery, note?.content]);

  // 滚动到指定匹配项
  const scrollToMatch = (index: number, highlights: HTMLElement[] = highlightElements) => {
    if (index < 0 || index >= highlights.length) return;
    
    const highlight = highlights[index];
    if (highlight) {
      // 移除所有高亮的当前样式
      highlights.forEach((el) => {
        el.classList.remove('ring-2', 'ring-blue-500');
      });
      
      // 添加当前高亮的样式
      highlight.classList.add('ring-2', 'ring-blue-500');
      
      highlight.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  };

  // 处理下一个匹配项
  const handleNextMatch = useCallback(() => {
    if (matches.length === 0) return;
    const nextIndex = getNextMatchIndex(currentMatchIndex, matches);
    setCurrentMatchIndex(nextIndex);
    // 使用 setTimeout 确保 highlightElements 已更新
    setTimeout(() => scrollToMatch(nextIndex), 0);
  }, [matches, currentMatchIndex]);

  // 处理上一个匹配项
  const handlePreviousMatch = useCallback(() => {
    if (matches.length === 0) return;
    const prevIndex = getPreviousMatchIndex(currentMatchIndex, matches);
    setCurrentMatchIndex(prevIndex);
    // 使用 setTimeout 确保 highlightElements 已更新
    setTimeout(() => scrollToMatch(prevIndex), 0);
  }, [matches, currentMatchIndex]);

  // 键盘快捷键监听
  useEffect(() => {
    if (!searchQuery.trim() || matches.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+G 或 Cmd+G：下一个匹配项
      if ((e.ctrlKey || e.metaKey) && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        handleNextMatch();
        return;
      }

      // Ctrl+Shift+G 或 Cmd+Shift+G：上一个匹配项
      if ((e.ctrlKey || e.metaKey) && e.key === 'G' && e.shiftKey) {
        e.preventDefault();
        handlePreviousMatch();
        return;
      }

      // F3：下一个匹配项
      if (e.key === 'F3' && !e.shiftKey) {
        e.preventDefault();
        handleNextMatch();
        return;
      }

      // Shift+F3：上一个匹配项
      if (e.key === 'F3' && e.shiftKey) {
        e.preventDefault();
        handlePreviousMatch();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, matches, currentMatchIndex]);

  const handleBack = () => {
    router.back();
  };

  const renderBacklinkSnippet = (item: BacklinkItem): string => {
    const content = item.content || "";
    if (!content) return "";

    // 找到第一个 [[...]] 位置，取其附近作为 snippet
    const match = content.match(/\[\[([^[\]]+)\]\]/);
    if (!match || match.index === undefined) {
      return content.slice(0, 120);
    }
    const index = match.index;
    const start = Math.max(0, index - 40);
    const end = Math.min(content.length, index + match[0].length + 80);
    return content.slice(start, end);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <p className="mb-4 text-sm text-muted-foreground">
          {error || "未找到这篇笔记"}
        </p>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={handleBack}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <div className="flex items-center gap-4">
            {/* 搜索结果导航 */}
            {searchQuery.trim() && matches.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/50 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground">
                  {currentMatchIndex + 1}/{matches.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handlePreviousMatch}
                    title="上一个 (Ctrl+Shift+G)"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleNextMatch}
                    title="下一个 (Ctrl+G)"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              {note.updated_at
                ? new Date(note.updated_at).toLocaleString()
                : ""}
            </span>
          </div>
        </header>

        <main className="space-y-6">
          <h1 className="text-3xl font-bold mb-2">
            {note.title || "未命名笔记"}
          </h1>

          <section 
            ref={contentRef}
            className="prose prose-sm sm:prose-base dark:prose-invert max-w-none"
          >
            <MarkdownRenderer content={note.content || ""} />
          </section>

          <section className="mt-10 border-t border-border pt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Link2 className="w-4 h-4 text-blue-500" />
              Backlinks
            </div>

            {loadingBacklinks ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                加载引用中...
              </div>
            ) : backlinks.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                暂无其他笔记引用这篇笔记。
              </p>
            ) : (
              <ul className="space-y-3">
                {backlinks.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-border bg-card/60 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <button
                        className="text-left font-medium text-blue-600 hover:underline"
                        onClick={() =>
                          router.push(`/notes/${encodeURIComponent(item.id)}`)
                        }
                      >
                        {item.title || "未命名笔记"}
                      </button>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {item.updated_at
                          ? new Date(item.updated_at).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {renderBacklinkSnippet(item)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}


