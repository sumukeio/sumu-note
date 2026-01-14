"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { getTodos, type Todo } from "@/lib/todo-storage";
import TodoList from "./TodoList";
import TodoCalendar from "./TodoCalendar";
import TodoKanban from "./TodoKanban";
import TodoQuadrant from "./TodoQuadrant";
import TodoTimeline from "./TodoTimeline";
import TodoGantt from "./TodoGantt";
import { cn } from "@/lib/utils";

interface TodoListViewProps {
  userId: string;
  listId: string | null | "today" | "done";
  viewMode: "list" | "calendar" | "kanban" | "quadrant" | "timeline" | "gantt";
  refreshKey?: number;
  searchQuery?: string;
  statusFilter?: "all" | "todo" | "in_progress" | "done";
  priorityFilter?: 0 | 1 | 2 | 3;
  tagsFilter?: string[];
  listIdFilter?: string;
  dueDateFrom?: string | null;
  dueDateTo?: string | null;
  sortBy?: "order_index" | "due_date" | "priority" | "created_at" | "title";
  sortOrder?: "asc" | "desc";
}

export default function TodoListView({
  userId,
  listId,
  viewMode,
  refreshKey = 0,
  searchQuery = "",
  statusFilter = "all",
  priorityFilter,
  tagsFilter,
  listIdFilter,
  dueDateFrom: propDueDateFrom,
  dueDateTo: propDueDateTo,
  sortBy = "order_index",
  sortOrder = "asc",
}: TodoListViewProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTodos = useCallback(async () => {
    setLoading(true);
    try {
      // 处理特殊筛选：今天、已完成
      let actualListId: string | null = null;
      let actualStatusFilter: "all" | "todo" | "in_progress" | "done" = statusFilter;
      let dueDateFrom: string | null = null;
      let dueDateTo: string | null = null;

      if (listId === "today") {
        // 今天的任务：截止日期在今天
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        dueDateFrom = today.toISOString();
        dueDateTo = tomorrow.toISOString();
      } else if (listId === "done") {
        // 已完成的任务
        actualStatusFilter = "done";
      } else {
        actualListId = listId;
      }

      // 高级筛选优先级：如果设置了高级筛选，使用高级筛选的值
      const finalListId = listIdFilter !== undefined ? listIdFilter : actualListId;
      const finalStatus = actualStatusFilter;
      const finalDueDateFrom = propDueDateFrom !== undefined ? propDueDateFrom : dueDateFrom;
      const finalDueDateTo = propDueDateTo !== undefined ? propDueDateTo : dueDateTo;

      const result = await getTodos(userId, {
        list_id: finalListId,
        status: finalStatus,
        priority: priorityFilter !== undefined ? priorityFilter : "all",
        tags: tagsFilter || [],
        parent_id: null, // 只获取顶级任务
        search: searchQuery,
        sort_by: sortBy,
        sort_order: sortOrder,
        due_date_from: finalDueDateFrom,
        due_date_to: finalDueDateTo,
      });
      setTodos(result.todos);
    } catch (error) {
      console.error("Failed to load todos:", error);
    } finally {
      setLoading(false);
    }
  }, [
    userId,
    listId,
    statusFilter,
    priorityFilter,
    tagsFilter,
    listIdFilter,
    propDueDateFrom,
    propDueDateTo,
    searchQuery,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos, refreshKey]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 根据视图模式渲染不同组件
  switch (viewMode) {
    case "list":
      return (
        <TodoList
          todos={todos}
          userId={userId}
          onRefresh={loadTodos}
          searchQuery={searchQuery}
        />
      );
    case "calendar":
      return (
        <TodoCalendar
          todos={todos}
          userId={userId}
          onRefresh={loadTodos}
        />
      );
    case "kanban":
      return (
        <TodoKanban todos={todos} userId={userId} onRefresh={loadTodos} />
      );
    case "quadrant":
      return (
        <TodoQuadrant todos={todos} userId={userId} onRefresh={loadTodos} />
      );
    case "timeline":
      return (
        <TodoTimeline todos={todos} userId={userId} onRefresh={loadTodos} />
      );
    case "gantt":
      return (
        <TodoGantt todos={todos} userId={userId} onRefresh={loadTodos} />
      );
    default:
      return <TodoList todos={todos} userId={userId} />;
  }
}

