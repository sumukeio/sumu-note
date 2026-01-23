"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { detectTableAtCursor, tableDataToMarkdown } from "@/lib/table-utils";
import InlineTableEditor from "./InlineTableEditor";

interface HybridEditorProps {
  content: string;
  cursorPosition: number;
  onChange: (value: string) => void;
  onCursorChange: (position: number) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
}

/**
 * 混合编辑器：在 Textarea 中嵌入可视化表格编辑器
 * 当光标在表格内时，显示为可编辑的 HTML 表格
 */
export default function HybridEditor({
  content,
  cursorPosition,
  onChange,
  onCursorChange,
  onKeyDown,
  placeholder,
  className,
}: HybridEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showTableEditor, setShowTableEditor] = useState(false);
  const [tableStartPos, setTableStartPos] = useState(0);
  const [tableEndPos, setTableEndPos] = useState(0);
  const [beforeTable, setBeforeTable] = useState("");
  const [afterTable, setAfterTable] = useState("");

  // 检测光标是否在表格内
  const tableInfo = useMemo(
    () => detectTableAtCursor(content, cursorPosition),
    [content, cursorPosition]
  );

  // 当检测到表格时，计算表格在内容中的位置
  useEffect(() => {
    if (tableInfo && textareaRef.current) {
      const lines = content.split("\n");
      let pos = 0;
      
      // 计算表格开始位置
      for (let i = 0; i < tableInfo.startLine; i++) {
        pos += lines[i].length + 1; // +1 for newline
      }
      setTableStartPos(pos);
      
      // 计算表格结束位置
      let endPos = pos;
      for (let i = tableInfo.startLine; i <= tableInfo.endLine; i++) {
        endPos += lines[i].length + 1;
      }
      setTableEndPos(endPos - 1); // -1 to exclude the last newline
      
      // 分割内容
      setBeforeTable(content.slice(0, pos));
      setAfterTable(content.slice(endPos));
      
      setShowTableEditor(true);
    } else {
      setShowTableEditor(false);
    }
  }, [tableInfo, content]);

  // 处理表格更新
  const handleTableUpdate = useCallback(
    (newContent: string, newCursorPosition: number) => {
      // 合并表格前后的内容
      const fullContent = beforeTable + newContent + afterTable;
      onChange(fullContent);
      
      // 更新光标位置
      setTimeout(() => {
        if (textareaRef.current) {
          const adjustedPosition = beforeTable.length + newCursorPosition;
          textareaRef.current.setSelectionRange(adjustedPosition, adjustedPosition);
          onCursorChange(adjustedPosition);
        }
      }, 0);
    },
    [beforeTable, afterTable, onChange, onCursorChange]
  );

  // 处理文本区域的变化
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart || 0;
    
    onChange(newValue);
    onCursorChange(newCursorPos);
  };

  // 处理文本区域的选择变化
  const handleTextareaSelect = () => {
    if (textareaRef.current) {
      const pos = textareaRef.current.selectionStart || 0;
      onCursorChange(pos);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 如果按了方向键或点击，更新光标位置
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      setTimeout(() => {
        if (textareaRef.current) {
          const pos = textareaRef.current.selectionStart || 0;
          onCursorChange(pos);
        }
      }, 0);
    }
    
    onKeyDown?.(e);
  };

  // 如果不在表格内，显示普通 Textarea
  if (!showTableEditor || !tableInfo) {
    return (
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleTextareaChange}
        onSelect={handleTextareaSelect}
        onKeyDown={handleKeyDown}
        onClick={handleTextareaSelect}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  // 在表格内，显示混合编辑器
  return (
    <div ref={containerRef} className="relative">
      {/* 表格前的文本 */}
      {beforeTable && (
        <textarea
          ref={textareaRef}
          value={beforeTable}
          onChange={(e) => {
            const newBefore = e.target.value;
            onChange(newBefore + content.slice(tableStartPos) + afterTable);
          }}
          onKeyDown={handleKeyDown}
          onSelect={handleTextareaSelect}
          onClick={handleTextareaSelect}
          placeholder={placeholder}
          className={className}
          style={{ marginBottom: 0 }}
        />
      )}
      
      {/* 可视化表格编辑器 */}
      <InlineTableEditor
        content={content}
        cursorPosition={cursorPosition}
        onUpdate={handleTableUpdate}
        onBlur={() => {
          // 表格失焦时，可能需要隐藏表格编辑器，但这里我们保持显示
        }}
      />
      
      {/* 表格后的文本 */}
      {afterTable && (
        <textarea
          value={afterTable}
          onChange={(e) => {
            const newAfter = e.target.value;
            onChange(beforeTable + content.slice(0, tableEndPos + 1) + newAfter);
          }}
          onKeyDown={handleKeyDown}
          onSelect={handleTextareaSelect}
          onClick={handleTextareaSelect}
          className={className}
          style={{ marginTop: 0 }}
        />
      )}
    </div>
  );
}
