"use client";

import { useState, useEffect, useRef } from "react";
import { Flag, Trash2, Move, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Todo, type TodoList, getTodoLists, updateTodo, deleteTodo, moveTodo } from "@/lib/todo-storage";
import { getPriorityColor } from "@/lib/todo-utils";
import { cn } from "@/lib/utils";

interface TodoContextMenuProps {
  todo: Todo;
  userId: string;
  position: { x: number; y: number };
  onClose: () => void;
  onUpdate?: () => void;
  onDelete?: () => void;
}

export default function TodoContextMenu({
  todo,
  userId,
  position,
  onClose,
  onUpdate,
  onDelete,
}: TodoContextMenuProps) {
  const [lists, setLists] = useState<TodoList[]>([]);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadLists = async () => {
      try {
        const listsData = await getTodoLists(userId);
        setLists(listsData);
      } catch (error) {
        console.error("Failed to load lists:", error);
      }
    };
    loadLists();
  }, [userId]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleSetPriority = async (priority: 0 | 1 | 2 | 3) => {
    try {
      await updateTodo(todo.id, { priority });
      setShowPriorityMenu(false);
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error("Failed to update priority:", error);
    }
  };

  const handleMoveToList = async (listId: string | null) => {
    try {
      await moveTodo(todo.id, listId);
      setShowListMenu(false);
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error("Failed to move todo:", error);
    }
  };

  const handleDelete = async () => {
    if (!confirm("确定要删除这个任务吗？")) {
      return;
    }
    try {
      await deleteTodo(todo.id);
      onDelete?.();
      onClose();
    } catch (error) {
      console.error("Failed to delete todo:", error);
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-background border border-border rounded-lg shadow-lg p-1 min-w-[180px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {/* 设置优先级 */}
      <div className="relative">
        <button
          onClick={() => setShowPriorityMenu(!showPriorityMenu)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors"
        >
          <Flag className="w-4 h-4" />
          <span>设置优先级</span>
        </button>
        {showPriorityMenu && (
          <div className="absolute left-full top-0 ml-1 bg-background border border-border rounded-lg shadow-lg p-1 min-w-[140px]">
            {[
              { value: 0, label: "无优先级" },
              { value: 1, label: "低优先级" },
              { value: 2, label: "中优先级" },
              { value: 3, label: "高优先级" },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => handleSetPriority(p.value as 0 | 1 | 2 | 3)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors",
                  todo.priority === p.value && "bg-accent"
                )}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      p.value > 0 ? getPriorityColor(p.value as 0 | 1 | 2 | 3) : "transparent",
                  }}
                />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 移动到清单 */}
      <div className="relative">
        <button
          onClick={() => setShowListMenu(!showListMenu)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors"
        >
          <Move className="w-4 h-4" />
          <span>移动到清单</span>
        </button>
        {showListMenu && (
          <div className="absolute left-full top-0 ml-1 bg-background border border-border rounded-lg shadow-lg p-1 min-w-[140px] max-h-[200px] overflow-y-auto">
            <button
              onClick={() => handleMoveToList(null)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors",
                !todo.list_id && "bg-accent"
              )}
            >
              无清单
            </button>
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => handleMoveToList(list.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors",
                  todo.list_id === list.id && "bg-accent"
                )}
              >
                {list.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 删除 */}
      <button
        onClick={handleDelete}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors text-destructive hover:text-destructive"
      >
        <Trash2 className="w-4 h-4" />
        <span>删除</span>
      </button>
    </div>
  );
}



