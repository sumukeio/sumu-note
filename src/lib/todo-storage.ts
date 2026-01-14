"use client";

import { supabase } from "./supabase";

// ==================== 类型定义 ====================

export interface Todo {
  id: string;
  user_id: string;
  list_id: string | null;
  parent_id: string | null;
  title: string;
  description: string | null;
  priority: 0 | 1 | 2 | 3; // 0:无, 1:低, 2:中, 3:高
  status: "todo" | "in_progress" | "done" | "archived";
  due_date: string | null;
  reminder_time: string | null;
  completed_at: string | null;
  order_index: number;
  tags: string[];
  repeat_rule: RepeatRule | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface RepeatRule {
  type: "daily" | "weekly" | "monthly" | "yearly" | "custom";
  interval: number; // 间隔（如每2天）
  days_of_week?: number[]; // 每周的星期几（0-6，0=周日）
  day_of_month?: number; // 每月的第几天
  end_date?: string | null; // 结束日期
  end_after_count?: number | null; // 重复N次后结束
}

export interface TodoList {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  order_index: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTodoData {
  title: string;
  description?: string;
  list_id?: string | null;
  parent_id?: string | null;
  priority?: 0 | 1 | 2 | 3;
  status?: "todo" | "in_progress" | "done" | "archived";
  due_date?: string | null;
  reminder_time?: string | null;
  tags?: string[];
  repeat_rule?: RepeatRule | null;
  order_index?: number;
}

export interface UpdateTodoData {
  title?: string;
  description?: string;
  list_id?: string | null;
  parent_id?: string | null;
  priority?: 0 | 1 | 2 | 3;
  status?: "todo" | "in_progress" | "done" | "archived";
  due_date?: string | null;
  reminder_time?: string | null;
  tags?: string[];
  repeat_rule?: RepeatRule | null;
  order_index?: number;
  completed_at?: string | null;
}

export interface TodoQueryOptions {
  list_id?: string | null;
  status?: "todo" | "in_progress" | "done" | "archived" | "all";
  priority?: 0 | 1 | 2 | 3 | "all";
  tags?: string[];
  search?: string;
  due_date_from?: string | null;
  due_date_to?: string | null;
  parent_id?: string | null; // null 表示只获取顶级任务，undefined 表示获取所有
  sort_by?: "created_at" | "updated_at" | "due_date" | "priority" | "title" | "order_index";
  sort_order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface TodoListResult {
  todos: Todo[];
  total: number;
}

export interface CreateTodoListData {
  name: string;
  color?: string | null;
  icon?: string | null;
  is_default?: boolean;
  order_index?: number;
}

export interface UpdateTodoListData {
  name?: string;
  color?: string | null;
  icon?: string | null;
  is_default?: boolean;
  order_index?: number;
}

// ==================== 任务 CRUD ====================

/**
 * 创建任务
 */
export async function createTodo(
  userId: string,
  data: CreateTodoData
): Promise<Todo> {
  // 如果没有指定 list_id，使用默认清单
  let listId = data.list_id;
  if (!listId) {
    const defaultList = await getDefaultTodoList(userId);
    listId = defaultList?.id || null;
  }

  // 如果没有指定 order_index，自动计算
  let orderIndex = data.order_index;
  if (orderIndex === undefined) {
    const { data: siblings } = await supabase
      .from("todos")
      .select("order_index")
      .eq("user_id", userId)
      .eq("list_id", listId)
      .eq("parent_id", data.parent_id || null)
      .eq("is_deleted", false)
      .order("order_index", { ascending: false })
      .limit(1);

    orderIndex = siblings && siblings.length > 0 ? (siblings[0].order_index + 1) : 0;
  }

  const { data: todo, error } = await supabase
    .from("todos")
    .insert({
      user_id: userId,
      list_id: listId,
      parent_id: data.parent_id || null,
      title: data.title,
      description: data.description || null,
      priority: data.priority ?? 0,
      status: data.status || "todo",
      due_date: data.due_date || null,
      reminder_time: data.reminder_time || null,
      tags: data.tags || [],
      repeat_rule: data.repeat_rule || null,
      order_index: orderIndex,
      is_deleted: false,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create todo:", error);
    throw new Error(error.message || "创建任务失败");
  }

  return todo as Todo;
}

/**
 * 获取任务列表（支持筛选、排序、分页）
 */
export async function getTodos(
  userId: string,
  options: TodoQueryOptions = {}
): Promise<TodoListResult> {
  const {
    list_id,
    status = "all",
    priority = "all",
    tags = [],
    search = "",
    due_date_from,
    due_date_to,
    parent_id,
    sort_by = "order_index",
    sort_order = "asc",
    page = 1,
    page_size = 100,
  } = options;

  let query = supabase
    .from("todos")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .eq("is_deleted", false);

  // 清单过滤
  if (list_id !== undefined) {
    if (list_id === null) {
      query = query.is("list_id", null);
    } else {
      query = query.eq("list_id", list_id);
    }
  }

  // 状态过滤
  if (status !== "all") {
    query = query.eq("status", status);
  }

  // 优先级过滤
  if (priority !== "all") {
    query = query.eq("priority", priority);
  }

  // 标签过滤
  if (tags.length > 0) {
    query = query.contains("tags", tags);
  }

  // 日期范围过滤
  if (due_date_from) {
    query = query.gte("due_date", due_date_from);
  }
  if (due_date_to) {
    query = query.lte("due_date", due_date_to);
  }

  // 父任务过滤
  if (parent_id !== undefined) {
    if (parent_id === null) {
      query = query.is("parent_id", null);
    } else {
      query = query.eq("parent_id", parent_id);
    }
  }

  // 搜索
  if (search.trim()) {
    query = query.or(
      `title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`
    );
  }

  // 排序
  query = query.order(sort_by, { ascending: sort_order === "asc" });

  // 分页
  const offset = (page - 1) * page_size;
  query = query.range(offset, offset + page_size - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Failed to fetch todos:", error);
    throw new Error(error.message || "获取任务列表失败");
  }

  return {
    todos: (data || []) as Todo[],
    total: typeof count === "number" ? count : (data?.length ?? 0),
  };
}

/**
 * 根据 ID 获取单个任务
 */
export async function getTodoById(id: string): Promise<Todo | null> {
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch todo:", error);
    throw new Error(error.message || "获取任务失败");
  }

  return data as Todo | null;
}

/**
 * 更新任务
 */
export async function updateTodo(
  id: string,
  data: UpdateTodoData
): Promise<Todo> {
  const { data: updatedTodo, error } = await supabase
    .from("todos")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update todo:", error);
    throw new Error(error.message || "更新任务失败");
  }

