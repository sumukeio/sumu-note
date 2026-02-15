"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const router = useRouter();

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
      className="prose prose-sm sm:prose-base dark:prose-invert max-w-none select-text"
      style={{ 
        userSelect: 'text', 
        WebkitUserSelect: 'text', 
        msUserSelect: 'text',
        // 内容区域优化：行高 1.75，字间距 0.01em，段落间距 1.5rem
        lineHeight: '1.75',
        letterSpacing: '0.01em',
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
          // 内容区域优化：列表样式优化（更清晰的层级关系）
          ul: ({ children, ...props }) => (
            <ul
              {...props}
              className="my-4 ml-6 list-disc space-y-2"
              style={{ marginBottom: '1.5rem' }}
            >
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol
              {...props}
              className="my-4 ml-6 list-decimal space-y-2"
              style={{ marginBottom: '1.5rem' }}
            >
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li
              {...props}
              className="my-1"
              style={{ 
                lineHeight: '1.75',
                letterSpacing: '0.01em'
              }}
            >
              {children}
            </li>
          ),
          // 内容区域优化：段落间距
          p: ({ children, ...props }) => (
            <p
              {...props}
              className="my-4"
              style={{ 
                marginBottom: '1.5rem',
                lineHeight: '1.75',
                letterSpacing: '0.01em'
              }}
            >
              {children}
            </p>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
