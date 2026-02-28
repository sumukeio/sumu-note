"use client";

import { useState, useEffect, useCallback } from "react";
import type { Note } from "@/types/note";

/**
 * [[ 链接补全：检测最后一个未闭合的 `[[`，维护补全列表与选中项，
 * 插入时通过 onContentReplace 把最终 content 交给父组件。
 */
export function useLinkComplete(
  content: string,
  notes: Note[],
  onContentReplace: (newContent: string) => void
) {
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkInsertStart, setLinkInsertStart] = useState<number | null>(null);
  const [linkCursorPos, setLinkCursorPos] = useState<number | null>(null);
  const [linkActiveIndex, setLinkActiveIndex] = useState(0);

  // 内容变化时检测最后一个未闭合的 [[
  useEffect(() => {
    const lastOpenBracket = content.lastIndexOf("[[");
    const lastCloseBracket = content.lastIndexOf("]]");
    if (lastOpenBracket !== -1 && (lastCloseBracket === -1 || lastCloseBracket < lastOpenBracket)) {
      const rawQuery = content.slice(lastOpenBracket + 2).trim();
      setLinkMenuOpen(true);
      setLinkQuery(rawQuery);
      setLinkInsertStart(lastOpenBracket);
      setLinkCursorPos(content.length);
      setLinkActiveIndex(0);
    } else {
      setLinkMenuOpen(false);
      setLinkQuery("");
      setLinkInsertStart(null);
      setLinkCursorPos(null);
    }
  }, [content]);

  const linkCandidates = notes
    .filter((n) => !n.is_deleted)
    .filter((n) => {
      if (!linkQuery) return true;
      const q = linkQuery.toLowerCase();
      return (
        (n.title ?? "").toLowerCase().includes(q) ||
        (n.content ?? "").toLowerCase().includes(q)
      );
    })
    .slice(0, 20);

  const handleInsertLink = useCallback(
    (noteToLink: Note) => {
      if (linkInsertStart == null || linkCursorPos == null) return;
      const before = content.slice(0, linkInsertStart);
      const after = content.slice(linkCursorPos);
      const label = noteToLink.title || "未命名笔记";
      const insertText = `[[${noteToLink.id}|${label}]]`;
      const nextContent = before + insertText + after;
      onContentReplace(nextContent);
      setLinkMenuOpen(false);
      setLinkQuery("");
      setLinkInsertStart(null);
      setLinkCursorPos(null);
    },
    [content, linkInsertStart, linkCursorPos, onContentReplace]
  );

  // 键盘：↑↓ 选择，Enter 确认，Escape 关闭
  useEffect(() => {
    if (!linkMenuOpen || linkCandidates.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setLinkActiveIndex((prev) => (prev + 1) % linkCandidates.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setLinkActiveIndex((prev) => (prev - 1 + linkCandidates.length) % linkCandidates.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = linkCandidates[linkActiveIndex];
        if (target) handleInsertLink(target);
      } else if (e.key === "Escape") {
        setLinkMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [linkMenuOpen, linkCandidates, linkActiveIndex, handleInsertLink]);

  return {
    linkMenuOpen,
    linkQuery,
    linkInsertStart,
    linkCursorPos,
    linkCandidates,
    linkActiveIndex,
    handleInsertLink,
  };
}