  return updatedTodo as Todo;
}

/**
 * 批量更新任务
 */
export async function batchUpdateTodos(
  ids: string[],
  data: UpdateTodoData
): Promise<void> {
  if (ids.length === 0) return;

  const { error } = await supabase
    .from("todos")
    .update(data)
    .in("id", ids);

  if (error) {
    console.error("Failed to batch update todos:", error);
    throw new Error(error.message || "批量更新任务失败");
  }
}

/**
 * 批量删除任务
 */
export async function batchDeleteTodos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const { error } = await supabase
    .from("todos")
    .update({ is_deleted: true })
    .in("id", ids);

  if (error) {
    console.error("Failed to batch delete todos:", error);
    throw new Error(error.message || "批量删除任务失败");
  }
}

/**
 * 批量完成任务
 */
export async function batchCompleteTodos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const completedAt = new Date().toISOString();
  
  // 批量更新任务状态
  await batchUpdateTodos(ids, {
    status: "done",
    completed_at: completedAt,
  });

  // 为每个任务检查是否有子任务需要完成
  for (const id of ids) {
    const subtodos = await getSubtodos(id);
    if (subtodos.length > 0) {
      const subtodoIds = subtodos
        .filter((st) => st.status !== "done")
        .map((st) => st.id);
      
      if (subtodoIds.length > 0) {
        await batchUpdateTodos(subtodoIds, {
          status: "done",
          completed_at: completedAt,
        });
      }
    }
  }
}

