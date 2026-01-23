"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { detectTableAtCursor, tableDataToMarkdown } from "@/lib/table-utils";

interface InlineTableEditorProps {
  content: string;
  cursorPosition: number;
  onUpdate: (newContent: string) => void;
}

/**
 * 内联表格编辑器
 * 在编辑器中直接显示为可编辑的表格（类似 iOS 备忘录）
 */
export default function InlineTableEditor({
  content,
  cursorPosition,
  onUpdate,
}: InlineTableEditorProps) {
  const tableInfo = useMemo(
    () => detectTableAtCursor(content, cursorPosition),
    [content, cursorPosition]
  );

  const [tableData, setTableData] = useState<string[][]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const cellInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // 初始化表格数据
  useEffect(() => {
    if (tableInfo && tableInfo.rows.length > 0) {
      setTableData(tableInfo.rows);
    } else {
      setTableData([]);
    }
  }, [tableInfo]);

  if (!tableInfo) {
    return null;
  }

  // 获取单元格的 key
  const getCellKey = (row: number, col: number) => `${row}-${col}`;

  // 保存表格的定时器
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 保存表格（转换为 Markdown 并更新内容）
  const saveTable = useCallback(() => {
    if (!tableInfo || tableData.length === 0) return;

    const markdown = tableDataToMarkdown(tableData);
    const lines = content.split("\n");
    const beforeTable = lines.slice(0, tableInfo.startLine).join("\n");
    const afterTable = lines.slice(tableInfo.endLine + 1).join("\n");

    let newContent = beforeTable;
    if (beforeTable) newContent += "\n";
    newContent += markdown;
    if (afterTable) {
      newContent += "\n" + afterTable;
    }

    onUpdate(newContent);
  }, [tableData, tableInfo, content, onUpdate]);
  
  // 更新单元格内容
  const handleCellChange = useCallback(
    (rowIndex: number, colIndex: number, value: string) => {
      const newData = [...tableData];
      newData[rowIndex] = [...newData[rowIndex]];
      newData[rowIndex][colIndex] = value;
      setTableData(newData);
    },
    [tableData]
  );
  
  // 防抖保存表格
  useEffect(() => {
    if (tableData.length > 0 && tableInfo) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        saveTable();
      }, 1000);
    }
    
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [tableData, tableInfo, saveTable]);
  
  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // 单元格失焦时
  const handleCellBlur = useCallback(() => {
    setEditingCell(null);
    // 立即保存（清除防抖定时器）
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveTable();
  }, [saveTable]);

  // 添加行
  const handleAddRow = useCallback(() => {
    const newRow = new Array(tableInfo.colCount).fill("");
    setTableData([...tableData, newRow]);
  }, [tableData, tableInfo.colCount]);

  // 删除行
  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      if (tableData.length <= 1) return;
      const newData = tableData.filter((_, i) => i !== rowIndex);
      setTableData(newData);
      saveTable();
    },
    [tableData, saveTable]
  );

  // 添加列
  const handleAddColumn = useCallback(() => {
    const newData = tableData.map((row) => [...row, ""]);
    setTableData(newData);
  }, [tableData]);

  // 删除列
  const handleDeleteColumn = useCallback(
    (colIndex: number) => {
      if (tableData[0].length <= 1) return;
      const newData = tableData.map((row) => row.filter((_, i) => i !== colIndex));
      setTableData(newData);
      saveTable();
    },
    [tableData, saveTable]
  );

  // 处理键盘事件
  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const nextCol = e.shiftKey ? colIndex - 1 : colIndex + 1;
        if (nextCol >= 0 && nextCol < tableData[0].length) {
          const cellKey = getCellKey(rowIndex, nextCol);
          cellInputRefs.current.get(cellKey)?.focus();
        } else if (!e.shiftKey && rowIndex < tableData.length - 1) {
          // 移动到下一行第一列
          const cellKey = getCellKey(rowIndex + 1, 0);
          cellInputRefs.current.get(cellKey)?.focus();
        } else if (e.shiftKey && rowIndex > 0) {
          // 移动到上一行最后一列
          const cellKey = getCellKey(rowIndex - 1, tableData[0].length - 1);
          cellInputRefs.current.get(cellKey)?.focus();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (rowIndex < tableData.length - 1) {
          const cellKey = getCellKey(rowIndex + 1, colIndex);
          cellInputRefs.current.get(cellKey)?.focus();
        } else {
          // 在最后一行按 Enter，添加新行
          handleAddRow();
          setTimeout(() => {
            const cellKey = getCellKey(tableData.length, colIndex);
            cellInputRefs.current.get(cellKey)?.focus();
          }, 0);
        }
      }
    },
    [tableData, handleAddRow]
  );

  return (
    <div className="my-4 border border-border rounded-lg p-4 bg-card">
      <div className="overflow-x-auto">
        <table
          ref={tableRef}
          className="min-w-full border-collapse border border-border"
        >
          <thead>
            {tableData.length > 0 && (
              <tr>
                {tableData[0].map((_, colIndex) => (
                  <th
                    key={colIndex}
                    className="border border-border p-2 bg-accent/50 relative group"
                  >
                    <input
                      ref={(el) => {
                        if (el) {
                          cellInputRefs.current.set(getCellKey(0, colIndex), el);
                        } else {
                          cellInputRefs.current.delete(getCellKey(0, colIndex));
                        }
                      }}
                      type="text"
                      value={tableData[0][colIndex]}
                      onChange={(e) => handleCellChange(0, colIndex, e.target.value)}
                      onKeyDown={(e) => handleCellKeyDown(e, 0, colIndex)}
                      onFocus={() => setEditingCell({ row: 0, col: colIndex })}
                      onBlur={handleCellBlur}
                      className="w-full bg-transparent border-none outline-none text-sm font-semibold"
                      placeholder="表头"
                    />
                    {tableData[0].length > 1 && (
                      <button
                        onClick={() => handleDeleteColumn(colIndex)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px]"
                        title="删除列"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </th>
                ))}
                <th className="border border-border p-2 bg-accent/50 w-8">
                  <button
                    onClick={handleAddColumn}
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
            {tableData.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex} className="group">
                {row.map((cell, colIndex) => (
                  <td
                    key={colIndex}
                    className="border border-border p-2 relative"
                  >
                    <input
                      ref={(el) => {
                        if (el) {
                          cellInputRefs.current.set(
                            getCellKey(rowIndex + 1, colIndex),
                            el
                          );
                        } else {
                          cellInputRefs.current.delete(
                            getCellKey(rowIndex + 1, colIndex)
                          );
                        }
                      }}
                      type="text"
                      value={cell}
                      onChange={(e) =>
                        handleCellChange(rowIndex + 1, colIndex, e.target.value)
                      }
                      onKeyDown={(e) =>
                        handleCellKeyDown(e, rowIndex + 1, colIndex)
                      }
                      onFocus={() =>
                        setEditingCell({ row: rowIndex + 1, col: colIndex })
                      }
                      onBlur={handleCellBlur}
                      className="w-full bg-transparent border-none outline-none text-sm"
                      placeholder="单元格"
                    />
                    {colIndex === 0 && tableData.length > 2 && (
                      <button
                        onClick={() => handleDeleteRow(rowIndex + 1)}
                        className="absolute -left-1 top-1/2 -translate-y-1/2 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px]"
                        title="删除行"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                ))}
                <td className="border border-border p-2 w-8">
                  <button
                    onClick={handleAddColumn}
                    className="w-full h-full flex items-center justify-center hover:bg-accent rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="添加列"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td
                colSpan={tableData[0]?.length || 1}
                className="border border-border p-2"
              >
                <button
                  onClick={handleAddRow}
                  className="w-full flex items-center justify-center gap-2 py-2 hover:bg-accent rounded text-sm text-muted-foreground"
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
    </div>
  );
}
