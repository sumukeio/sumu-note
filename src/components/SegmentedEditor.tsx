"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X, Trash2, Minus, XCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { detectTableAtCursor, tableDataToMarkdown } from "@/lib/table-utils";
import FloatingToolbar from "@/components/FloatingToolbar";

interface SegmentedEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  placeholder?: string;
  className?: string;
  onInsertTable?: () => void; // 插入表格的回调，用于直接创建表格段
}

interface Segment {
  type: "text" | "table";
  content: string;
  tableData?: string[][];
  startPos: number;
  endPos: number;
}

/**
 * 分段编辑器
 * 将内容分为文本段和表格段，表格直接渲染为 HTML table
 */
export default function SegmentedEditor({
  content,
  onChange,
  placeholder,
  className,
  onInsertTable,
}: SegmentedEditorProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());
  const pendingUpdateRef = useRef<string | null>(null);
  const [linkConfirmOpen, setLinkConfirmOpen] = useState(false);
  const [pendingLinkToken, setPendingLinkToken] = useState<string | null>(null);
  
  // 保存光标位置和滚动位置，用于移动端编辑后恢复
  const savedCursorStateRef = useRef<{
    segmentIndex: number;
    cursorPosition: number;
    scrollTop: number;
    scrollLeft: number;
  } | null>(null);
  const activeTextareaIndexRef = useRef<number | null>(null);
  const segmentsLengthRef = useRef(0); // 跟踪 segments 长度，避免无限循环
  const hasRestoredRef = useRef(false); // 跟踪是否已恢复光标位置，避免重复恢复
  const lastInputTimeRef = useRef<number>(0); // 记录最后一次输入的时间
  const restoreCursorTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 光标恢复的防抖定时器
  const isTypingRef = useRef<boolean>(false); // 标记是否正在输入
  
  // 浮动工具栏相关状态
  const [selectedText, setSelectedText] = useState("");
  const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number; bottom?: number } | null>(null);
  const [toolbarContext, setToolbarContext] = useState<'text' | 'code' | 'table'>('text');
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const autoResizeTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    // 让 textarea 随内容自动增高（避免“框框很小/写很多也不变大”）
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const extractTokenAtCursor = useCallback((text: string, cursor: number) => {
    if (!text) return "";
    // 分隔符：空白、括号、引号、逗号、中文标点等
    // 注意：保留 URL 常见字符（:/?&=#.%_-）不要作为分隔符
    const isBoundary = (ch: string) =>
      /\s/.test(ch) ||
      ch === "(" ||
      ch === ")" ||
      ch === "[" ||
      ch === "]" ||
      ch === "{" ||
      ch === "}" ||
      ch === '"' ||
      ch === "'" ||
      ch === "<" ||
      ch === ">" ||
      ch === "," ||
      ch === "，" ||
      ch === "。" ||
      ch === "！" ||
      ch === "？" ||
      ch === "；" ||
      ch === "：" ||
      ch === "、";
    let l = cursor;
    let r = cursor;
    while (l > 0 && !isBoundary(text[l - 1])) l--;
    while (r < text.length && !isBoundary(text[r])) r++;
    return text.slice(l, r);
  }, []);

  const openSmartLink = useCallback((raw: string) => {
    const token = raw.trim();
    if (!token) return false;

    // 1) URL
    if (/^https?:\/\/\S+$/i.test(token)) {
      window.open(token, "_blank", "noopener,noreferrer");
      return true;
    }

    // 2) Wiki link: [[id]] or [[id|label]]
    const wikiMatch = token.match(/^\[\[([^\]|]+)(\|[^\]]+)?\]\]$/);
    if (wikiMatch) {
      const noteIdOrTitle = wikiMatch[1].trim();
      const href = `/notes/${encodeURIComponent(noteIdOrTitle)}`;
      window.open(href, "_blank", "noopener,noreferrer");
      return true;
    }

    return false;
  }, []);

  const confirmAndOpenSmartLink = useCallback(
    (raw: string) => {
      const token = raw.trim();
      if (!token) return false;
      setPendingLinkToken(token);
      setLinkConfirmOpen(true);
      return true;
    },
    []
  );

  // 检查一行是否是表格行（包括分隔行）
  const isTableLine = useCallback((line: string): boolean => {
    const trimmed = line.trim();
    return /^\|[\s\S]*\|$/.test(trimmed);
  }, []);

  // 检查一行是否是表格数据行（不包括分隔行）
  const isTableDataRow = useCallback((line: string): boolean => {
    const trimmed = line.trim();
    return /^\|[\s\S]*\|$/.test(trimmed) && !/^\|[\s-|:]*\|$/.test(trimmed);
  }, []);

  // 解析内容为段
  const parseContent = useCallback((text: string): Segment[] => {
    if (!text.trim()) {
      return [{ type: "text", content: "", startPos: 0, endPos: 0 }];
    }

    const lines = text.split("\n");
    const result: Segment[] = [];
    let currentText = "";
    let i = 0;
    const processedLines = new Set<number>(); // 跟踪已处理的行，避免重复处理

    while (i < lines.length) {
      // 如果这行已经被处理过（作为表格的一部分），跳过
      if (processedLines.has(i)) {
        i++;
        continue;
      }

      const line = lines[i];
      const trimmed = line.trim();

      // 检查是否是表格数据行（不是分隔行）
      if (isTableDataRow(trimmed)) {
        // 保存之前的文本段
        if (currentText.trim()) {
          result.push({
            type: "text",
            content: currentText.trim(),
            startPos: 0,
            endPos: 0,
          });
          currentText = "";
        }

        // 查找表格的完整范围
        // 向上查找表格开始（但不要超过已处理的文本段）
        let tableStartLine = i;
        while (tableStartLine > 0 && isTableLine(lines[tableStartLine - 1].trim()) && !processedLines.has(tableStartLine - 1)) {
          tableStartLine--;
        }
        
        // 向下查找表格结束（包括分隔行和表格行）
        let tableEndLine = i;
        while (tableEndLine < lines.length - 1 && isTableLine(lines[tableEndLine + 1].trim())) {
          tableEndLine++;
        }

        // 标记这些行为已处理
        for (let j = tableStartLine; j <= tableEndLine; j++) {
          processedLines.add(j);
        }

        // 解析表格数据（跳过分隔行）
        const tableLines = lines.slice(tableStartLine, tableEndLine + 1);
        const rows: string[][] = [];
        let colCount = 0;

        for (const tableLine of tableLines) {
          const tableLineTrimmed = tableLine.trim();
          // 跳过分隔行（|--|--| 或 |:--|:--| 等）
          if (tableLineTrimmed.match(/^\|[\s-|:]*\|$/)) {
            continue;
          }
          // 处理表格数据行
          if (isTableDataRow(tableLineTrimmed)) {
            // 使用 split('|') 分割，但保留空单元格
            const parts = tableLineTrimmed.split('|');
            // 移除首尾的空元素（因为 |a|b| 分割后会得到 ['', 'a', 'b', '']）
            const cells = parts.slice(1, -1).map(cell => cell.trim());
            // 即使所有单元格都是空的，也要保留这一行（确保空行不被过滤）
            // 只要 cells 数组有元素（即有列），就应该添加这一行
            if (cells.length > 0) {
              rows.push(cells);
              colCount = Math.max(colCount, cells.length);
            } else if (parts.length > 2) {
              // 处理完全空行的情况：|  |  | 会得到 ['', ' ', ' ', '']，slice(1, -1) 后是 [' ', ' ']，trim 后是 ['', '']
              // 但如果 parts.length > 2，说明至少有一个单元格分隔符，应该保留这一行
              const emptyCells = new Array(parts.length - 2).fill('');
              rows.push(emptyCells);
              colCount = Math.max(colCount, emptyCells.length);
            }
          }
        }

        // 确保所有行的列数一致
        rows.forEach(row => {
          while (row.length < colCount) {
            row.push('');
          }
        });

        // 只有当找到至少一行数据时才创建表格段
        if (rows.length > 0) {
          result.push({
            type: "table",
            content: "",
            tableData: rows,
            startPos: 0,
            endPos: 0,
          });
          i = tableEndLine + 1;
          continue;
        }
      }

      // 普通文本行
      currentText += lines[i] + "\n";
      i++;
    }

    // 保存最后的文本段
    if (currentText.trim() || result.length === 0) {
      result.push({
        type: "text",
        content: currentText.trim(),
        startPos: 0,
        endPos: 0,
      });
    }

    return result;
  }, [isTableLine, isTableDataRow]);

  // 将段转换回 Markdown
  const segmentsToMarkdown = useCallback((segments: Segment[]): string => {
    return segments
      .map((segment) => {
        if (segment.type === "table" && segment.tableData) {
          return tableDataToMarkdown(segment.tableData);
        }
        return segment.content;
      })
      .join("\n\n");
  }, []);

  // 插入新表格段（直接创建可视化表格，不通过 Markdown）
  const insertTableSegment = useCallback(() => {
    setSegments((prevSegments) => {
      // 创建默认的 2x2 表格
      const defaultTableData: string[][] = [
        ["", ""],
        ["", ""],
      ];
      
      const newTableSegment: Segment = {
        type: "table",
        content: "",
        tableData: defaultTableData,
        startPos: 0,
        endPos: 0,
      };

      // 如果最后一个段是文本段，在它后面添加表格
      // 否则创建一个新的文本段 + 表格段
      const newSegments = [...prevSegments];
      if (newSegments.length > 0 && newSegments[newSegments.length - 1].type === "text") {
        // 在最后一个文本段后添加表格
        newSegments.push(newTableSegment);
      } else {
        // 创建文本段 + 表格段
        newSegments.push(
          { type: "text", content: "", startPos: 0, endPos: 0 },
          newTableSegment
        );
      }

      pendingUpdateRef.current = segmentsToMarkdown(newSegments);
      return newSegments;
    });
  }, [segmentsToMarkdown]);

  // 使用 ref 暴露插入表格方法给父组件
  const insertTableRef = useRef<(() => void) | null>(null);
  insertTableRef.current = insertTableSegment;

  useEffect(() => {
    // 将插入表格方法暴露给父组件
    (window as any).__segmentedEditorInsertTable = () => {
      if (insertTableRef.current) {
        insertTableRef.current();
      }
    };
    return () => {
      delete (window as any).__segmentedEditorInsertTable;
    };
  }, []);

  // 用于跟踪是否是由内部操作触发的更新（避免循环更新）
  const isInternalUpdateRef = useRef(false);

  // 恢复光标位置和滚动位置（需要在 useEffect 之前定义）
  const restoreCursorPosition = useCallback(() => {
    const saved = savedCursorStateRef.current;
    if (!saved) return;
    
    const textarea = textareaRefs.current.get(saved.segmentIndex);
    if (!textarea) return;
    
    // 恢复滚动位置
    textarea.scrollTop = saved.scrollTop;
    textarea.scrollLeft = saved.scrollLeft;
    
    // 恢复光标位置
    const restoreCursor = () => {
      if (textarea && saved.cursorPosition <= textarea.value.length) {
        textarea.setSelectionRange(saved.cursorPosition, saved.cursorPosition);
        // 确保光标在可视区域内
        const textareaRect = textarea.getBoundingClientRect();
        const container = textarea.parentElement?.parentElement;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          // 如果光标不在可视区域内，滚动到光标位置
          if (textarea.scrollTop === saved.scrollTop) {
            // 计算光标在 textarea 中的位置
            const textBeforeCursor = textarea.value.substring(0, saved.cursorPosition);
            const lines = textBeforeCursor.split('\n');
            const lineHeight = 20; // 估算行高
            const cursorTop = (lines.length - 1) * lineHeight;
            
            // 如果光标在可视区域外，滚动到光标位置
            if (cursorTop < textarea.scrollTop || cursorTop > textarea.scrollTop + textarea.clientHeight) {
              textarea.scrollTop = Math.max(0, cursorTop - textarea.clientHeight / 2);
            }
          }
        }
      }
    };
    
    // 立即尝试恢复
    restoreCursor();
    
    // 使用 requestAnimationFrame 确保 DOM 已更新
    requestAnimationFrame(() => {
      restoreCursor();
      requestAnimationFrame(() => {
        restoreCursor();
      });
    });
    
    // 移动端键盘弹出后可能需要延迟恢复
    setTimeout(restoreCursor, 50);
    setTimeout(restoreCursor, 200);
  }, []);

  // 初始化解析内容
  useEffect(() => {
    // 如果是由内部操作触发的更新，不重新解析（避免覆盖内部状态）
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    const parsed = parseContent(content);
    setSegments(parsed);
  }, [content, parseContent]);

  // 处理待更新的内容（避免在渲染期间更新父组件）
  // 使用独立的 effect 来处理 pendingUpdateRef，不依赖 segments
  // 使用轮询机制定期检查 pendingUpdateRef，避免依赖 segments 导致无限循环
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (pendingUpdateRef.current !== null) {
        const markdown = pendingUpdateRef.current;
        pendingUpdateRef.current = null;
        // 标记这是内部更新，避免触发重新解析
        isInternalUpdateRef.current = true;
        // 使用 setTimeout 确保在下一个事件循环中更新，避免在渲染期间更新父组件
        setTimeout(() => {
          onChange(markdown);
          // 只在非输入状态下恢复光标位置（避免快速输入时频繁恢复导致抖动）
          // 如果正在输入，延迟恢复，等待输入停止
          if (!isTypingRef.current) {
            // 清除之前的恢复定时器
            if (restoreCursorTimeoutRef.current) {
              clearTimeout(restoreCursorTimeoutRef.current);
            }
            restoreCursorTimeoutRef.current = setTimeout(() => {
              restoreCursorPosition();
            }, 50);
          }
        }, 0);
      }
    }, 50); // 每 50ms 检查一次
    
    return () => {
      clearInterval(intervalId);
      if (restoreCursorTimeoutRef.current) {
        clearTimeout(restoreCursorTimeoutRef.current);
      }
    };
  }, [onChange, restoreCursorPosition]);
  
  // 当 segments 更新后，恢复光标位置（使用 ref 跟踪，避免无限循环）
  useEffect(() => {
    // 如果是由内部更新触发的，不恢复光标位置（避免循环）
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false; // 重置标志
      return;
    }
    
    // 只在 segments 长度变化时恢复光标位置（避免内容变化时频繁恢复）
    // 并且只在非输入状态下恢复（避免快速输入时抖动）
    if (segments.length !== segmentsLengthRef.current && savedCursorStateRef.current && !hasRestoredRef.current && !isTypingRef.current) {
      segmentsLengthRef.current = segments.length;
      hasRestoredRef.current = true;
      // 清除之前的恢复定时器
      if (restoreCursorTimeoutRef.current) {
        clearTimeout(restoreCursorTimeoutRef.current);
      }
      // 延迟恢复，确保 DOM 已更新
      restoreCursorTimeoutRef.current = setTimeout(() => {
        restoreCursorPosition();
        hasRestoredRef.current = false;
      }, 50);
      return () => {
        if (restoreCursorTimeoutRef.current) {
          clearTimeout(restoreCursorTimeoutRef.current);
        }
      };
    }
    // 更新长度引用
    if (segments.length !== segmentsLengthRef.current) {
      segmentsLengthRef.current = segments.length;
      hasRestoredRef.current = false;
    }
  }, [segments.length, restoreCursorPosition]);

  // 更新文本段
  const updateTextSegment = useCallback(
    (index: number, newContent: string, textarea: HTMLTextAreaElement) => {
      // 标记正在输入
      isTypingRef.current = true;
      lastInputTimeRef.current = Date.now();
      
      // 保存光标位置和滚动位置（使用最新的光标位置）
      const currentCursorPos = textarea.selectionStart ?? 0;
      savedCursorStateRef.current = {
        segmentIndex: index,
        cursorPosition: currentCursorPos,
        scrollTop: textarea.scrollTop,
        scrollLeft: textarea.scrollLeft,
      };
      activeTextareaIndexRef.current = index;
      
      // 清除之前的恢复定时器
      if (restoreCursorTimeoutRef.current) {
        clearTimeout(restoreCursorTimeoutRef.current);
      }
      
      setSegments((prevSegments) => {
        const newSegments = [...prevSegments];
        if (newSegments[index] && newSegments[index].type === 'text') {
          newSegments[index] = { ...newSegments[index], content: newContent };
          // 延迟更新，避免在渲染期间更新父组件
          pendingUpdateRef.current = segmentsToMarkdown(newSegments);
        }
        return newSegments;
      });
      
      // 在输入停止后（300ms 无输入）标记为非输入状态，并恢复光标
      setTimeout(() => {
        const timeSinceLastInput = Date.now() - lastInputTimeRef.current;
        if (timeSinceLastInput >= 300) {
          isTypingRef.current = false;
          // 延迟恢复光标，确保 DOM 已更新
          if (restoreCursorTimeoutRef.current) {
            clearTimeout(restoreCursorTimeoutRef.current);
          }
          restoreCursorTimeoutRef.current = setTimeout(() => {
            restoreCursorPosition();
          }, 50);
        }
      }, 300);
    },
    [segmentsToMarkdown, restoreCursorPosition]
  );

  // 格式化文本
  const formatText = useCallback((segmentIndex: number, type: 'bold' | 'italic' | 'link' | 'code' | 'quote') => {
    const textarea = textareaRefs.current.get(segmentIndex);
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    if (!selectedText.trim()) {
      // 如果没有选中文本，插入格式标记
      let insertText = '';
      switch (type) {
        case 'bold':
          insertText = '**粗体文本**';
          break;
        case 'italic':
          insertText = '*斜体文本*';
          break;
        case 'link':
          insertText = '[链接文本](https://example.com)';
          break;
        case 'code':
          insertText = '`代码`';
          break;
        case 'quote':
          insertText = '> 引用文本';
          break;
      }
      
      const newValue = 
        textarea.value.substring(0, start) + 
        insertText + 
        textarea.value.substring(end);
      
      updateTextSegment(segmentIndex, newValue, textarea);
      
      // 设置光标位置
      setTimeout(() => {
        const newCursorPos = start + insertText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    } else {
      // 如果有选中文本，应用格式
      let formattedText = '';
      switch (type) {
        case 'bold':
          formattedText = `**${selectedText}**`;
          break;
        case 'italic':
          formattedText = `*${selectedText}*`;
          break;
        case 'link':
          formattedText = `[${selectedText}](https://example.com)`;
          break;
        case 'code':
          formattedText = `\`${selectedText}\``;
          break;
        case 'quote':
          formattedText = selectedText.split('\n').map(line => `> ${line}`).join('\n');
          break;
      }
      
      const newValue = 
        textarea.value.substring(0, start) + 
        formattedText + 
        textarea.value.substring(end);
      
      updateTextSegment(segmentIndex, newValue, textarea);
      
      // 设置光标位置
      setTimeout(() => {
        const newStart = start;
        const newEnd = start + formattedText.length;
        textarea.setSelectionRange(newEnd, newEnd);
        textarea.focus();
      }, 0);
    }
    
    // 关闭工具栏
    setSelectedText("");
    setToolbarPosition(null);
  }, [updateTextSegment]);

  // 更新表格段
  const updateTableSegment = useCallback(
    (index: number, newTableData: string[][]) => {
      setSegments((prevSegments) => {
        const newSegments = [...prevSegments];
        newSegments[index] = { ...newSegments[index], tableData: newTableData };
        // 延迟更新，避免在渲染期间更新父组件
        pendingUpdateRef.current = segmentsToMarkdown(newSegments);
        return newSegments;
      });
    },
    [segmentsToMarkdown]
  );

  // 在表格后面插入一个新的文本段，方便继续输入文字
  const handleAddTextAfterTable = useCallback(
    (tableIndex: number) => {
      setSegments((prevSegments) => {
        const newSegments = [...prevSegments];
        const next = newSegments[tableIndex + 1];

        // 如果后面已经有文本段了，就不重复插入，直接返回
        if (next && next.type === "text") {
          return prevSegments;
        }

        const textSegment: Segment = {
          type: "text",
          content: "",
          startPos: 0,
          endPos: 0,
        };

        newSegments.splice(tableIndex + 1, 0, textSegment);
        pendingUpdateRef.current = segmentsToMarkdown(newSegments);
        return newSegments;
      });
    },
    [segmentsToMarkdown]
  );

  // 表格操作
  const handleAddTableRow = useCallback(
    (tableIndex: number) => {
      setSegments((prevSegments) => {
        const segment = prevSegments[tableIndex];
        if (segment.type === "table" && segment.tableData) {
          // 确保表格数据存在且至少有一行
          if (segment.tableData.length === 0) {
            // 如果表格为空，创建默认的2列表头
            const defaultTableData = [["", ""]];
            const newSegments = [...prevSegments];
            newSegments[tableIndex] = { ...segment, tableData: defaultTableData };
            pendingUpdateRef.current = segmentsToMarkdown(newSegments);
            return newSegments;
          }
          
          // 计算最大列数（使用第一行作为参考，确保列数一致）
          // 确保至少有一行数据
          const firstRow = segment.tableData[0];
          const colCount = firstRow && firstRow.length > 0 ? firstRow.length : 2;
          
          // 创建新行，确保列数与第一行一致
          const newRow = new Array(colCount).fill("");
          const newTableData = [...segment.tableData, newRow];
          const newSegments = [...prevSegments];
          newSegments[tableIndex] = { ...segment, tableData: newTableData };
          pendingUpdateRef.current = segmentsToMarkdown(newSegments);
          return newSegments;
        }
        return prevSegments;
      });
    },
    [segmentsToMarkdown]
  );

  const handleDeleteTableRow = useCallback(
    (tableIndex: number, rowIndex: number) => {
      setSegments((prevSegments) => {
        const segment = prevSegments[tableIndex];
        if (segment.type === "table" && segment.tableData && segment.tableData.length > 1) {
          const newTableData = segment.tableData.filter((_, i) => i !== rowIndex);
          const newSegments = [...prevSegments];
          newSegments[tableIndex] = { ...segment, tableData: newTableData };
          pendingUpdateRef.current = segmentsToMarkdown(newSegments);
          return newSegments;
        }
        return prevSegments;
      });
    },
    [segmentsToMarkdown]
  );

  const handleAddTableColumn = useCallback(
    (tableIndex: number) => {
      setSegments((prevSegments) => {
        const segment = prevSegments[tableIndex];
        if (segment.type === "table" && segment.tableData && segment.tableData.length > 0) {
          // 确保所有行都有相同的列数，然后添加新列
          const maxColCount = Math.max(...segment.tableData.map(row => row.length));
          const newTableData = segment.tableData.map((row) => {
            // 确保行有足够的列数
            const normalizedRow = [...row];
            while (normalizedRow.length < maxColCount) {
              normalizedRow.push("");
            }
            // 添加新列
            return [...normalizedRow, ""];
          });
          const newSegments = [...prevSegments];
          newSegments[tableIndex] = { ...segment, tableData: newTableData };
          pendingUpdateRef.current = segmentsToMarkdown(newSegments);
          return newSegments;
        }
        return prevSegments;
      });
    },
    [segmentsToMarkdown]
  );

  const handleDeleteTableColumn = useCallback(
    (tableIndex: number, colIndex: number) => {
      setSegments((prevSegments) => {
        const segment = prevSegments[tableIndex];
        if (segment.type === "table" && segment.tableData && segment.tableData[0].length > 1) {
          const newTableData = segment.tableData.map((row) =>
            row.filter((_, i) => i !== colIndex)
          );
          const newSegments = [...prevSegments];
          newSegments[tableIndex] = { ...segment, tableData: newTableData };
          pendingUpdateRef.current = segmentsToMarkdown(newSegments);
          return newSegments;
        }
        return prevSegments;
      });
    },
    [segmentsToMarkdown]
  );

  // 删除整个表格
  const handleDeleteTable = useCallback(
    (tableIndex: number) => {
      setSegments((prevSegments) => {
        // 删除表格段
        const newSegments = prevSegments.filter((_, i) => i !== tableIndex);
        
        // 如果删除后没有段了，至少保留一个空的文本段
        if (newSegments.length === 0) {
          pendingUpdateRef.current = "";
          return [{ type: "text", content: "", startPos: 0, endPos: 0 }];
        }
        
        // 合并相邻的文本段
        const mergedSegments: Segment[] = [];
        for (let i = 0; i < newSegments.length; i++) {
          const current = newSegments[i];
          const last = mergedSegments[mergedSegments.length - 1];
          
          // 如果当前段和上一个段都是文本段，合并它们
          if (current.type === "text" && last && last.type === "text") {
            mergedSegments[mergedSegments.length - 1] = {
              ...last,
              content: last.content + (last.content && current.content ? "\n\n" : "") + current.content,
            };
          } else {
            mergedSegments.push(current);
          }
        }
        
        pendingUpdateRef.current = segmentsToMarkdown(mergedSegments);
        return mergedSegments;
      });
    },
    [segmentsToMarkdown]
  );

  const handleTableCellChange = useCallback(
    (tableIndex: number, rowIndex: number, colIndex: number, value: string) => {
      setSegments((prevSegments) => {
        const segment = prevSegments[tableIndex];
        if (segment.type === "table" && segment.tableData) {
          const newTableData = segment.tableData.map((row, rIdx) => {
            if (rIdx === rowIndex) {
              const newRow = [...row];
              newRow[colIndex] = value;
              return newRow;
            }
            return row;
          });
          const newSegments = [...prevSegments];
          newSegments[tableIndex] = { ...segment, tableData: newTableData };
          pendingUpdateRef.current = segmentsToMarkdown(newSegments);
          return newSegments;
        }
        return prevSegments;
      });
    },
    [segmentsToMarkdown]
  );

  // 如果内容为空，显示单个 Textarea
  if (!content.trim() && segments.length === 0) {
    return (
      <Textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  // 如果没有段（解析失败），也显示单个 Textarea
  if (segments.length === 0) {
    return (
      <Textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  return (
    <>
      <div 
        className={className || ""}
        style={{
          // 内容区域优化：段落间距 1.5rem
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}
      >
        {segments.map((segment, segmentIndex) => {
        if (segment.type === "table" && segment.tableData) {
          return (
            <div
              key={segmentIndex}
              className="my-4 border border-border rounded-lg p-4 bg-card relative group shadow-sm hover:shadow-md transition-shadow duration-200"
              style={{
                // 内容区域优化：表格样式优化（圆角、阴影、悬停效果）
                borderRadius: '0.5rem',
                marginBottom: '1.5rem' // 段落间距
              }}
            >
              {/* 删除表格按钮 */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteTable(segmentIndex);
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 shadow-md hover:bg-red-600"
                title="删除表格"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-border">
                  <thead>
                    {segment.tableData.length > 0 && (
                      <tr>
                        {segment.tableData[0].map((_, colIndex) => (
                          <th
                            key={colIndex}
                            className="border border-border p-2 bg-accent/50 relative group/col"
                          >
                            <input
                              type="text"
                              value={segment.tableData![0][colIndex]}
                              onChange={(e) =>
                                handleTableCellChange(segmentIndex, 0, colIndex, e.target.value)
                              }
                              className="w-full bg-transparent border-none outline-none text-sm font-semibold"
                              placeholder="表头"
                            />
                            {segment.tableData![0].length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteTableColumn(segmentIndex, colIndex);
                                }}
                                className="absolute top-0 right-0 w-6 h-6 -translate-y-1/2 translate-x-1/2 bg-background border border-border hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-full opacity-0 group-hover/col:opacity-100 transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md z-10"
                                title="删除列"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </th>
                        ))}
                        <th className="border border-border p-2 bg-accent/50 w-8">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAddTableColumn(segmentIndex);
                            }}
                            className="w-full h-full flex items-center justify-center hover:bg-accent rounded"
                            title="添加列"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {segment.tableData.slice(1).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, colIndex) => (
                          <td
                            key={colIndex}
                            className="border border-border p-2 relative group/row hover:bg-accent/30 transition-colors duration-150"
                          >
                            <input
                              type="text"
                              value={cell}
                              onChange={(e) =>
                                handleTableCellChange(
                                  segmentIndex,
                                  rowIndex + 1,
                                  colIndex,
                                  e.target.value
                                )
                              }
                              className="w-full bg-transparent border-none outline-none text-sm"
                              placeholder="单元格"
                            />
                            {colIndex === 0 && segment.tableData!.length > 2 && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteTableRow(segmentIndex, rowIndex + 1);
                                }}
                                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-background border border-border hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-full opacity-0 group-hover/row:opacity-100 transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md z-10"
                                title="删除行"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        ))}
                        <td className="border border-border p-2 w-8 group/row">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAddTableColumn(segmentIndex);
                            }}
                            className="w-full h-full flex items-center justify-center hover:bg-accent rounded opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 transition-opacity"
                            title="添加列"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td
                        colSpan={(segment.tableData[0]?.length || 1) + 1}
                        className="border border-border p-2"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAddTableRow(segmentIndex);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2 hover:bg-accent rounded text-sm text-muted-foreground transition-colors"
                          title="添加行"
                        >
                          <Plus className="w-4 h-4" />
                          <span>添加行</span>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 在表格后继续输入文字的按钮 */}
              <div className="mt-2 flex justify-start">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddTextAfterTable(segmentIndex);
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                >
                  在表格后继续输入文字
                </button>
              </div>
            </div>
          );
        }

          // 文本段
          return (
            <Textarea
              key={segmentIndex}
              ref={(el) => {
                if (el) {
                  textareaRefs.current.set(segmentIndex, el);
                  autoResizeTextarea(el);
                } else {
                  textareaRefs.current.delete(segmentIndex);
                }
              }}
              value={segment.content}
              onChange={(e) => {
                const textarea = e.currentTarget;
                // 在更新前立即保存当前光标位置（确保获取到最新的光标位置）
                const currentCursorPos = textarea.selectionStart ?? 0;
                // 更新内容
                updateTextSegment(segmentIndex, textarea.value, textarea);
                autoResizeTextarea(textarea);
                // 在下一个事件循环中恢复光标位置（避免被 React 的重渲染重置）
                requestAnimationFrame(() => {
                  if (textarea && currentCursorPos <= textarea.value.length) {
                    textarea.setSelectionRange(currentCursorPos, currentCursorPos);
                  }
                });
              }}
              onSelect={(e) => {
                // 保存选择位置
                const textarea = e.currentTarget;
                savedCursorStateRef.current = {
                  segmentIndex,
                  cursorPosition: textarea.selectionStart ?? 0,
                  scrollTop: textarea.scrollTop,
                  scrollLeft: textarea.scrollLeft,
                };
                activeTextareaIndexRef.current = segmentIndex;
                
                // 检测文本选择，显示浮动工具栏
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const selectedText = textarea.value.substring(start, end);
                const textBeforeCursor = textarea.value.substring(0, start);
                
                // 智能工具栏：上下文感知 - 检测代码块或表格
                let context: 'text' | 'code' | 'table' = 'text';
                // 检测代码块：查找最近的 ``` 或 ` 标记
                const codeBlockMatch = textBeforeCursor.match(/(```[\s\S]*?```|`[^`]*`)$/);
                if (codeBlockMatch) {
                  context = 'code';
                }
                // 检测表格：查找最近的 | 标记（简单检测）
                const tableMatch = textBeforeCursor.match(/\|[\s\S]*$/);
                if (tableMatch && !codeBlockMatch) {
                  context = 'table';
                }
                
                if (selectedText.trim() && start !== end) {
                  // 使用更可靠的方法计算位置
                  const textareaRect = textarea.getBoundingClientRect();
                  
                  // 创建一个隐藏的 div 来模拟 textarea 的布局
                  const measureDiv = document.createElement('div');
                  const styles = window.getComputedStyle(textarea);
                  measureDiv.style.position = 'absolute';
                  measureDiv.style.visibility = 'hidden';
                  measureDiv.style.whiteSpace = 'pre-wrap';
                  measureDiv.style.wordWrap = 'break-word';
                  measureDiv.style.font = styles.font;
                  measureDiv.style.fontSize = styles.fontSize;
                  measureDiv.style.fontFamily = styles.fontFamily;
                  measureDiv.style.lineHeight = styles.lineHeight;
                  measureDiv.style.padding = styles.padding;
                  measureDiv.style.width = styles.width;
                  measureDiv.style.border = styles.border;
                  measureDiv.style.boxSizing = styles.boxSizing;
                  
                  // 计算选中文本开始位置
                  const textBeforeSelection = textarea.value.substring(0, start);
                  measureDiv.textContent = textBeforeSelection;
                  document.body.appendChild(measureDiv);
                  const beforeHeight = measureDiv.offsetHeight;
                  
                  // 计算选中文本结束位置
                  measureDiv.textContent = textarea.value.substring(0, end);
                  const afterHeight = measureDiv.offsetHeight;
                  
                  document.body.removeChild(measureDiv);
                  
                  // 计算工具栏位置（确保不覆盖选中文本）
                  const selectionTop = textareaRect.top + beforeHeight - textarea.scrollTop;
                  const selectionBottom = textareaRect.top + afterHeight - textarea.scrollTop;
                  const selectionCenter = (selectionTop + selectionBottom) / 2;
                  
                  // 水平位置：选中文本的中心位置（工具栏会在此基础上居中）
                  // 获取选中文本的宽度（估算）
                  const selectionWidth = Math.min(200, textareaRect.width); // 估算选中文本宽度
                  const left = textareaRect.left + (textareaRect.width - selectionWidth) / 2;
                  
                  // 传递选中文本的顶部和底部位置，让 FloatingToolbar 决定显示位置
                  setSelectedText(selectedText);
                  setToolbarPosition({ 
                    top: selectionTop, 
                    left, 
                    bottom: selectionBottom // 传递底部位置，用于判断是否覆盖
                  });
                  setToolbarContext(context);
                  
                  // 清除之前的延迟关闭
                  if (selectionTimeoutRef.current) {
                    clearTimeout(selectionTimeoutRef.current);
                    selectionTimeoutRef.current = null;
                  }
                } else {
                  // 清除选择（延迟关闭，避免快速切换时闪烁）
                  if (selectionTimeoutRef.current) {
                    clearTimeout(selectionTimeoutRef.current);
                  }
                  selectionTimeoutRef.current = setTimeout(() => {
                    setSelectedText("");
                    setToolbarPosition(null);
                  }, 150);
                }
              }}
              onPaste={(e) => {
                // 内容辅助功能：格式化助手 - 粘贴时自动清理格式
                e.preventDefault();
                const pastedText = e.clipboardData.getData('text/plain');
                const textarea = e.currentTarget;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const currentValue = textarea.value;
                
                // 如果粘贴的是 HTML，尝试转换为 Markdown（简单处理）
                const htmlData = e.clipboardData.getData('text/html');
                let processedText = pastedText;
                if (htmlData) {
                  // 简单的 HTML 到 Markdown 转换
                  processedText = htmlData
                    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
                    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
                    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
                    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
                    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
                    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
                    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
                    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
                    .replace(/<br[^>]*>/gi, '\n')
                    .replace(/<[^>]+>/g, '') // 移除其他 HTML 标签
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .trim();
                  
                  // 如果转换后为空，使用纯文本
                  if (!processedText) {
                    processedText = pastedText;
                  }
                }
                
                // 清理多余的空白行（保留最多一个空行）
                processedText = processedText.replace(/\n{3,}/g, '\n\n');
                
                // 插入处理后的文本
                const newValue = currentValue.substring(0, start) + processedText + currentValue.substring(end);
                updateTextSegment(segmentIndex, newValue, textarea);
                autoResizeTextarea(textarea);
                
                // 恢复光标位置
                setTimeout(() => {
                  const newCursorPos = start + processedText.length;
                  textarea.setSelectionRange(newCursorPos, newCursorPos);
                  textarea.focus();
                }, 0);
              }}
              onFocus={(e) => {
                // 聚焦时保存当前状态
                const textarea = e.currentTarget;
                savedCursorStateRef.current = {
                  segmentIndex,
                  cursorPosition: textarea.selectionStart ?? 0,
                  scrollTop: textarea.scrollTop,
                  scrollLeft: textarea.scrollLeft,
                };
                activeTextareaIndexRef.current = segmentIndex;
              }}
              onClick={(e) => {
                // 编辑态“智能识别链接”：单击命中链接时弹出应用内部确认弹窗
                const cursor = e.currentTarget.selectionStart ?? 0;
                const token = extractTokenAtCursor(e.currentTarget.value, cursor);
                // 仅当命中“看起来像链接”的 token 时才弹窗
                if (
                  /^https?:\/\/\S+$/i.test(token.trim()) ||
                  /^\[\[([^\]|]+)(\|[^\]]+)?\]\]$/.test(token.trim())
                ) {
                  confirmAndOpenSmartLink(token);
                }
              }}
              placeholder={segmentIndex === 0 ? placeholder : undefined}
              className="w-full min-h-[120px] resize-none overflow-hidden"
              style={{
                // 内容区域优化：行高 1.75，字间距 0.01em
                lineHeight: '1.75',
                letterSpacing: '0.01em',
                // 段落间距：通过 margin-bottom 实现
                marginBottom: '1.5rem'
              }}
            />
          );
        })}
      </div>

      {/* 浮动工具栏 */}
      <FloatingToolbar
        selectedText={selectedText}
        position={toolbarPosition}
        context={toolbarContext}
        onFormat={(type) => {
          if (activeTextareaIndexRef.current !== null) {
            formatText(activeTextareaIndexRef.current, type);
          }
        }}
        onClose={() => {
          setSelectedText("");
          setToolbarPosition(null);
          setToolbarContext('text');
        }}
      />

      {/* 应用内部的链接跳转确认弹窗 */}
      <Dialog open={linkConfirmOpen} onOpenChange={setLinkConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>打开链接</DialogTitle>
            <DialogDescription>
              是否跳转在新页面打开下面的链接？
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 rounded-md bg-muted px-3 py-2 text-xs break-all">
            {pendingLinkToken}
          </div>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              type="button"
              onClick={() => setLinkConfirmOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (pendingLinkToken) {
                  openSmartLink(pendingLinkToken);
                }
                setLinkConfirmOpen(false);
              }}
            >
              打开
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
