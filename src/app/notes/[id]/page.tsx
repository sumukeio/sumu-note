"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Link2, Loader2 } from "lucide-react";

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

  // 滚动到关键词位置的函数
  useEffect(() => {
    if (!searchQuery.trim() || !note?.content || hasScrolledRef.current || !contentRef.current) {
      return;
    }

    // 等待 ReactMarkdown 渲染完成
    const timer = setTimeout(() => {
      const query = searchQuery.trim();
      const lowerQuery = query.toLowerCase();
      
      // 查找所有文本节点
      const walker = document.createTreeWalker(
        contentRef.current!,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let node: Node | null;
      let targetNode: Node | null = null;
      let targetOffset = 0;
      
      while (node = walker.nextNode()) {
        const nodeText = node.textContent || '';
        const nodeLowerText = nodeText.toLowerCase();
        const nodeIndex = nodeLowerText.indexOf(lowerQuery);
        
        if (nodeIndex !== -1) {
          targetNode = node;
          targetOffset = nodeIndex;
          break;
        }
      }
      
      if (targetNode && targetNode.parentElement) {
        try {
          // 创建范围并选中关键词
          const range = document.createRange();
          range.setStart(targetNode, targetOffset);
          range.setEnd(targetNode, targetOffset + query.length);
          
          // 高亮关键词
          const highlight = document.createElement('mark');
          highlight.className = 'bg-yellow-200 dark:bg-yellow-900 px-0.5 rounded';
          highlight.style.scrollMarginTop = '100px'; // 为固定头部留出空间
          
          try {
            range.surroundContents(highlight);
          } catch (e) {
            // 如果无法包围（跨节点），则只选中并滚动
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(range);
            targetNode.parentElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            });
            hasScrolledRef.current = true;
            return;
          }
          
          // 滚动到高亮位置
          highlight.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
          
          hasScrolledRef.current = true;
          
          // 3秒后移除高亮
          setTimeout(() => {
            if (highlight.parentNode) {
              const parent = highlight.parentNode;
              const textNode = document.createTextNode(highlight.textContent || '');
              parent.replaceChild(textNode, highlight);
              parent.normalize();
            }
          }, 3000);
        } catch (err) {
          console.warn('Failed to highlight keyword:', err);
        }
      }
    }, 500); // 给 ReactMarkdown 足够的时间渲染

    return () => clearTimeout(timer);
  }, [searchQuery, note?.content]);

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
          <span className="text-xs text-muted-foreground">
            {note.updated_at
              ? new Date(note.updated_at).toLocaleString()
              : ""}
          </span>
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


