"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { MindNoteNodeTree } from "@/lib/mind-note-storage";
import { cn } from "@/lib/utils";
import MindNodeContent from "./MindNodeContent";

interface DraggableMindNodeProps {
  node: MindNoteNodeTree;
  depth?: number;
  onUpdate?: (nodeId: string, content: string) => void;
  onToggleExpand?: (nodeId: string) => void;
  onAddChild?: (parentId: string) => void;
  onAddSibling?: (nodeId: string) => void;
  onIndent?: (nodeId: string) => void;
  onOutdent?: (nodeId: string) => void;
  onDelete?: (nodeId: string, skipConfirm?: boolean) => void;
  onSelect?: (nodeId: string) => void;
  isSelected?: boolean;
  selectedNodeId?: string | null;
  editingNodeId?: string | null;
  onEditStart?: (nodeId: string) => void;
  onEditEnd?: () => void;
  parentExpanded?: boolean; // 父节点是否展开
  isLastChild?: boolean; // 是否是最后一个子节点
  fontSize?: number; // 字体大小
}

export default function DraggableMindNode({
  node,
  depth = 0,
  onUpdate,
  onToggleExpand,
  onAddChild,
  onAddSibling,
  onIndent,
  onOutdent,
  onDelete,
  onSelect,
  isSelected = false,
  selectedNodeId,
  editingNodeId,
  onEditStart,
  onEditEnd,
  parentExpanded = true,
  isLastChild = false,
  fontSize = 14,
}: DraggableMindNodeProps) {
  const isEditing = editingNodeId === node.id;
  const [editContent, setEditContent] = useState(node.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasChildren = node.children && node.children.length > 0;

  // 拖拽配置
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id: node.id,
    data: {
      type: "mind-node",
      node,
      depth,
    },
  });

  // 放置配置 - 作为子节点（拖到节点上）
  const {
    setNodeRef: setChildDroppableRef,
    isOver: isOverAsChild,
  } = useDroppable({
    id: `drop-child-${node.id}`,
    data: {
      type: "mind-node-child",
      node,
      depth,
    },
  });

  // 放置配置 - 作为同级节点（拖到节点后）
  const {
    setNodeRef: setSiblingDroppableRef,
    isOver: isOverAsSibling,
  } = useDroppable({
    id: `drop-sibling-${node.id}`,
    data: {
      type: "mind-node-sibling",
      node,
      depth,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  // 当节点内容变化时，同步编辑内容
  useEffect(() => {
    if (!isEditing) {
      setEditContent(node.content);
    }
  }, [node.content, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // 将光标移到末尾，避免全选导致覆盖
      const endPos = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(endPos, endPos);
      // 自动调整高度
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [isEditing, editContent]);

  // 避免同一快捷键瞬间被触发多次（键盘抖动或重复事件）
  const actionLockRef = useRef(false);
  const runActionOnce = (cb: () => void) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    cb();
    setTimeout(() => {
      actionLockRef.current = false;
    }, 120);
  };
  
  // 暴露编辑方法给父组件（用于工具栏）
  useEffect(() => {
    if (isSelected && !isEditing) {
      // 如果节点被选中，可以通过外部触发编辑
      // 这个逻辑在 MindNoteEditor 中处理
    }
  }, [isSelected, isEditing]);

  const handleClick = (e: React.MouseEvent) => {
    // 如果点击的是按钮或拖拽手柄，不触发编辑
    if (
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest("[data-drag-handle]")
    ) {
      return;
    }
    
    // 如果点击的是内容区域，进入编辑模式
    const contentArea = (e.target as HTMLElement).closest(".node-content-area");
    if (contentArea && !isEditing) {
      onEditStart?.(node.id);
      setEditContent(node.content);
      return;
    }
    
    // PC端和移动端：点击节点区域选择节点（用于快捷键操作）
    if (onSelect && !isEditing) {
      onSelect(node.id);
    }
  };

  const handleSave = () => {
    if (onUpdate && editContent !== node.content) {
      onUpdate(node.id, editContent);
    }
    onEditEnd?.();
  };

  const handleCancel = () => {
    setEditContent(node.content);
    onEditEnd?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // Ctrl+A / Cmd+A: 全选当前节点内容
    if ((e.ctrlKey || e.metaKey) && e.key === "a") {
      e.preventDefault();
      if (textareaRef.current) {
        textareaRef.current.select();
      }
      return;
    }
    
    // Shift + Enter: 换行（默认行为）
    if (e.shiftKey && e.key === "Enter") {
      return; // 允许换行
    }
    
    // Enter: PC端保存并在下方创建同级节点，移动端保存并创建同级节点
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      handleSave();
      runActionOnce(() => {
        setTimeout(() => {
          onAddSibling?.(node.id);
        }, 50);
      });
      return;
    }
    
    // Escape: 取消编辑
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
      return;
    }
    
    // Tab: PC端保存并在下方创建子节点，Shift+Tab 提升层级
    if (e.key === "Tab") {
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab: 提升层级
        handleSave();
        runActionOnce(() => {
          setTimeout(() => {
            onOutdent?.(node.id);
          }, 50);
        });
      } else {
        // Tab: 保存并创建子节点
        handleSave();
        runActionOnce(() => {
          setTimeout(() => {
            onAddChild?.(node.id);
          }, 50);
        });
      }
      return;
    }
    
    // Backspace: 当内容为空时，删除节点
    if (e.key === "Backspace" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const textarea = e.target as HTMLTextAreaElement;
      const cursorPosition = textarea.selectionStart;
      
      // 如果光标在开头，且内容为空或只有空白字符，删除节点
      if (cursorPosition === 0 && editContent.trim() === "") {
        e.preventDefault();
        
        // 保存当前编辑，然后删除节点
        // 父组件会处理确认逻辑（如果有子节点会弹出确认对话框）
        handleSave();
        setTimeout(() => {
          // 如果有子节点，父组件的 handleDeleteNode 会弹出确认对话框
          // 如果没有子节点，直接删除（skipConfirm=true）
          const shouldSkipConfirm = !hasChildren || !node.children || node.children.length === 0;
          onDelete?.(node.id, shouldSkipConfirm);
        }, 100);
        return;
      }
    }
  };
  
  // 处理粘贴事件，支持纯文本粘贴
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    // 默认行为已经可以处理粘贴，这里可以添加额外的处理逻辑
    // 例如：清理格式、处理换行等
    const pastedText = e.clipboardData.getData("text/plain");
    // 可以在这里对粘贴的内容进行处理
    // 例如：移除多余的换行、格式化等
  };

  const handleBlur = () => {
    setTimeout(() => {
      handleSave();
    }, 200);
  };

  const maxDepth = 10;
  // 飞书风格的缩进：每级缩进 24px (1.5rem)
  const indentLevel = Math.min(depth, maxDepth);
  const containerRef = useRef<HTMLDivElement>(null);
  const verticalLineRef = useRef<HTMLDivElement>(null);
  const childrenContainerRef = useRef<HTMLDivElement>(null);

  // 合并 refs
  const setRefs = (element: HTMLDivElement | null) => {
    setDraggableRef(element);
    containerRef.current = element;
  };

  // 计算并更新竖线高度：从当前节点的圆点位置延伸到最后一个子节点
  useEffect(() => {
    if (!hasChildren || !node.is_expanded) {
      if (verticalLineRef.current) {
        verticalLineRef.current.style.display = 'none';
      }
      return;
    }

    // 延迟计算，确保 DOM 已渲染
    const timer = setTimeout(() => {
      if (!containerRef.current || !verticalLineRef.current || !childrenContainerRef.current) return;

      const children = Array.from(childrenContainerRef.current.children) as HTMLElement[];
      if (children.length === 0) {
        verticalLineRef.current.style.display = 'none';
        return;
      }

      // 使用相对位置计算竖线高度
      const containerHeight = containerRef.current.offsetHeight;
      const dotY = containerHeight / 2; // 圆点位置（节点中间）
      
      // 找到最后一个子节点的容器
      const lastChildContainer = children[children.length - 1].querySelector('[data-node-container]') || children[children.length - 1];
      const lastChildRect = lastChildContainer.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      
      // 计算竖线高度：从圆点位置到最后一个子节点的底部
      const lineBottom = lastChildRect.bottom - containerRect.top;
      const lineHeight = lineBottom - dotY;
      
      if (lineHeight > 0) {
        verticalLineRef.current.style.display = 'block';
        verticalLineRef.current.style.height = `${lineHeight}px`;
        verticalLineRef.current.style.top = `${dotY}px`; // 从圆点位置开始
      } else {
        verticalLineRef.current.style.display = 'none';
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [hasChildren, node.is_expanded, node.children]);

  return (
    <div
      className="select-none relative group/node"
      data-node-container
      style={style}
    >
      {/* 上半部分 drop zone - 作为子节点 */}
      <div
        ref={setChildDroppableRef}
        className={cn(
          "absolute left-0 right-0 top-0 h-1/2 z-10 pointer-events-none transition-all",
          isOverAsChild && !isDragging && "pointer-events-auto bg-green-500/30 border-t-2 border-green-500 shadow-lg"
        )}
        style={{ paddingLeft: `${indentLevel * 1.5}rem` }}
      />
      
      {/* 下半部分 drop zone - 作为同级节点 */}
      <div
        ref={setSiblingDroppableRef}
        className={cn(
          "absolute left-0 right-0 bottom-0 h-1/2 z-10 pointer-events-none transition-all",
          isOverAsSibling && !isDragging && "pointer-events-auto bg-blue-500/30 border-b-2 border-blue-500 shadow-lg"
        )}
        style={{ paddingLeft: `${indentLevel * 1.5}rem` }}
      />
      
      <div
        ref={setRefs}
        data-node-id={node.id}
        style={{ paddingLeft: `${indentLevel * 1.5}rem`, fontSize: `${fontSize}px` }}
        onClick={handleClick}
        className={cn(
          "flex items-center py-0.5 pr-2 cursor-pointer relative z-0 transition-colors",
          isDragging && "z-50 opacity-50",
          isSelected && "bg-muted/30 ring-1 ring-blue-500/50"
        )}
      >
        {/* 展开/折叠按钮 + 黑色圆点（飞书风格交互） */}
        {hasChildren ? (
          <div className="relative flex items-center group/caret">
            {/* 提示气泡：仅在靠近折叠标志时显示 */}
            <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg bg-black text-white text-[11px] leading-none shadow-md opacity-0 group-hover/caret:opacity-100 transition-opacity whitespace-nowrap">
              {node.is_expanded ? "折叠" : "展开"}
            </div>
            {/* 折叠/展开标志：默认隐藏，鼠标靠近时出现 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand?.(node.id);
              }}
              className="w-6 h-6 flex items-center justify-center shrink-0 rounded-full bg-muted/0 hover:bg-muted/70 transition-colors opacity-0 group-hover/caret:opacity-100 -ml-1"
              aria-label={node.is_expanded ? "折叠" : "展开"}
            >
              {node.is_expanded ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground/80" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground/80" />
              )}
            </button>
            {/* 黑色圆点：拖拽手柄 - 固定位置，确保所有节点对齐 */}
            <div
              {...listeners}
              {...attributes}
              data-drag-handle
              className="w-2 h-2 rounded-full bg-neutral-900 cursor-grab active:cursor-grabbing touch-none shrink-0"
              style={{ marginLeft: '0.25rem', marginRight: '0.25rem' }}
              title="拖拽移动"
            />
          </div>
        ) : (
          <div className="flex items-center">
            {/* 占位空间，确保圆点位置与有子节点时一致 */}
            <div className="w-6 h-6 shrink-0" />
            {/* 黑色圆点：拖拽手柄 - 固定位置，确保所有节点对齐 */}
            <div
              {...listeners}
              {...attributes}
              data-drag-handle
              className="w-2 h-2 rounded-full bg-neutral-900 cursor-grab active:cursor-grabbing touch-none shrink-0"
              style={{ marginLeft: '0.25rem', marginRight: '0.25rem' }}
              title="拖拽移动"
            />
          </div>
        )}

        {/* 节点内容：飞书风格，完全无边框 */}
        {isEditing ? (
          <textarea
            ref={textareaRef}
            data-node-id={node.id}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onPaste={handlePaste}
            className="flex-1 px-0 py-0 bg-transparent border-none outline-none focus-visible:ring-0 focus-visible:outline-none resize-none min-h-[20px] max-h-[200px] overflow-y-auto text-foreground"
            style={{ fontSize: `${fontSize}px` }}
            rows={1}
            onInput={(e) => {
              // 自动调整高度
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
            }}
          />
        ) : (
          <div
            className="node-content-area flex-1 px-0 py-0 cursor-text min-h-[20px] flex items-center text-foreground"
            style={{ fontSize: `${fontSize}px` }}
            onClick={(e) => {
              // 阻止事件冒泡，避免触发父级的点击选择
              e.stopPropagation();
              onEditStart?.(node.id);
              setEditContent(node.content);
            }}
          >
            {node.content && (
              <MindNodeContent content={node.content} isEditing={false} />
            )}
          </div>
        )}

        {/* 操作按钮：放大点击区域，提升易用性 */}
        {!isEditing && (
          <div className="opacity-0 group-hover/node:opacity-100 transition-opacity flex items-center gap-1 shrink-0 ml-2">
            {onAddChild && (
              <button
                onClick={() => onAddChild(node.id)}
                className="w-7 h-7 flex items-center justify-center hover:bg-muted/60 rounded-full text-sm text-muted-foreground/80 hover:text-foreground transition-colors"
                title="添加子节点 (Tab)"
              >
                +
              </button>
            )}
            {onAddSibling && (
              <button
                onClick={() => onAddSibling(node.id)}
                className="w-7 h-7 flex items-center justify-center hover:bg-muted/60 rounded-full text-sm text-muted-foreground/80 hover:text-foreground transition-colors"
                title="添加同级节点 (Enter)"
              >
                ⏎
              </button>
            )}
            {onOutdent && depth > 0 && (
              <button
                onClick={() => onOutdent(node.id)}
                className="w-7 h-7 flex items-center justify-center hover:bg-muted/60 rounded-full text-sm text-muted-foreground/80 hover:text-foreground transition-colors"
                title="提升层级 (Shift+Tab)"
              >
                ←
              </button>
            )}
            {onIndent && (
              <button
                onClick={() => onIndent(node.id)}
                className="w-7 h-7 flex items-center justify-center hover:bg-muted/60 rounded-full text-sm text-muted-foreground/80 hover:text-foreground transition-colors"
                title="降低层级"
              >
                →
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(node.id)}
                className="w-7 h-7 flex items-center justify-center hover:bg-red-500/10 rounded-full text-sm text-red-500/80 hover:text-red-600 transition-colors"
                title="删除节点"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>

      {/* 竖线：从当前节点的圆点位置延伸到最后一个子节点，保持垂直对齐 */}
      {hasChildren && node.is_expanded && (
        <div
          ref={verticalLineRef}
          className="absolute w-px bg-neutral-900 pointer-events-none"
          style={{
            // 圆点中心位置计算：
            // paddingLeft (indentLevel * 1.5rem) + 占位空间(1.5rem) + 圆点左边距(0.25rem) + 圆点宽度的一半(0.125rem)
            // = indentLevel * 1.5rem + 1.5rem + 0.25rem + 0.125rem
            // = indentLevel * 1.5rem + 1.875rem
            left: `${indentLevel * 1.5 + 1.875}rem`,
            top: "50%", // 从圆点位置开始
            height: "0px", // 初始高度为 0，由 useEffect 动态计算
            display: "none",
          }}
        />
      )}

      {/* 子节点：飞书风格，无竖线，只用缩进 */}
      {hasChildren && node.is_expanded && (
        <div ref={childrenContainerRef} data-children-container>
          {node.children!.map((child, index) => (
            <DraggableMindNode
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
              onSelect={onSelect}
              isSelected={selectedNodeId === child.id}
              selectedNodeId={selectedNodeId}
              editingNodeId={editingNodeId}
              onEditStart={onEditStart}
              onEditEnd={onEditEnd}
              parentExpanded={node.is_expanded}
              isLastChild={index === node.children!.length - 1}
              fontSize={fontSize}
            />
          ))}
        </div>
      )}
    </div>
  );
}

