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
    <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
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
                    router.push(href);
                  }}
                  className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline cursor-pointer"
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
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