/**
 * 删除任务（软删除）
 */
export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase
    .from("todos")
    .update({ is_deleted: true })
    .eq("id", id);

  if (error) {
    console.error("Failed to delete todo:", error);
    throw new Error(error.message || "删除任务失败");
  }
}

/**
 * 完成任务
 */
export async function completeTodo(id: string): Promise<Todo> {
  const { data: updatedTodo, error } = await supabase
    .from("todos")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to complete todo:", error);
    throw new Error(error.message || "完成任务失败");
  }

  // 如果有重复规则，创建下一个任务
  const todo = updatedTodo as Todo;
  if (todo.repeat_rule) {
    await createNextRepeatTodo(todo);
  }

  // 自动完成所有子任务
  const subtodos = await getSubtodos(id);
  if (subtodos.length > 0) {
    const subtodoIds = subtodos
      .filter((st) => st.status !== "done")
      .map((st) => st.id);
    
    if (subtodoIds.length > 0) {
      // 批量更新子任务状态为已完成
      await supabase
        .from("todos")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
        })
        .in("id", subtodoIds);
    }
  }

  return todo;
}

/**
 * 取消完成
 */
export async function uncompleteTodo(id: string): Promise<Todo> {
  const { data: updatedTodo, error } = await supabase
    .from("todos")
    .update({
      status: "todo",
      completed_at: null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to uncomplete todo:", error);
    throw new Error(error.message || "取消完成失败");
  }

  return updatedTodo as Todo;
}

/**
 * 移动任务到清单
 */
export async function moveTodo(
  id: string,
  listId: string | null
): Promise<Todo> {
  const { data: updatedTodo, error } = await supabase
    .from("todos")
    .update({ list_id: listId })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to move todo:", error);
    throw new Error(error.message || "移动任务失败");
  }

  return updatedTodo as Todo;
}

/**
 * 批量更新排序
 */
export async function reorderTodos(
  todoIds: string[]
): Promise<void> {
  await Promise.all(
    todoIds.map((id, index) =>
      supabase
        .from("todos")
        .update({ order_index: index })
        .eq("id", id)
    )
  );
}

/**
 * 创建下一个重复任务
 */
async function createNextRepeatTodo(todo: Todo): Promise<void> {
  if (!todo.repeat_rule) return;

  const rule = todo.repeat_rule;
  const dueDate = todo.due_date ? new Date(todo.due_date) : new Date();
  let nextDueDate: Date | null = null;

  // 检查是否应该结束重复
  if (rule.end_date) {
    const endDate = new Date(rule.end_date);
    if (dueDate >= endDate) return;
  }

  if (rule.end_after_count !== null && rule.end_after_count !== undefined) {
    // 这里需要跟踪重复次数，简化处理，暂时跳过
  }

  // 计算下一个日期
  switch (rule.type) {
    case "daily":
      nextDueDate = new Date(dueDate);
      nextDueDate.setDate(nextDueDate.getDate() + rule.interval);
      break;
    case "weekly":
      nextDueDate = new Date(dueDate);
      nextDueDate.setDate(nextDueDate.getDate() + 7 * rule.interval);
      break;
    case "monthly":
      nextDueDate = new Date(dueDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + rule.interval);
      break;
    case "yearly":
      nextDueDate = new Date(dueDate);
      nextDueDate.setFullYear(nextDueDate.getFullYear() + rule.interval);
      break;
    case "custom":
      nextDueDate = new Date(dueDate);
      nextDueDate.setDate(nextDueDate.getDate() + rule.interval);
      break;
  }

  if (nextDueDate) {
    await createTodo(todo.user_id, {
      title: todo.title,
      description: todo.description || undefined,
      list_id: todo.list_id,
      parent_id: todo.parent_id,
      priority: todo.priority,
      status: "todo",
      due_date: nextDueDate.toISOString(),
      reminder_time: todo.reminder_time,
      tags: todo.tags,
      repeat_rule: todo.repeat_rule,
    });
  }
}

// ==================== 清单 CRUD ====================

/**
 * 创建清单
 */
