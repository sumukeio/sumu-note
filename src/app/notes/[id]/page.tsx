"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { getNoteByIdOrTitle, getBacklinks } from "@/lib/note-service";
import type { Note } from "@/types/note";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Link2, Loader2, ChevronUp, ChevronDown, X, Edit } from "lucide-react";
import { findAllMatches, getNextMatchIndex, getPreviousMatchIndex, type Match } from "@/lib/search-utils";
import { cn } from "@/lib/utils";

interface BacklinkItem {
  id: string;
  title: string | null;
  content: string | null;
  updated_at: string | null;
}

function NoteDetailPageContent() {
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
        const targetNote = await getNoteByIdOrTitle(noteIdOrTitle);
        if (!targetNote) {
          setError("未找到这篇笔记");
          setLoading(false);
          setLoadingBacklinks(false);
          return;
        }

        setNote(targetNote);
        setLoading(false);

        const idPattern = `%[[${targetNote.id}%`;
        const titlePattern = targetNote.title ? `%[[${targetNote.title}]]%` : null;
        const backlinksData = await getBacklinks(targetNote.id, idPattern, titlePattern);

        setBacklinks(backlinksData?.length ? backlinksData : []);
      } catch (err: unknown) {
        console.error(err);
        setError((err as Error)?.message || "加载笔记失败");
      } finally {
        setLoadingBacklinks(false);
      }
    };

    run();
  }, [noteIdOrTitle]);

  // 当搜索查询变化时，重置滚动标志，确保能定位到第一个匹配项
  useEffect(() => {
    if (searchQuery.trim()) {
      hasScrolledRef.current = false;
    }
  }, [searchQuery]);

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

    // 等待 ReactMarkdown 渲染完成，增加延迟确保 DOM 完全渲染
    const timer = setTimeout(() => {
      if (!contentRef.current) return;

      const query = searchQuery.trim();
      // 使用 search-utils 查找所有匹配项（基于纯文本）
      const textMatches = findAllMatches(note.content ?? "", query, false);
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
        {
          acceptNode: (node) => {
            // 跳过已经在 mark 标签内的文本节点（避免重复高亮）
            let parent = node.parentElement;
            while (parent && parent !== contentRef.current) {
              if (parent.tagName === 'MARK' && parent.classList.contains('search-match')) {
                return NodeFilter.FILTER_REJECT;
              }
              parent = parent.parentElement;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
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
            
            // 检查范围是否有效且不在已有的高亮内
            if (range.collapsed) {
              searchIndex += query.length;
              continue;
            }
            
            const highlight = document.createElement('mark');
            highlight.className = 'bg-yellow-200 dark:bg-yellow-900 px-0.5 rounded search-match';
            highlight.style.scrollMarginTop = '100px';
            highlight.setAttribute('data-search-match', 'true');
            
            range.surroundContents(highlight);
            newHighlights.push(highlight);
            searchIndex += query.length;
          } catch (e) {
            // 如果无法包围（跨节点），尝试使用更精确的方法
            try {
              const range = document.createRange();
              range.setStart(node, searchIndex);
              range.setEnd(node, Math.min(searchIndex + query.length, nodeText.length));
              
              if (!range.collapsed) {
                const highlight = document.createElement('mark');
                highlight.className = 'bg-yellow-200 dark:bg-yellow-900 px-0.5 rounded search-match';
                highlight.style.scrollMarginTop = '100px';
                highlight.setAttribute('data-search-match', 'true');
                
                const contents = range.extractContents();
                highlight.appendChild(contents);
                range.insertNode(highlight);
                newHighlights.push(highlight);
              }
            } catch (e2) {
              // 如果还是失败，跳过这个匹配
            }
            searchIndex += query.length;
          }
        }
      }

      setHighlightElements(newHighlights);
      
      // 如果有匹配项，滚动到第一个（首次进入时）
      if (textMatches.length > 0 && !hasScrolledRef.current) {
        setCurrentMatchIndex(0);
        // 使用 requestAnimationFrame 确保 DOM 更新完成
        requestAnimationFrame(() => {
          setTimeout(() => {
            scrollToMatch(0, newHighlights);
            hasScrolledRef.current = true;
          }, 100);
        });
      } else if (textMatches.length > 0) {
        // 如果已经滚动过，确保当前索引有效
        if (currentMatchIndex < 0 || currentMatchIndex >= newHighlights.length) {
          setCurrentMatchIndex(0);
        }
        requestAnimationFrame(() => {
          scrollToMatch(currentMatchIndex >= 0 ? currentMatchIndex : 0, newHighlights);
        });
      }
    }, 600); // 增加延迟确保 markdown 完全渲染

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery, note?.content]);

  // 滚动到指定匹配项
  const scrollToMatch = (index: number, highlights: HTMLElement[] = highlightElements) => {
    if (index < 0 || index >= highlights.length) return;
    
    const highlight = highlights[index];
    if (highlight && highlight.isConnected) {
      // 移除所有高亮的当前样式
      highlights.forEach((el) => {
        if (el.isConnected) {
          el.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
        }
      });
      
      // 添加当前高亮的样式
      highlight.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
      
      // 使用 scrollIntoView 定位，并添加一些偏移
      highlight.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
      
      // 确保高亮元素在可视区域内（处理可能的布局偏移）
      setTimeout(() => {
        const rect = highlight.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        if (rect.top < 100 || rect.bottom > viewportHeight - 100) {
          highlight.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      }, 100);
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

  const handleEdit = () => {
    if (!note) return;
    // 跳转到 dashboard 并打开笔记编辑模式
    const params = new URLSearchParams();
    if (note.folder_id) {
      params.set('folder', note.folder_id);
    }
    params.set('note', note.id);
    router.push(`/dashboard?${params.toString()}`);
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
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-2 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 min-h-10 touch-manipulation shrink-0"
              onClick={handleBack}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Button>
            <Button
              variant="default"
              size="sm"
              className="min-h-10 touch-manipulation shrink-0"
              onClick={handleEdit}
            >
              <Edit className="w-4 h-4 mr-1" />
              编辑
            </Button>
          </div>
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
            className="prose prose-sm sm:prose-base dark:prose-invert max-w-none select-text"
            style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
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

export default function NoteDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <NoteDetailPageContent />
    </Suspense>
  );
}
