"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Loader2, CheckSquare, Square } from "lucide-react";
import { type Todo } from "@/lib/todo-storage";
import { formatDueDate, getPriorityColor, highlightText } from "@/lib/todo-utils";
import { cn } from "@/lib/utils";
import TodoDetail from "./TodoDetail";

interface TodoItemProps {
  todo: Todo;
  isCompleting: boolean;
  onToggleComplete: () => void;
  userId: string;
  onUpdate: (updatedTodo?: Todo) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  searchQuery?: string;
  onContextMenu?: (e: React.MouseEvent, todo: Todo) => void;
}

export default function TodoItem({
  todo,
  isCompleting,
  onToggleComplete,
  userId,
  onUpdate,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
  searchQuery = "",
  onContextMenu,
}: TodoItemProps) {
  const [showDetail, setShowDetail] = useState(false);

  const priorityColor = getPriorityColor(todo.priority);
  const isDone = todo.status === "done";

  return (
    <div
      className={cn(
        "group rounded-lg border border-border bg-card/60 p-3 transition-colors",
        isDone && "opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        {/* 多选模式：显示复选框 */}
        {isSelectMode ? (
          <button
            onClick={onToggleSelect}
            className="mt-0.5 shrink-0"
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5 text-primary" />
            ) : (
              <Square className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
            )}
          </button>
        ) : (
          /* 普通模式：显示完成按钮 */
          <button
            onClick={onToggleComplete}
            disabled={isCompleting}
            className="mt-0.5 shrink-0"
          >
            {isCompleting ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : isDone ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
            )}
          </button>
        )}

        {/* 任务内容 */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setShowDetail(true)}
          onContextMenu={(e) => {
            e.stopPropagation();
            onContextMenu?.(e, todo);
          }}
        >
          {/* 标题 */}
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                "text-sm font-medium flex-1",
                isDone && "line-through text-muted-foreground"
              )}
            >
              {searchQuery ? highlightText(todo.title, searchQuery) : todo.title}
            </h3>
            {/* 优先级标识 */}
            {todo.priority > 0 && (
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: priorityColor }}
              />
            )}
          </div>

          {/* 描述 */}
          {todo.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {searchQuery
                ? highlightText(todo.description, searchQuery)
                : todo.description}
            </p>
          )}

          {/* 元信息 */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {/* 截止日期 */}
            {todo.due_date && (() => {
              // 使用本地时区比较日期
              const dueDate = new Date(todo.due_date);
              const now = new Date();
              // 获取本地时区的今天（只比较日期部分）
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              // 获取截止日期的本地时区日期部分（只比较日期，忽略时间）
              const dueDateOnly = new Date(
                dueDate.getFullYear(),
                dueDate.getMonth(),
                dueDate.getDate()
              );
              const isOverdue = !isDone && dueDateOnly.getTime() < today.getTime();
              
              return (
                <div className="flex items-center gap-2">
                  <span>{formatDueDate(todo.due_date)}</span>
                  {isOverdue && (
                    <span className="px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 font-medium">
                      已过期
                    </span>
                  )}
                </div>
              );
            })()}
            {/* 标签 */}
            {todo.tags.length > 0 && (
              <div className="flex items-center gap-1">
                {todo.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded bg-accent text-accent-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 任务详情弹窗 */}
      {showDetail && (
        <TodoDetail
          todo={todo}
          userId={userId}
          onClose={() => setShowDetail(false)}
          onUpdate={(updatedTodo) => {
            onUpdate(updatedTodo);
            setShowDetail(false);
          }}
          onDelete={() => {
            onUpdate();
            setShowDetail(false);
          }}
        />
      )}
    </div>
  );
}

