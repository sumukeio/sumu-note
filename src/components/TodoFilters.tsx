"use client";

import { useState } from "react";
import { X, Calendar, Tag, Filter as FilterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type TodoList } from "@/lib/todo-storage";
import { cn } from "@/lib/utils";

export interface FilterOptions {
  status: "all" | "todo" | "in_progress" | "done";
  priority: "all" | 0 | 1 | 2 | 3;
  tags: string[];
  listId: string | null;
  dueDateFrom: string | null;
  dueDateTo: string | null;
}

interface TodoFiltersProps {
  lists: TodoList[];
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onClose?: () => void;
}

const priorityLabels: { [key: number]: string } = {
  0: "无优先级",
  1: "低优先级",
  2: "中优先级",
  3: "高优先级",
};

export default function TodoFilters({
  lists,
  filters,
  onFiltersChange,
  onClose,
}: TodoFiltersProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>(filters.tags);
  const [tagInput, setTagInput] = useState("");

  const updateFilter = <K extends keyof FilterOptions>(
    key: K,
    value: FilterOptions[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !selectedTags.includes(tag)) {
      const newTags = [...selectedTags, tag];
      setSelectedTags(newTags);
      updateFilter("tags", newTags);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    const newTags = selectedTags.filter((t) => t !== tag);
    setSelectedTags(newTags);
    updateFilter("tags", newTags);
  };

  const handleClearAll = () => {
    const clearedFilters: FilterOptions = {
      status: "all",
      priority: "all",
      tags: [],
      listId: null,
      dueDateFrom: null,
      dueDateTo: null,
    };
    setSelectedTags([]);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.tags.length > 0 ||
    filters.listId !== null ||
    filters.dueDateFrom !== null ||
    filters.dueDateTo !== null;

  return (
    <div className="bg-accent/50 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FilterIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">高级筛选</span>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-xs"
            >
              清除全部
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-6 w-6"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* 状态筛选 */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">状态</label>
        <div className="flex gap-2 flex-wrap">
          {(
            [
              { value: "all", label: "全部" },
              { value: "todo", label: "待办" },
              { value: "in_progress", label: "进行中" },
              { value: "done", label: "已完成" },
            ] as const
          ).map((s) => (
            <Button
              key={s.value}
              variant={filters.status === s.value ? "default" : "outline"}
              size="sm"
              onClick={() => updateFilter("status", s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 优先级筛选 */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">优先级</label>
        <div className="flex gap-2 flex-wrap">
          {(
            [
              { value: "all", label: "全部" },
              { value: 0, label: "无优先级" },
              { value: 1, label: "低" },
              { value: 2, label: "中" },
              { value: 3, label: "高" },
            ] as const
          ).map((p) => (
            <Button
              key={p.value}
              variant={filters.priority === p.value ? "default" : "outline"}
              size="sm"
              onClick={() => updateFilter("priority", p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 清单筛选 */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">清单</label>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filters.listId === null ? "default" : "outline"}
            size="sm"
            onClick={() => updateFilter("listId", null)}
          >
            全部清单
          </Button>
          {lists.map((list) => (
            <Button
              key={list.id}
              variant={filters.listId === list.id ? "default" : "outline"}
              size="sm"
              onClick={() => updateFilter("listId", list.id)}
            >
              {list.name}
            </Button>
          ))}
        </div>
      </div>

      {/* 标签筛选 */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">标签</label>
        <div className="flex gap-2 mb-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAddTag();
              }
            }}
            placeholder="输入标签并按回车"
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={handleAddTag} className="h-8">
            添加
          </Button>
        </div>
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <div
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-xs"
              >
                <Tag className="w-3 h-3" />
                <span>{tag}</span>
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-primary/80"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 日期范围筛选 */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          截止日期范围
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
          <div>
            <Input
              type="date"
              value={filters.dueDateFrom || ""}
              onChange={(e) =>
                updateFilter("dueDateFrom", e.target.value || null)
              }
              className="h-9 sm:h-8 text-sm min-h-10 touch-manipulation w-full"
            />
            <label className="text-xs text-muted-foreground mt-1 block">
              开始日期
            </label>
          </div>
          <div>
            <Input
              type="date"
              value={filters.dueDateTo || ""}
              onChange={(e) => updateFilter("dueDateTo", e.target.value || null)}
              className="h-9 sm:h-8 text-sm min-h-10 touch-manipulation w-full"
            />
            <label className="text-xs text-muted-foreground mt-1 block">
              结束日期
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

