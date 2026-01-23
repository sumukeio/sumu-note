"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronUp, ChevronDown, Search, Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  findAllMatches,
  getNextMatchIndex,
  getPreviousMatchIndex,
  replaceMatch,
  replaceAllMatches,
  type Match,
} from "@/lib/search-utils";

interface FindReplaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
  cursorPosition: number;
  onFind: (matches: Match[], currentIndex: number) => void;
  onReplace: (newText: string, nextMatchIndex: number) => void;
  onReplaceAll: (newText: string) => void;
  mode?: "find" | "replace"; // 查找模式或替换模式
}

/**
 * 查找替换对话框组件
 * 固定在编辑器顶部，支持查找和替换功能
 */
export default function FindReplaceDialog({
  isOpen,
  onClose,
  text,
  cursorPosition,
  onFind,
  onReplace,
  onReplaceAll,
  mode = "find",
}: FindReplaceDialogProps) {
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isReplaceMode, setIsReplaceMode] = useState(mode === "replace");
  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // 当打开时，聚焦到查找输入框
  useEffect(() => {
    if (isOpen && findInputRef.current) {
      findInputRef.current.focus();
      findInputRef.current.select();
    }
  }, [isOpen]);

  // 当模式改变时，更新状态
  useEffect(() => {
    setIsReplaceMode(mode === "replace");
  }, [mode]);

  // 查找匹配项
  useEffect(() => {
    if (!findQuery.trim()) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      onFind([], -1);
      return;
    }

    const newMatches = findAllMatches(text, findQuery, caseSensitive);
    setMatches(newMatches);

    // 根据光标位置确定当前匹配项
    let newIndex = -1;
    if (newMatches.length > 0) {
      // 找到光标位置之后或包含光标位置的第一个匹配项
      for (let i = 0; i < newMatches.length; i++) {
        if (cursorPosition <= newMatches[i].end) {
          newIndex = i;
          break;
        }
      }
      // 如果光标在所有匹配项之后，选择第一个
      if (newIndex === -1) {
        newIndex = 0;
      }
    }

    setCurrentMatchIndex(newIndex);
    onFind(newMatches, newIndex);
    // 注意：onFind 应该用 useCallback 包装，这里不包含在依赖项中以避免无限循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findQuery, text, caseSensitive, cursorPosition]);

  // 处理键盘事件
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc 键关闭
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Ctrl+F 或 Cmd+F 打开查找（由父组件处理）
      // Ctrl+H 或 Cmd+H 打开替换（由父组件处理）

      // Enter 键：在查找模式下跳转到下一个，在替换模式下执行替换
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (isReplaceMode && replaceInputRef.current === document.activeElement) {
          handleReplace();
        } else if (matches.length > 0) {
          handleNext();
        }
        return;
      }

      // Shift+Enter 键：跳转到上一个
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        if (matches.length > 0) {
          handlePrevious();
        }
        return;
      }

      // F3 键：下一个匹配项
      if (e.key === "F3" && !e.shiftKey) {
        e.preventDefault();
        if (matches.length > 0) {
          handleNext();
        }
        return;
      }

      // Shift+F3 键：上一个匹配项
      if (e.key === "F3" && e.shiftKey) {
        e.preventDefault();
        if (matches.length > 0) {
          handlePrevious();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, matches, isReplaceMode, onClose]);

  const handleNext = () => {
    if (matches.length === 0) return;
    const nextIndex = getNextMatchIndex(currentMatchIndex, matches);
    setCurrentMatchIndex(nextIndex);
    onFind(matches, nextIndex);
  };

  const handlePrevious = () => {
    if (matches.length === 0) return;
    const prevIndex = getPreviousMatchIndex(currentMatchIndex, matches);
    setCurrentMatchIndex(prevIndex);
    onFind(matches, prevIndex);
  };

  const handleReplace = () => {
    if (matches.length === 0 || currentMatchIndex < 0) return;

    const { newText, newMatchIndex } = replaceMatch(
      text,
      findQuery,
      replaceQuery,
      currentMatchIndex,
      caseSensitive
    );

    onReplace(newText, newMatchIndex);
    setCurrentMatchIndex(newMatchIndex);
  };

  const handleReplaceAll = () => {
    if (matches.length === 0) return;

    const newText = replaceAllMatches(text, findQuery, replaceQuery, caseSensitive);
    onReplaceAll(newText);
    setMatches([]);
    setCurrentMatchIndex(-1);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-50 bg-background border-b border-border shadow-lg">
      {/* 移动端：查找为主，替换按需展开 */}
      <div className="flex flex-col sm:hidden gap-2 p-2">
        {/* 第一行：查找输入框 + 基本控制 */}
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            ref={findInputRef}
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            placeholder="查找..."
            className="h-8 flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (matches.length > 0) {
                  handleNext();
                }
              } else if (e.key === "Enter" && e.shiftKey) {
                e.preventDefault();
                if (matches.length > 0) {
                  handlePrevious();
                }
              }
            }}
          />
          {/* 匹配项数量 */}
          {findQuery && (
            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              {matches.length > 0
                ? `${currentMatchIndex + 1}/${matches.length}`
                : "0/0"}
            </span>
          )}
          {/* 上一个/下一个按钮 */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handlePrevious}
              disabled={matches.length === 0}
              title="上一个"
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleNext}
              disabled={matches.length === 0}
              title="下一个"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
          {/* 展开替换行按钮（默认只显示查找，点击后出现替换行） */}
          {!isReplaceMode && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={() => setIsReplaceMode(true)}
              title="显示替换"
            >
              <Replace className="w-3 h-3 mr-1" />
              替换
            </Button>
          )}
          {/* 关闭按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onClose}
            title="关闭"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* 第二行：替换输入框（仅在替换模式下显示） */}
        {isReplaceMode && (
          <div className="flex items-center gap-2">
            <Replace className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              ref={replaceInputRef}
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="替换为..."
              className="h-8 flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleReplace();
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleReplace}
              disabled={matches.length === 0 || currentMatchIndex < 0}
              className="h-8 shrink-0"
            >
              替换
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReplaceAll}
              disabled={matches.length === 0}
              className="h-8 shrink-0"
            >
              全部替换
            </Button>
            {/* 收起替换行按钮，回到仅查找模式 */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={() => setIsReplaceMode(false)}
              title="仅查找"
            >
              <Search className="w-3 h-3 mr-1" />
              查找
            </Button>
          </div>
        )}

        {/* 第三行：选项 */}
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="w-3 h-3"
            />
            区分大小写
          </label>
        </div>
      </div>

      {/* 桌面端：单行布局 */}
      <div className="hidden sm:flex items-center gap-2 p-2">
        {/* 查找输入框 */}
        <div className="flex-1 flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            ref={findInputRef}
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            placeholder="查找..."
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (matches.length > 0) {
                  handleNext();
                }
              } else if (e.key === "Enter" && e.shiftKey) {
                e.preventDefault();
                if (matches.length > 0) {
                  handlePrevious();
                }
              }
            }}
          />
          {/* 匹配项数量 */}
          {findQuery && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {matches.length > 0
                ? `${currentMatchIndex + 1}/${matches.length}`
                : "0/0"}
            </span>
          )}
          {/* 上一个/下一个按钮 */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handlePrevious}
              disabled={matches.length === 0}
              title="上一个 (Shift+Enter)"
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleNext}
              disabled={matches.length === 0}
              title="下一个 (Enter)"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 替换输入框（仅在替换模式下显示） */}
        {isReplaceMode && (
          <div className="flex-1 flex items-center gap-2">
            <Replace className="w-4 h-4 text-muted-foreground" />
            <Input
              ref={replaceInputRef}
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="替换为..."
              className="h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleReplace();
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleReplace}
              disabled={matches.length === 0 || currentMatchIndex < 0}
              className="h-8"
            >
              替换
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReplaceAll}
              disabled={matches.length === 0}
              className="h-8"
            >
              全部替换
            </Button>
          </div>
        )}

        {/* 切换查找/替换模式按钮 */}
        {!isReplaceMode && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setIsReplaceMode(true)}
            title="切换到替换模式"
          >
            <Replace className="w-3 h-3 mr-1" />
            替换
          </Button>
        )}

        {/* 切换回查找模式按钮（仅在替换模式下显示） */}
        {isReplaceMode && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setIsReplaceMode(false)}
            title="切换到查找模式"
          >
            <Search className="w-3 h-3 mr-1" />
            查找
          </Button>
        )}

        {/* 大小写敏感选项（可选） */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="w-3 h-3"
            />
            区分大小写
          </label>
        </div>

        {/* 关闭按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
          title="关闭 (Esc)"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
