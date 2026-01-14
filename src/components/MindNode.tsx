"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { MindNoteNodeTree } from "@/lib/mind-note-storage";
import { cn } from "@/lib/utils";

interface MindNodeProps {
  node: MindNoteNodeTree;
  depth?: number;
  onUpdate?: (nodeId: string, content: string) => void;
  onToggleExpand?: (nodeId: string) => void;
  onAddChild?: (parentId: string) => void;
  onAddSibling?: (nodeId: string) => void;
  onIndent?: (nodeId: string) => void;
  onOutdent?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
}

export default function MindNode({
  node,
  depth = 0,
  onUpdate,
  onToggleExpand,
  onAddChild,
  onAddSibling,
  onIndent,
  onOutdent,
  onDelete,
}: MindNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(node.content);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasChildren = node.children && node.children.length > 0;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditContent(node.content);
  };

  const handleSave = () => {
    if (onUpdate && editContent !== node.content) {
      onUpdate(node.id, editContent);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(node.content);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift + Tab: 提升层级
        onOutdent?.(node.id);
      } else {
        // Tab: 创建子节点
        onAddChild?.(node.id);
      }
    }
  };

  const handleBlur = () => {
    // 延迟处理，以便点击其他按钮时不会立即关闭
    setTimeout(() => {
      handleSave();
    }, 200);
  };

  const maxDepth = 10; // 最大深度限制
  const indentLevel = Math.min(depth, maxDepth);

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-2 rounded hover:bg-accent/50 group",
          depth > 0 && "ml-4"
        )}
        style={{ paddingLeft: `${indentLevel * 1}rem` }}
      >
        {/* 展开/折叠按钮 */}
        {hasChildren ? (
          <button
            onClick={() => onToggleExpand?.(node.id)}
            className="w-5 h-5 flex items-center justify-center shrink-0 hover:bg-accent rounded"
            aria-label={node.is_expanded ? "折叠" : "展开"}
          >
            {node.is_expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-5 h-5 shrink-0" />
        )}

        {/* 节点内容 */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="flex-1 px-2 py-1 text-sm border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <div
            className="flex-1 px-2 py-1 text-sm cursor-text min-h-[24px] flex items-center"
            onDoubleClick={handleDoubleClick}
          >
            {node.content || (
              <span className="text-muted-foreground italic">点击编辑...</span>
            )}
          </div>
        )}

        {/* 操作按钮（hover 时显示） */}
        {!isEditing && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
            {onAddChild && (
              <button
                onClick={() => onAddChild(node.id)}
                className="w-6 h-6 flex items-center justify-center hover:bg-accent rounded text-xs text-muted-foreground"
                title="添加子节点 (Tab)"
              >
                +
              </button>
            )}
            {onAddSibling && (
              <button
                onClick={() => onAddSibling(node.id)}
                className="w-6 h-6 flex items-center justify-center hover:bg-accent rounded text-xs text-muted-foreground"
                title="添加同级节点 (Enter)"
              >
                ⏎
              </button>
            )}
            {onOutdent && depth > 0 && (
              <button
                onClick={() => onOutdent(node.id)}
                className="w-6 h-6 flex items-center justify-center hover:bg-accent rounded text-xs text-muted-foreground"
                title="提升层级 (Shift+Tab)"
              >
                ←
              </button>
            )}
            {onIndent && (
              <button
                onClick={() => onIndent(node.id)}
                className="w-6 h-6 flex items-center justify-center hover:bg-accent rounded text-xs text-muted-foreground"
                title="降低层级"
              >
                →
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(node.id)}
                className="w-6 h-6 flex items-center justify-center hover:bg-red-500/10 rounded text-xs text-red-500"
                title="删除节点"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>

      {/* 子节点 */}
      {hasChildren && node.is_expanded && (
        <div className="ml-2">
          {node.children!.map((child) => (
            <MindNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onUpdate={onUpdate}
              onToggleExpand={onToggleExpand}
              onAddChild={onAddChild}
              onAddSibling={onAddSibling}
              onIndent={onIndent}
              onOutdent={onOutdent}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}




