export async function createTodoList(
  userId: string,
  data: CreateTodoListData
): Promise<TodoList> {
  // 如果没有指定 order_index，自动计算
  let orderIndex = data.order_index;
  if (orderIndex === undefined) {
    const { data: lists } = await supabase
      .from("todo_lists")
      .select("order_index")
      .eq("user_id", userId)
      .order("order_index", { ascending: false })
      .limit(1);

    orderIndex = lists && lists.length > 0 ? (lists[0].order_index + 1) : 0;
  }

  // 如果设置为默认清单，先取消其他默认清单
  if (data.is_default) {
    await supabase
      .from("todo_lists")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("is_default", true);
  }

  const { data: list, error } = await supabase
    .from("todo_lists")
    .insert({
      user_id: userId,
      name: data.name,
      color: data.color || null,
      icon: data.icon || null,
      is_default: data.is_default || false,
      order_index: orderIndex,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create todo list:", error);
    throw new Error(error.message || "创建清单失败");
  }

  return list as TodoList;
}

/**
 * 获取用户的清单列表
 */
export async function getTodoLists(userId: string): Promise<TodoList[]> {
  const { data, error } = await supabase
    .from("todo_lists")
    .select("*")
    .eq("user_id", userId)
    .order("order_index", { ascending: true });

  if (error) {
    console.error("Failed to fetch todo lists:", error);
    throw new Error(error.message || "获取清单列表失败");
  }

  return (data || []) as TodoList[];
}

/**
 * 获取默认清单
 */
export async function getDefaultTodoList(
  userId: string
): Promise<TodoList | null> {
  const { data, error } = await supabase
    .from("todo_lists")
    .select("*")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch default todo list:", error);
    return null;
  }

  if (data) {
    return data as TodoList;
  }

  // 如果没有默认清单，创建一个
  return await createTodoList(userId, {
    name: "默认清单",
    is_default: true,
  });
}

/**
 * 根据 ID 获取单个清单
 */
export async function getTodoListById(id: string): Promise<TodoList | null> {
  const { data, error } = await supabase
    .from("todo_lists")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch todo list:", error);
    throw new Error(error.message || "获取清单失败");
  }

  return data as TodoList | null;
}

/**
 * 更新清单
 */
export async function updateTodoList(
  id: string,
  data: UpdateTodoListData
): Promise<TodoList> {
  // 如果设置为默认清单，先取消其他默认清单
  if (data.is_default) {
    const { data: list } = await supabase
      .from("todo_lists")
      .select("user_id")
      .eq("id", id)
      .single();

    if (list) {
      await supabase
        .from("todo_lists")
        .update({ is_default: false })
        .eq("user_id", list.user_id)
        .eq("is_default", true)
        .neq("id", id);
    }
  }

  const { data: updatedList, error } = await supabase
    .from("todo_lists")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update todo list:", error);
    throw new Error(error.message || "更新清单失败");
  }

  return updatedList as TodoList;
}

/**
 * 删除清单
 */
export async function deleteTodoList(id: string): Promise<void> {
  const { error } = await supabase.from("todo_lists").delete().eq("id", id);

  if (error) {
    console.error("Failed to delete todo list:", error);
    throw new Error(error.message || "删除清单失败");
  }
}

// ==================== 子任务操作 ====================

/**
 * 获取子任务列表
 */
export async function getSubtodos(parentId: string): Promise<Todo[]> {
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("parent_id", parentId)
    .eq("is_deleted", false)
    .order("order_index", { ascending: true });

  if (error) {
    console.error("Failed to fetch subtodos:", error);
    throw new Error(error.message || "获取子任务列表失败");
  }

  return (data || []) as Todo[];
}

/**
 * 创建子任务
 */
export async function createSubtodo(
  parentId: string,
  data: CreateTodoData
): Promise<Todo> {
  // 获取父任务以获取 user_id 和 list_id
  const parentTodo = await getTodoById(parentId);
  if (!parentTodo) {
    throw new Error("父任务不存在");
  }

  return await createTodo(parentTodo.user_id, {
    ...data,
    parent_id: parentId,
    list_id: data.list_id ?? parentTodo.list_id,
  });
}

