"use client";

import React, { createContext, useEffect, useMemo, useRef, useState, useContext } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useVirtualizer } from "@tanstack/react-virtual";
import { slugify, type OutlineItem } from "@/lib/outline-utils";
import { extractMarkdownTables } from "@/lib/table-layout";
import { getNoteTableLayout } from "@/lib/note-service";

interface MarkdownRendererProps {
  content: string;
  /** 可选：目录项，用于为标题生成唯一 id 便于目录跳转 */
  outline?: OutlineItem[];
  /** 可选：用于读取表格列宽元数据（note_table_layouts） */
  userId?: string;
  noteId?: string | null;
  /** 可选：虚拟滚动时使用的滚动容器 */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

function getHeadingText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(getHeadingText).join("");
  if (React.isValidElement(children)) {
    const props = children.props as { children?: React.ReactNode };
    if (props?.children) return getHeadingText(props.children);
  }
  return "";
}

export function MarkdownRenderer({ content, outline, userId, noteId, scrollContainerRef }: MarkdownRendererProps) {
  const router = useRouter();
  const headingIndexRef = useRef(0);
  headingIndexRef.current = 0;
  const tableIndexRef = useRef(0);
  tableIndexRef.current = 0;

  const [tableLayouts, setTableLayouts] = useState<
    Record<string, { colWidths: number[]; freezeFirstCol: boolean; loaded?: boolean }>
  >({});

  const tableCount = useMemo(() => extractMarkdownTables(content).length, [content]);
  const tableKeys = useMemo(() => {
    if (!tableCount) return [];
    return Array.from({ length: tableCount }, (_, i) => `t${i}`);
  }, [tableCount]);

  useEffect(() => {
    if (!userId || !noteId) return;
    if (tableKeys.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const key of tableKeys) {
        if (tableLayouts[key]?.loaded) continue;
        const row = await getNoteTableLayout(userId, noteId, key);
        if (cancelled) return;
        if (row) {
          setTableLayouts((prev) => ({
            ...prev,
            [key]: {
              colWidths: Array.isArray(row.col_widths) ? row.col_widths : [],
              freezeFirstCol: !!row.freeze_first_col,
              loaded: true,
            },
          }));
        } else {
          setTableLayouts((prev) => ({
            ...prev,
            [key]: prev[key] ?? { colWidths: [], freezeFirstCol: true, loaded: true },
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, noteId, tableKeys.join("|")]);

  const normalizeColWidths = (colCount: number, widths: number[]) => {
    const safe = widths.filter((n) => Number.isFinite(n) && n > 40);
    const next = safe.slice(0, colCount);
    while (next.length < colCount) next.push(160);
    return next;
  };

  const TableLayoutContext = useMemo(
    () =>
      createContext<{ colWidths: number[]; freezeFirstCol: boolean } | null>(
        null
      ),
    []
  );

  const useTableLayout = () => useContext(TableLayoutContext);

  // 处理双向链接：[[noteId|显示名称]] 或 [[笔记标题]]
  // 将 [[...]] 转换为 Markdown 链接格式 [...](...)
  const processWikiLinks = (text: string): string => {
    // 匹配 [[noteId|显示名称]] 或 [[笔记标题]]
    // 使用负向前瞻确保不会匹配嵌套的 [[]]
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    
    return text.replace(wikiLinkRegex, (match, linkContent) => {
      // 检查是否有 | 分隔符
      const parts = linkContent.split("|");
      const noteIdOrTitle = parts[0].trim();
      const displayName = parts.length > 1 ? parts[1].trim() : noteIdOrTitle;
      
      // 生成链接，使用 noteId 或编码后的标题
      const href = `/notes/${encodeURIComponent(noteIdOrTitle)}`;
      
      // 转换为 Markdown 链接格式
      return `[${displayName}](${href})`;
    });
  };

  // 处理后的内容
  const processedContent = processWikiLinks(content);

  const shouldVirtualize = processedContent.length > 50_000;

  const blocks = useMemo(() => {
    if (!shouldVirtualize) return [];
    const lines = processedContent.replace(/\r\n/g, "\n").split("\n");
    const res: Array<{ text: string; tableKeys: string[] }> = [];
    let i = 0;
    let globalTableIdx = 0;

    const isTableLine = (line: string) => /^\|[\s\S]*\|$/.test(line.trim());
    const isSeparatorLine = (line: string) => /^\|[\s-|:]*\|$/.test(line.trim());

    while (i < lines.length) {
      const line = lines[i];

      // code fence block
      if (/^\s*```/.test(line)) {
        const start = i;
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) i++;
        if (i < lines.length) i++;
        res.push({ text: lines.slice(start, i).join("\n"), tableKeys: [] });
        continue;
      }

      // table block
      if (isTableLine(line) && i + 1 < lines.length && isSeparatorLine(lines[i + 1])) {
        const start = i;
        i += 2;
        while (i < lines.length && isTableLine(lines[i])) i++;
        const key = `t${globalTableIdx++}`;
        res.push({ text: lines.slice(start, i).join("\n"), tableKeys: [key] });
        continue;
      }

      // paragraph / list block until blank line
      const start = i;
      while (i < lines.length && lines[i].trim() !== "") i++;
      const text = lines.slice(start, i).join("\n").trimEnd();
      if (text) res.push({ text, tableKeys: [] });
      while (i < lines.length && lines[i].trim() === "") i++;
    }

    return res;
  }, [processedContent, shouldVirtualize]);

  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? blocks.length : 0,
    getScrollElement: () => scrollContainerRef?.current ?? null,
    estimateSize: () => 140,
    overscan: 6,
  });

  return (
    <div 
      className="note-content prose prose-sm sm:prose-base dark:prose-invert max-w-none select-text"
      style={{ 
        userSelect: 'text', 
        WebkitUserSelect: 'text', 
        msUserSelect: 'text',
        fontSize: 'var(--note-font-size)',
        lineHeight: 'var(--note-line-height)',
        letterSpacing: 'var(--note-letter-spacing)',
      }}
      onTouchStart={(e) => {
        // 如果触摸的是链接，阻止事件冒泡到父级（避免触发右边缘滑动返回）
        const target = e.target as HTMLElement;
        if (target.tagName === 'A' || target.closest('a')) {
          e.stopPropagation();
        }
      }}
      onTouchEnd={(e) => {
        // 如果触摸的是链接，阻止事件冒泡到父级
        const target = e.target as HTMLElement;
        if (target.tagName === 'A' || target.closest('a')) {
          e.stopPropagation();
        }
      }}
    >
      {shouldVirtualize ? (
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualizer.getVirtualItems().map((v) => {
            const block = blocks[v.index];
            let localTableIdx = 0;
            const getNextTableKey = () => block.tableKeys[localTableIdx++] ?? `t${v.index}`;
            return (
              <div
                key={v.key}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${v.start}px)`,
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children, ...props }) => {
                      if (href?.startsWith("/notes/")) {
                        return (
                          <a
                            {...props}
                            href={href}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(href);
                            }}
                            className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline cursor-pointer touch-manipulation"
                          >
                            {children}
                          </a>
                        );
                      }
                      return (
                        <a
                          {...props}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline touch-manipulation"
                        >
                          {children}
                        </a>
                      );
                    },
                    h1: ({ children, ...props }) => {
                      const id = slugify(getHeadingText(children as React.ReactNode));
                      return (
                        <h1 {...props} id={id} className="scroll-mt-20">
                          {children}
                        </h1>
                      );
                    },
                    h2: ({ children, ...props }) => {
                      const id = slugify(getHeadingText(children as React.ReactNode));
                      return (
                        <h2 {...props} id={id} className="scroll-mt-20">
                          {children}
                        </h2>
                      );
                    },
                    h3: ({ children, ...props }) => {
                      const id = slugify(getHeadingText(children as React.ReactNode));
                      return (
                        <h3 {...props} id={id} className="scroll-mt-20">
                          {children}
                        </h3>
                      );
                    },
                    table: ({ children, ...props }) => {
                      const tableKey = getNextTableKey();
                      const layout = tableLayouts[tableKey] ?? { colWidths: [], freezeFirstCol: true };
                      const inferredColCount =
                        Array.isArray(layout.colWidths) && layout.colWidths.length > 0
                          ? layout.colWidths.length
                          : 0;
                      const colWidths = normalizeColWidths(inferredColCount, layout.colWidths);
                      const ctxValue = {
                        colWidths,
                        freezeFirstCol: layout.freezeFirstCol ?? true,
                      };
                      return (
                        <div className="relative my-4">
                          <div
                            className="overflow-x-auto overflow-y-visible"
                            style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
                          >
                            <TableLayoutContext.Provider value={ctxValue}>
                              <table
                                {...props}
                                className="min-w-max border-collapse border border-border w-full"
                              >
                                {colWidths.length > 0 && (
                                  <colgroup>
                                    {colWidths.map((w, i) => (
                                      <col key={i} style={{ width: `${w}px` }} />
                                    ))}
                                  </colgroup>
                                )}
                                {children}
                              </table>
                            </TableLayoutContext.Provider>
                          </div>
                        </div>
                      );
                    },
                    thead: ({ children, ...props }) => (
                      <thead {...props} className="sticky top-0 z-10 bg-muted/95 dark:bg-muted/95">
                        {children}
                      </thead>
                    ),
                    tr: ({ children, ...props }) => (
                      <tr {...props} className="border-b border-border">
                        {children}
                      </tr>
                    ),
                    th: ({ children, ...props }) => {
                      const layout = useTableLayout();
                      return (
                        <th
                          {...props}
                          className={[
                            "border border-border px-2 py-1.5 sm:px-4 sm:py-2 text-left text-xs sm:text-sm font-semibold whitespace-nowrap",
                            layout?.freezeFirstCol ? "first:sticky first:left-0 first:z-20 first:bg-muted/95" : "",
                          ].join(" ")}
                        >
                          {children}
                        </th>
                      );
                    },
                    td: ({ children, ...props }) => {
                      const layout = useTableLayout();
                      return (
                        <td
                          {...props}
                          className={[
                            "border border-border px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm",
                            layout?.freezeFirstCol ? "first:sticky first:left-0 first:z-10 first:bg-background" : "",
                          ].join(" ")}
                        >
                          {children}
                        </td>
                      );
                    },
                  }}
                >
                  {block.text}
                </ReactMarkdown>
              </div>
            );
          })}
        </div>
      ) : (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 自定义链接组件，处理内部链接跳转
          a: ({ href, children, ...props }) => {
            // 检查是否是内部笔记链接
            if (href?.startsWith("/notes/")) {
              return (
                <a
                  {...props}
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(href);
                  }}
                  onTouchStart={(e) => {
                    // 移动端触摸开始：阻止冒泡
                    e.stopPropagation();
                  }}
                  onTouchEnd={(e) => {
                    // 移动端触摸结束：执行跳转
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(href);
                  }}
                  className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline cursor-pointer touch-manipulation"
                  style={{ 
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'rgba(59, 130, 246, 0.2)',
                    display: 'inline-block',
                    padding: '4px 2px',
                    minHeight: '32px',
                    lineHeight: '1.5',
                  }}
                >
                  {children}
                </a>
              );
            }
            // 外部链接
            return (
              <a
                {...props}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                }}
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline touch-manipulation"
                style={{ 
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'rgba(59, 130, 246, 0.2)',
                  display: 'inline-block',
                  padding: '4px 2px',
                  minHeight: '32px',
                  lineHeight: '1.5',
                }}
              >
                {children}
              </a>
            );
          },
          // 标题带 id，供目录跳转（Task 7.5.3）
          h1: ({ children, ...props }) => {
            const idx = headingIndexRef.current++;
            const id = outline?.[idx]?.id ?? slugify(getHeadingText(children as React.ReactNode));
            return (
              <h1 {...props} id={id} className="scroll-mt-20">
                {children}
              </h1>
            );
          },
          h2: ({ children, ...props }) => {
            const idx = headingIndexRef.current++;
            const id = outline?.[idx]?.id ?? slugify(getHeadingText(children as React.ReactNode));
            return (
              <h2 {...props} id={id} className="scroll-mt-20">
                {children}
              </h2>
            );
          },
          h3: ({ children, ...props }) => {
            const idx = headingIndexRef.current++;
            const id = outline?.[idx]?.id ?? slugify(getHeadingText(children as React.ReactNode));
            return (
              <h3 {...props} id={id} className="scroll-mt-20">
                {children}
              </h3>
            );
          },
          // 自定义表格组件：移动端横向滚动 + 表头固定 + 列宽/首列冻结（若有元数据）
          table: ({ children, ...props }) => {
            const idx = tableIndexRef.current++;
            const tableKey = `t${idx}`;
            const layout = tableLayouts[tableKey] ?? { colWidths: [], freezeFirstCol: true };
            // 尝试从 thead 推断列数（fallback：以已有 widths 长度）
            const inferredColCount =
              Array.isArray(layout.colWidths) && layout.colWidths.length > 0
                ? layout.colWidths.length
                : 0;
            const colWidths = normalizeColWidths(inferredColCount, layout.colWidths);
            const ctxValue = {
              colWidths,
              freezeFirstCol: layout.freezeFirstCol ?? true,
            };
            return (
              <div className="relative my-4">
                <div
                  className="overflow-x-auto overflow-y-visible"
                  style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
                >
                  <TableLayoutContext.Provider value={ctxValue}>
                    <table
                      {...props}
                      className="min-w-max border-collapse border border-border w-full"
                    >
                      {colWidths.length > 0 && (
                        <colgroup>
                          {colWidths.map((w, i) => (
                            <col key={i} style={{ width: `${w}px` }} />
                          ))}
                        </colgroup>
                      )}
                      {children}
                    </table>
                  </TableLayoutContext.Provider>
                </div>
                <div
                  className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent sm:hidden"
                  aria-hidden
                />
              </div>
            );
          },
          thead: ({ children, ...props }) => (
            <thead {...props} className="sticky top-0 z-10 bg-muted/95 dark:bg-muted/95">
              {children}
            </thead>
          ),
          tbody: ({ children, ...props }) => (
            <tbody {...props}>
              {children}
            </tbody>
          ),
          tr: ({ children, ...props }) => (
            <tr {...props} className="border-b border-border">
              {children}
            </tr>
          ),
          th: ({ children, ...props }) => {
            const layout = useTableLayout();
            return (
              <th
                {...props}
                className={[
                  "border border-border px-2 py-1.5 sm:px-4 sm:py-2 text-left text-xs sm:text-sm font-semibold whitespace-nowrap",
                  layout?.freezeFirstCol ? "first:sticky first:left-0 first:z-20 first:bg-muted/95" : "",
                ].join(" ")}
              >
                {children}
              </th>
            );
          },
          td: ({ children, ...props }) => {
            const layout = useTableLayout();
            return (
              <td
                {...props}
                className={[
                  "border border-border px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm",
                  layout?.freezeFirstCol ? "first:sticky first:left-0 first:z-10 first:bg-background" : "",
                ].join(" ")}
              >
                {children}
              </td>
            );
          },
          // 列表与待办（Task 7.4.1）：统一块间距与层级
          ul: ({ children, ...props }) => (
            <ul
              {...props}
              className="my-4 ml-6 list-disc space-y-1.5"
              style={{
                marginTop: 'var(--note-block-margin)',
                marginBottom: 'var(--note-paragraph-spacing)',
              }}
            >
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol
              {...props}
              className="my-4 ml-6 list-decimal space-y-1.5"
              style={{
                marginTop: 'var(--note-block-margin)',
                marginBottom: 'var(--note-paragraph-spacing)',
              }}
            >
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li
              {...props}
              className="my-1.5"
              style={{
                lineHeight: 'var(--note-line-height)',
                letterSpacing: 'var(--note-letter-spacing)',
              }}
            >
              {children}
            </li>
          ),
          // 内容区域优化：段落间距（Task 7.4.1 / 7.5.1）
          p: ({ children, ...props }) => (
            <p
              {...props}
              className="my-4"
              style={{
                marginBottom: 'var(--note-paragraph-spacing)',
                lineHeight: 'var(--note-line-height)',
                letterSpacing: 'var(--note-letter-spacing)',
              }}
            >
              {children}
            </p>
          ),
          // 引用块（Task 7.4.1）
          blockquote: ({ children, ...props }) => (
            <blockquote
              {...props}
              className="border-l-4 border-border pl-4 my-4 py-1 text-muted-foreground italic"
              style={{
                marginBottom: 'var(--note-paragraph-spacing)',
                marginTop: 'var(--note-block-margin)',
              }}
            >
              {children}
            </blockquote>
          ),
          // 代码块（Task 7.4.1）
          pre: ({ children, ...props }) => (
            <pre
              {...props}
              className="my-4 p-4 rounded-lg bg-muted/80 overflow-x-auto text-sm"
              style={{
                marginBottom: 'var(--note-paragraph-spacing)',
                marginTop: 'var(--note-block-margin)',
                lineHeight: '1.6',
              }}
            >
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code {...props} className={className} style={{ fontSize: "0.9em" }}>
                  {children}
                </code>
              );
            }
            return (
              <code
                {...props}
                className="px-1.5 py-0.5 rounded bg-muted/80 text-sm font-mono"
              >
                {children}
              </code>
            );
          },
          // 分割线（Task 7.4.1）
          hr: ({ ...props }) => (
            <hr
              {...props}
              className="my-6 border-border"
              style={{
                marginTop: 'var(--note-block-margin)',
                marginBottom: 'var(--note-block-margin)',
              }}
            />
          ),
          // 图片独立块 + caption + 居中（Task 7.4.2）
          img: ({ src, alt, ...props }) => (
            <figure
              className="my-6 block"
              style={{
                marginTop: 'var(--note-block-margin)',
                marginBottom: 'var(--note-paragraph-spacing)',
              }}
            >
              <div className="flex justify-center">
                <img
                  {...props}
                  src={src}
                  alt={alt ?? ""}
                  className="max-w-full h-auto rounded-lg border border-border"
                />
              </div>
              {alt && (
                <figcaption className="text-center text-sm text-muted-foreground mt-2 px-2">
                  {alt}
                </figcaption>
              )}
            </figure>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
      )}
    </div>
  );
}
