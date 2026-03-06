"use client";

/**
 * 移动端键盘上方常驻编辑工具栏（Task 7.3.x）
 * - 有选区时：展示格式化操作（加粗、斜体、链接、引用、代码）
 * - 无选区时：展示插入块入口（+ 展开：标题、列表、待办、引用、代码块、图片、链接）
 */
import { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Link,
  Code,
  Quote,
  Plus,
  Heading1,
  List,
  ListTodo,
  Image as ImageIcon,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FormatType = "bold" | "italic" | "link" | "code" | "quote";
export type InsertBlockType =
  | "heading"
  | "list"
  | "todo"
  | "quote"
  | "code"
  | "image"
  | "link";

export interface MobileEditorToolbarProps {
  /** 当前是否有选区 */
  hasSelection: boolean;
  /** 格式化回调（有选区时使用） */
  onFormat: (type: FormatType) => void;
  /** 插入块回调（无选区时使用） */
  onInsertBlock: (type: InsertBlockType) => void;
  /** 点击图片时触发（由父组件打开 file input） */
  onInsertImage?: () => void;
  /** 是否显示（写作模式且移动端） */
  visible: boolean;
}

const INSERT_BLOCK_OPTIONS: { type: InsertBlockType; label: string; icon: React.ReactNode }[] = [
  { type: "heading", label: "标题", icon: <Heading1 className="w-4 h-4" /> },
  { type: "list", label: "列表", icon: <List className="w-4 h-4" /> },
  { type: "todo", label: "待办", icon: <ListTodo className="w-4 h-4" /> },
  { type: "quote", label: "引用", icon: <Quote className="w-4 h-4" /> },
  { type: "code", label: "代码块", icon: <Code className="w-4 h-4" /> },
  { type: "image", label: "图片", icon: <ImageIcon className="w-4 h-4" /> },
  { type: "link", label: "链接", icon: <Link className="w-4 h-4" /> },
];

export default function MobileEditorToolbar({
  hasSelection,
  onFormat,
  onInsertBlock,
  onInsertImage,
  visible,
}: MobileEditorToolbarProps) {
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!insertMenuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setInsertMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [insertMenuOpen]);

  const handleInsertBlock = (type: InsertBlockType) => {
    if (type === "image" && onInsertImage) {
      onInsertImage();
    } else {
      onInsertBlock(type);
    }
    setInsertMenuOpen(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed left-0 right-0 z-40 flex items-center justify-center border-t border-border bg-background/95 backdrop-blur-sm safe-area-inset-bottom"
      style={{
        bottom: "var(--vv-bottom-inset, 0px)",
        paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto scrollbar-hide max-w-full">
        {hasSelection ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 touch-manipulation"
              onClick={() => onFormat("bold")}
              title="加粗"
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 touch-manipulation"
              onClick={() => onFormat("italic")}
              title="斜体"
            >
              <Italic className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 touch-manipulation"
              onClick={() => onFormat("link")}
              title="链接"
            >
              <Link className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 touch-manipulation"
              onClick={() => onFormat("code")}
              title="代码"
            >
              <Code className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 touch-manipulation"
              onClick={() => onFormat("quote")}
              title="引用"
            >
              <Quote className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <>
            <div className="relative" ref={menuRef}>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 gap-1.5 shrink-0 touch-manipulation",
                  insertMenuOpen && "bg-accent"
                )}
                onClick={() => setInsertMenuOpen((v) => !v)}
                title="插入"
              >
                <Plus className="w-4 h-4" />
                <span className="text-xs">插入</span>
                <ChevronDown
                  className={cn("w-3.5 h-3.5 transition-transform", insertMenuOpen && "rotate-180")}
                />
              </Button>
              {insertMenuOpen && (
                <div
                  className="absolute bottom-full left-0 mb-1 py-2 px-1 rounded-lg border border-border bg-popover shadow-lg min-w-[140px] animate-in fade-in-0 slide-in-from-bottom-2 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  {INSERT_BLOCK_OPTIONS.map(({ type, label, icon }) => (
                    <button
                      key={type}
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent rounded-md touch-manipulation"
                      onClick={() => handleInsertBlock(type)}
                    >
                      {icon}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
