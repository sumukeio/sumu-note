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
  useEffect(() => {
    if (pendingUpdateRef.current !== null) {
      const markdown = pendingUpdateRef.current;
      pendingUpdateRef.current = null;
      // 标记这是内部更新，避免触发重新解析
      isInternalUpdateRef.current = true;
      // 使用 setTimeout 确保在下一个事件循环中更新，避免在渲染期间更新父组件
      const timer = setTimeout(() => {
        onChange(markdown);
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  // 更新文本段
  const updateTextSegment = useCallback(
    (index: number, newText: string) => {
      setSegments((prevSegments) => {
        const newSegments = [...prevSegments];
        newSegments[index] = { ...newSegments[index], content: newText };
        // 延迟更新，避免在渲染期间更新父组件
        pendingUpdateRef.current = segmentsToMarkdown(newSegments);
        return newSegments;
      });
    },
    [segmentsToMarkdown]
  );

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
        // 删除表格段，保留其他段
        const newSegments = prevSegments.filter((_, i) => i !== tableIndex);
        // 如果删除后没有段了，至少保留一个空的文本段
        if (newSegments.length === 0) {
          pendingUpdateRef.current = "";
          return [{ type: "text", content: "", startPos: 0, endPos: 0 }];
        }
        pendingUpdateRef.current = segmentsToMarkdown(newSegments);
        return newSegments;
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
      <div className={`space-y-4 ${className || ""}`}>
        {segments.map((segment, segmentIndex) => {
        if (segment.type === "table" && segment.tableData) {
          return (
            <div
              key={segmentIndex}
              className="my-4 border border-border rounded-lg p-4 bg-card relative group"
            >
              {/* 删除表格按钮 */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteTable(segmentIndex);
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 shadow-md hover:bg-red-600"
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
                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover/col:opacity-100 transition-opacity flex items-center justify-center shadow-sm"
                                title="删除列"
                              >
                                <Minus className="w-3 h-3" />
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
                            className="border border-border p-2 relative group/row"
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
                                className="absolute -left-1 top-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center shadow-sm"
                                title="删除行"
                              >
                                <Minus className="w-3 h-3" />
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
                            className="w-full h-full flex items-center justify-center hover:bg-accent rounded opacity-0 group-hover/row:opacity-100 transition-opacity"
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
                updateTextSegment(segmentIndex, e.target.value);
                autoResizeTextarea(e.currentTarget);
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
            />
          );
        })}
      </div>

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
