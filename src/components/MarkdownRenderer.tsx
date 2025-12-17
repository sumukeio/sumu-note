"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";

// 轻量级 [[wikilink]] 解析：
// [[title]]              -> [title](/notes/title)
// [[noteId|显示名称]]    -> [显示名称](/notes/noteId)
function transformWikiLinks(markdown: string): string {
  if (!markdown) return "";

  return markdown.replace(
    /\[\[([^[\]|]+)(\|([^[\]]+))?\]\]/g,
    (_match, rawTarget: string, _pipe: string | undefined, display?: string) => {
      const target = String(rawTarget).trim();
      const label = (display ?? target).trim();

      if (!target) return label;

      const href = `/notes/${encodeURIComponent(target)}`;
      return `[${label}](${href})`;
    }
  );
}

const markdownComponents = {
  h1: ({ node, ...props }: any) => (
    <h1
      className="text-3xl font-bold mt-8 mb-4 border-b border-border/50 pb-2"
      {...props}
    />
  ),
  h2: ({ node, ...props }: any) => (
    <h2 className="text-2xl font-bold mt-6 mb-3" {...props} />
  ),
  h3: ({ node, ...props }: any) => (
    <h3 className="text-xl font-bold mt-5 mb-2" {...props} />
  ),
  p: ({ node, ...props }: any) => (
    <p className="mb-4 leading-7 text-muted-foreground" {...props} />
  ),
  ul: ({ node, ...props }: any) => (
    <ul className="list-disc list-inside mb-4 pl-2 space-y-1" {...props} />
  ),
  ol: ({ node, ...props }: any) => (
    <ol className="list-decimal list-inside mb-4 pl-2 space-y-1" {...props} />
  ),
  blockquote: ({ node, ...props }: any) => (
    <blockquote
      className="border-l-4 border-blue-500/50 pl-4 py-1 italic text-muted-foreground my-4 bg-accent/30 rounded-r"
      {...props}
    />
  ),
  img: ({ node, ...props }: any) => (
    <img
      className="rounded-lg shadow-md my-4 max-w-full"
      {...props}
    />
  ),
  code: ({ node, inline, ...props }: any) =>
    inline ? (
      <code
        className="bg-muted px-1.5 py-0.5 rounded font-mono text-sm border border-border text-pink-500"
        {...props}
      />
    ) : (
      // 注意：这里不能返回 <div>，否则会被包在 <p> 里触发 Hydration 报错
      <code
        className="block bg-zinc-950 text-zinc-50 p-4 rounded-lg my-4 overflow-x-auto border border-zinc-800 font-mono text-sm"
        {...props}
      />
    ),
  a: ({ node, href, ...props }: any) => {
    const isInternal =
      typeof href === "string" && href.startsWith("/notes/");

    const className =
      "inline-flex items-center rounded px-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors";

    if (isInternal && typeof href === "string") {
      return (
        <Link href={href} className={className}>
          {props.children}
        </Link>
      );
    }

    return (
      <a
        className="text-blue-500 hover:underline font-medium"
        target="_blank"
        rel="noopener noreferrer"
        href={href}
        {...props}
      />
    );
  },
};

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const transformed = React.useMemo(
    () => transformWikiLinks(content || ""),
    [content]
  );

  return (
    <ReactMarkdown components={markdownComponents}>
      {transformed || "*（暂无内容）*"}
    </ReactMarkdown>
  );
}


