"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { X, Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tableDataToMarkdown, detectTableAtCursor } from "@/lib/table-utils";

interface TableEditorProps {
  content: string;
  cursorPosition: number;
  onSave: (newContent: string) => void;
  onCancel: () => void;
}

/**
 * 可视化表格编辑器组件
 * 将 Markdown 表格转换为可编辑的 HTML 表格
 */
export default function TableEditor({
  content,
  cursorPosition,
  onSave,
  onCancel,
}: TableEditorProps) {
  // 使用 useMemo 稳定 tableInfo 的引用
  const tableInfo = useMemo(
    () => detectTableAtCursor(content, cursorPosition),
    [content, cursorPosition]
  );
  
  const [tableData, setTableData] = useState<string[][]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  // 初始化表格数据
  useEffect(() => {
    if (tableInfo) {
      setTableData(tableInfo.rows);
    } else {
      setTableData([]);
    }
  }, [tableInfo]);

  if (!tableInfo) {
    return null;
  }

  // 添加行
  const handleAddRow = () => {
    const newRow = new Array(tableInfo.colCount).fill("");
    setTableData([...tableData, newRow]);
  };

  // 删除行
  const handleDeleteRow = (rowIndex: number) => {
    if (tableData.length <= 1) return; // 至少保留一行
    setTableData(tableData.filter((_, i) => i !== rowIndex));
  };

  // 添加列
  const handleAddColumn = () => {
    setTableData(tableData.map(row => [...row, ""]));
  };

  // 删除列
  const handleDeleteColumn = (colIndex: number) => {
    if (tableData[0].length <= 1) return; // 至少保留一列
    setTableData(tableData.map(row => row.filter((_, i) => i !== colIndex)));
  };

  // 更新单元格内容
  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newData = [...tableData];
    newData[rowIndex] = [...newData[rowIndex]];
    newData[rowIndex][colIndex] = value;
    setTableData(newData);
  };

  // 保存表格（转换为 Markdown）
  const handleSave = () => {
    // 转换为 Markdown
    const markdown = tableDataToMarkdown(tableData);

    // 替换原内容中的表格部分
    const lines = content.split("\n");
    const beforeTable = lines.slice(0, tableInfo.startLine).join("\n");
    const afterTable = lines.slice(tableInfo.endLine + 1).join("\n");

    let newContent = beforeTable;
    if (beforeTable) newContent += "\n";
    newContent += markdown;
    if (afterTable) {
      newContent += "\n" + afterTable;
    }

    onSave(newContent);
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">编辑表格</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            className="h-7 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            添加行
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddColumn}
            className="h-7 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            添加列
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            className="h-7 text-xs"
          >
            <Save className="w-3 h-3 mr-1" />
            保存
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-7 text-xs"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

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
                      type="text"
                      value={tableData[0][colIndex]}
                      onChange={(e) => handleCellChange(0, colIndex, e.target.value)}
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
                      type="text"
                      value={cell}
                      onChange={(e) => handleCellChange(rowIndex + 1, colIndex, e.target.value)}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
