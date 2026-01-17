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
  newTodo?: Todo | null; // 新创建的任务
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
  newTodo,
}: TodoListViewProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastNewTodo, setLastNewTodo] = useState<Todo | null>(null);

  const loadTodos = useCallback(async () => {
    setLoading(true);
    try {
      // 处理特殊筛选：今天、已完成
      let actualListId: string | null | undefined = null;
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
        // "今天"视图应该显示所有状态的任务
        actualStatusFilter = "all";
      } else if (listId === "done") {
        // 已完成的任务：强制使用"done"状态
        actualStatusFilter = "done";
      } else if (listId === null) {
        // "全部任务"视图：不设置 list_id，这样 getTodos 不会进行清单筛选
        actualListId = undefined;
      } else {
        actualListId = listId;
      }

      // 高级筛选优先级：如果设置了高级筛选，使用高级筛选的值
      // 但是，如果当前是"今天"或"已完成"视图，优先使用视图的筛选条件
      const baseFinalListId = listIdFilter !== undefined ? listIdFilter : actualListId;
      let finalStatus = actualStatusFilter;
      let finalDueDateFrom = propDueDateFrom !== undefined ? propDueDateFrom : dueDateFrom;
      let finalDueDateTo = propDueDateTo !== undefined ? propDueDateTo : dueDateTo;

      // 如果当前是"今天"视图，强制使用今天的日期范围，忽略高级筛选的日期
      // "今天"视图应该显示所有状态的任务
      if (listId === "today") {
        finalDueDateFrom = dueDateFrom;
        finalDueDateTo = dueDateTo;
        finalStatus = "all"; // "今天"视图显示所有状态的任务
      }

      // 如果当前是"已完成"视图，强制使用"done"状态，忽略其他状态筛选
      if (listId === "done") {
        finalStatus = "done";
      }

      // finalListId 在构建查询选项时使用
      const finalListId = baseFinalListId;

      // 构建查询选项，如果是"全部任务"视图（finalListId === undefined），不传递 list_id
      const queryOptions: Parameters<typeof getTodos>[1] = {
        status: finalStatus,
        priority: priorityFilter !== undefined ? priorityFilter : "all",
        tags: tagsFilter || [],
        parent_id: null, // 只获取顶级任务
        search: searchQuery,
        sort_by: sortBy,
        sort_order: sortOrder,
        due_date_from: finalDueDateFrom,
        due_date_to: finalDueDateTo,
      };

      // 只有在 finalListId 不是 undefined 时才添加 list_id
      if (finalListId !== undefined) {
        queryOptions.list_id = finalListId;
      }

      const result = await getTodos(userId, queryOptions);
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

  // 处理新创建的任务：如果应该显示在当前视图中，则添加到本地状态
  useEffect(() => {
    if (newTodo && newTodo !== lastNewTodo) {
      setLastNewTodo(newTodo);
      
      // 检查任务是否应该显示在当前视图中
      let shouldShow = true;

      // 检查状态筛选
      if (statusFilter !== "all" && newTodo.status !== statusFilter) {
        shouldShow = false;
      }

      // 检查"今天"视图
      if (listId === "today") {
        if (!newTodo.due_date) {
          shouldShow = false;
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dueDate = new Date(newTodo.due_date);
          if (dueDate < today || dueDate >= tomorrow) {
            shouldShow = false;
          }
        }
      }

      // 检查"已完成"视图
      if (listId === "done" && newTodo.status !== "done") {
        shouldShow = false;
      }

      // 检查清单筛选
      if (listId !== "today" && listId !== "done" && listId !== null) {
        if (newTodo.list_id !== listId) {
          shouldShow = false;
        }
      }

      // 检查高级筛选
      if (listIdFilter !== undefined && newTodo.list_id !== listIdFilter) {
        shouldShow = false;
      }
      if (priorityFilter !== undefined && newTodo.priority !== priorityFilter) {
        shouldShow = false;
      }
      if (tagsFilter && tagsFilter.length > 0) {
        const hasAllTags = tagsFilter.every((tag) => newTodo.tags?.includes(tag));
        if (!hasAllTags) {
          shouldShow = false;
        }
      }
      if (propDueDateFrom && newTodo.due_date && new Date(newTodo.due_date) < new Date(propDueDateFrom)) {
        shouldShow = false;
      }
      if (propDueDateTo && newTodo.due_date && new Date(newTodo.due_date) > new Date(propDueDateTo)) {
        shouldShow = false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesTitle = newTodo.title.toLowerCase().includes(query);
        const matchesDescription = newTodo.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription) {
          shouldShow = false;
        }
      }

      // 如果任务应该显示，添加到列表
      if (shouldShow) {
        setTodos((prev) => {
          // 检查是否已存在（避免重复）
          if (prev.some((t) => t.id === newTodo.id)) {
            return prev;
          }
          // 根据排序方式插入
          const newTodos = [...prev, newTodo];
          if (sortBy === "order_index") {
            newTodos.sort((a, b) => {
              if (sortOrder === "asc") {
                return a.order_index - b.order_index;
              } else {
                return b.order_index - a.order_index;
              }
            });
          } else if (sortBy === "due_date") {
            newTodos.sort((a, b) => {
              const aDate = a.due_date ? new Date(a.due_date).getTime() : 0;
              const bDate = b.due_date ? new Date(b.due_date).getTime() : 0;
              if (sortOrder === "asc") {
                return aDate - bDate;
              } else {
                return bDate - aDate;
              }
            });
          } else if (sortBy === "priority") {
            newTodos.sort((a, b) => {
              if (sortOrder === "asc") {
                return a.priority - b.priority;
              } else {
                return b.priority - a.priority;
              }
            });
          } else if (sortBy === "created_at") {
            newTodos.sort((a, b) => {
              const aDate = new Date(a.created_at).getTime();
              const bDate = new Date(b.created_at).getTime();
              if (sortOrder === "asc") {
                return aDate - bDate;
              } else {
                return bDate - aDate;
              }
            });
          } else if (sortBy === "title") {
            newTodos.sort((a, b) => {
              if (sortOrder === "asc") {
                return a.title.localeCompare(b.title);
              } else {
                return b.title.localeCompare(a.title);
              }
            });
          }
          return newTodos;
        });
      }
    }
  }, [newTodo, lastNewTodo, listId, statusFilter, priorityFilter, tagsFilter, listIdFilter, propDueDateFrom, propDueDateTo, searchQuery, sortBy, sortOrder]);

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

