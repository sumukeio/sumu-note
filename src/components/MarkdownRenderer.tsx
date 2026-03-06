"use client";

import React, { useRef } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { slugify, type OutlineItem } from "@/lib/outline-utils";

interface MarkdownRendererProps {
  content: string;
  /** 可选：目录项，用于为标题生成唯一 id 便于目录跳转 */
  outline?: OutlineItem[];
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

export function MarkdownRenderer({ content, outline }: MarkdownRendererProps) {
  const router = useRouter();
  const headingIndexRef = useRef(0);
  headingIndexRef.current = 0;

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
      <ReactMarkdown
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
          // 自定义表格组件，确保表格正确渲染
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table
                {...props}
                className="min-w-full border-collapse border border-border"
              >
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead {...props} className="bg-accent/50">
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
          th: ({ children, ...props }) => (
            <th
              {...props}
              className="border border-border px-4 py-2 text-left font-semibold"
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              {...props}
              className="border border-border px-4 py-2"
            >
              {children}
            </td>
          ),
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
    </div>
  );
}
