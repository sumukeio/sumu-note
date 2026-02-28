"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type OnContentReplace = (newContent: string) => void;

function isWhitespace(ch: string | undefined) {
  return ch == null || ch === "" || /\s/.test(ch);
}

/**
 * # 标签补全：检测最后一个“正在输入中的 #tag”，维护候选与选中项，
 * 插入时通过 onContentReplace 把最终 content 交给父组件。
 *
 * 约束：由于编辑器可能由多个 textarea 组成，这里按“内容末尾”近似光标位置。
 */
export function useTagComplete(
  content: string,
  allTags: string[],
  onContentReplace: OnContentReplace
) {
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [tagInsertStart, setTagInsertStart] = useState<number | null>(null);
  const [tagCursorPos, setTagCursorPos] = useState<number | null>(null);
  const [tagActiveIndex, setTagActiveIndex] = useState(0);

  useEffect(() => {
    // 找到最后一个 '#'，要求其前面是空白/行首，且后面不是空格（避免 Markdown 标题 "# "）
    const lastHash = content.lastIndexOf("#");
    if (lastHash === -1) {
      setTagMenuOpen(false);
      setTagQuery("");
      setTagInsertStart(null);
      setTagCursorPos(null);
      return;
    }

    const prev = content[lastHash - 1];
    const next = content[lastHash + 1];
    const rawQuery = content.slice(lastHash + 1);

    const isHeading = next === " " || next === "\t";
    const queryHasSpace = /\s/.test(rawQuery);
    const validPrefix = isWhitespace(prev);

    if (validPrefix && !isHeading && !queryHasSpace) {
      setTagMenuOpen(true);
      setTagQuery(rawQuery.trim());
      setTagInsertStart(lastHash);
      setTagCursorPos(content.length);
      setTagActiveIndex(0);
    } else {
      setTagMenuOpen(false);
      setTagQuery("");
      setTagInsertStart(null);
      setTagCursorPos(null);
    }
  }, [content]);

  const tagCandidates = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    return allTags
      .filter((t) => {
        if (!q) return true;
        return t.toLowerCase().includes(q);
      })
      .slice(0, 10);
  }, [allTags, tagQuery]);

  const handleInsertTag = useCallback(
    (tag: string) => {
      if (tagInsertStart == null || tagCursorPos == null) return;
      const before = content.slice(0, tagInsertStart);
      const after = content.slice(tagCursorPos);
      const insertText = `#${tag} `;
      const nextContent = before + insertText + after;
      onContentReplace(nextContent);
      setTagMenuOpen(false);
      setTagQuery("");
      setTagInsertStart(null);
      setTagCursorPos(null);
    },
    [content, onContentReplace, tagCursorPos, tagInsertStart]
  );

  // 键盘：↑↓ 选择，Enter 确认，Escape 关闭
  useEffect(() => {
    if (!tagMenuOpen || tagCandidates.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setTagActiveIndex((prev) => (prev + 1) % tagCandidates.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setTagActiveIndex((prev) => (prev - 1 + tagCandidates.length) % tagCandidates.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = tagCandidates[tagActiveIndex];
        if (target) handleInsertTag(target);
      } else if (e.key === "Escape") {
        setTagMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tagMenuOpen, tagCandidates, tagActiveIndex, handleInsertTag]);

  return {
    tagMenuOpen,
    tagQuery,
    tagInsertStart,
    tagCursorPos,
    tagCandidates,
    tagActiveIndex,
    handleInsertTag,
  };
}

