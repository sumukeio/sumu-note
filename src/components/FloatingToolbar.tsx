"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Link, Code, Quote, Copy, AlignLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingToolbarProps {
  selectedText: string;
  position: { top: number; left: number; bottom?: number } | null; // 添加 bottom 用于判断是否覆盖选中文本
  onFormat: (type: 'bold' | 'italic' | 'link' | 'code' | 'quote') => void;
  onClose: () => void;
  context?: 'text' | 'code' | 'table'; // 智能工具栏：上下文感知
}

export default function FloatingToolbar({
  selectedText,
  position,
  onFormat,
  onClose,
  context = 'text', // 默认文本上下文
}: FloatingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{ top: number; left: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (position && selectedText.trim()) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [position, selectedText]);

  useEffect(() => {
    if (!position || !toolbarRef.current) {
      setAdjustedPosition(null);
      return;
    }

    // 使用 requestAnimationFrame 确保 DOM 已渲染
    requestAnimationFrame(() => {
      if (!toolbarRef.current) return;
      
      const toolbar = toolbarRef.current;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 12;
      const toolbarOffset = 8; // 工具栏与选中文本的间距

      // 获取工具栏实际尺寸
      const rect = toolbar.getBoundingClientRect();
      const toolbarHeight = rect.height || 48; // 工具栏实际高度
      const toolbarWidth = rect.width || 200; // 工具栏实际宽度

      // 获取选中文本的位置信息
      const selectionTop = position.top;
      const selectionBottom = position.bottom || position.top + 24; // 如果没有传递 bottom，使用估算值
      
      // 优先显示在选中文本上方
      let top = selectionTop - toolbarHeight - toolbarOffset;
      let preferredPosition: 'above' | 'below' = 'above';

      // 检查上方空间是否足够（考虑视口边界和选中文本位置）
      const minTopSpace = padding;
      if (top < minTopSpace) {
        // 上方空间不足，显示在下方
        top = selectionBottom + toolbarOffset;
        preferredPosition = 'below';
      }

      // 水平位置：选中文本的中心位置（工具栏在此基础上居中）
      let left = position.left - toolbarWidth / 2;
      
      // 确保不超出右边界
      if (left + toolbarWidth > viewportWidth - padding) {
        left = viewportWidth - toolbarWidth - padding;
      }
      // 确保不超出左边界
      if (left < padding) {
        left = padding;
      }

      // 最终垂直位置调整：确保不超出视口，且不覆盖选中文本
      if (preferredPosition === 'above') {
        // 如果在上方，确保工具栏底部不覆盖选中文本顶部
        if (top + toolbarHeight > selectionTop - toolbarOffset) {
          // 如果会覆盖，改为显示在下方
          top = selectionBottom + toolbarOffset;
          preferredPosition = 'below';
        }
      } else {
        // 如果在下方，确保工具栏顶部不覆盖选中文本底部
        if (top < selectionBottom + toolbarOffset) {
          // 如果会覆盖，调整位置
          top = selectionBottom + toolbarOffset;
        }
      }

      // 确保不超出视口底部
      if (top + toolbarHeight > viewportHeight - padding) {
        // 如果下方空间也不足，尝试显示在上方（即使空间紧张）
        if (preferredPosition === 'below') {
          top = selectionTop - toolbarHeight - toolbarOffset;
          // 如果上方也不够，至少保证不覆盖选中文本
          if (top + toolbarHeight > selectionTop - toolbarOffset) {
            top = Math.max(padding, selectionTop - toolbarHeight - toolbarOffset);
          }
        } else {
          top = viewportHeight - toolbarHeight - padding;
        }
      }

      // 确保不超出视口顶部
      if (top < padding) {
        top = padding;
      }

      setAdjustedPosition({ top, left });
    });
  }, [position]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        // 如果点击的不是文本选择区域，关闭工具栏
        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === '') {
          onClose();
        }
      }
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === '') {
        onClose();
      }
    };

    if (position) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('selectionchange', handleSelectionChange);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [position, onClose]);

  // 如果位置已设置但调整后的位置还未计算，先显示在原始位置
  if (!position || !selectedText.trim() || !isVisible) {
    return null;
  }
  
  // 如果调整后的位置还未计算，使用原始位置
  const finalPosition = adjustedPosition || position;

  return (
    <div
      ref={toolbarRef}
      className={cn(
        "fixed z-[100] flex items-center gap-1 rounded-lg border border-border bg-popover/95 backdrop-blur-sm shadow-lg px-2 py-1.5",
        // 过渡动画优化：浮动工具栏 - 淡入 + 上滑 200ms ease-out
        "animate-in fade-in-0 slide-in-from-bottom-2 duration-200 ease-out"
      )}
      style={{
        top: `${finalPosition.top}px`,
        left: `${finalPosition.left}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onFormat('bold')}
        title="加粗 (Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onFormat('italic')}
        title="斜体 (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onFormat('link')}
        title="插入链接 (Ctrl+K)"
      >
        <Link className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onFormat('code')}
        title="代码块 (Ctrl+Shift+K)"
      >
        <Code className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onFormat('quote')}
        title="引用"
      >
        <Quote className="w-4 h-4" />
      </Button>
      {/* 智能工具栏：根据上下文显示不同工具 */}
      {context === 'code' && (
        <>
          <div className="w-[1px] h-6 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              // 复制代码块
              navigator.clipboard.writeText(selectedText);
            }}
            title="复制代码"
          >
            <Copy className="w-4 h-4" />
          </Button>
        </>
      )}
      {context === 'table' && (
        <>
          <div className="w-[1px] h-6 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              // 表格格式化（通过父组件处理）
              onFormat('code'); // 临时使用，后续可以扩展
            }}
            title="格式化表格"
          >
            <AlignLeft className="w-4 h-4" />
          </Button>
        </>
      )}
    </div>
  );
}

