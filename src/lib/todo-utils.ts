"use client";

import React from "react";
import type { Todo } from "./todo-storage";

// ==================== 智能识别 ====================

export interface ParsedTaskInput {
  title: string;
  due_date?: string | null;
  reminder_time?: string | null;
  tags?: string[];
  priority?: 0 | 1 | 2 | 3;
  isToday?: boolean; // 标记是否为今天的任务
}

/**
 * 解析任务输入，识别日期/时间/标签/优先级
 * @param input 任务输入文本
 * @param reminderBeforeMinutes 提醒时间提前分钟数，默认15分钟
 */
export function parseTaskInput(
  input: string,
  reminderBeforeMinutes: number = 15
): ParsedTaskInput {
  let title = input.trim();
  let due_date: string | null = null;
  let reminder_time: string | null = null;
  const tags: string[] = [];
  let priority: 0 | 1 | 2 | 3 = 0;

  // 提取标签 (#标签名)
  const tagRegex = /#(\w+)/g;
  let match;
  while ((match = tagRegex.exec(input)) !== null) {
    tags.push(match[1]);
    title = title.replace(match[0], "").trim();
  }

  // 提取优先级 (@重要/@高/@中/@低)
  const priorityRegex = /@(重要|高|中|低|high|medium|low)/gi;
  match = priorityRegex.exec(input);
  if (match) {
    const priorityText = match[1].toLowerCase();
    if (priorityText === "重要" || priorityText === "高" || priorityText === "high") {
      priority = 3;
    } else if (priorityText === "中" || priorityText === "medium") {
      priority = 2;
    } else if (priorityText === "低" || priorityText === "low") {
      priority = 1;
    }
    title = title.replace(match[0], "").trim();
  }

  // 提取日期和时间
  const dateTimeResult = parseDateTime(title, reminderBeforeMinutes);
  if (dateTimeResult.due_date) {
    due_date = dateTimeResult.due_date;
  }
  if (dateTimeResult.reminder_time) {
    reminder_time = dateTimeResult.reminder_time;
  }
  title = dateTimeResult.cleanedTitle;

  // 清理多余空格和标点
  title = title.replace(/\s+/g, " ").trim();
  // 移除开头和结尾的逗号、顿号等
  title = title.replace(/^[，,、。\s]+|[，,、。\s]+$/g, "").trim();

  return {
    title,
    due_date,
    reminder_time,
    tags: tags.length > 0 ? tags : undefined,
    priority: priority > 0 ? priority : undefined,
    isToday: dateTimeResult.isToday || false,
  };
}

/**
 * 解析日期和时间
 * @param text 文本内容
 * @param reminderBeforeMinutes 提醒时间提前分钟数，默认15分钟
 */
function parseDateTime(
  text: string,
  reminderBeforeMinutes: number = 15
): {
  due_date: string | null;
  reminder_time: string | null;
  cleanedTitle: string;
  isToday?: boolean;
} {
  let cleanedTitle = text;
  let due_date: string | null = null;
  let reminder_time: string | null = null;
  let isToday = false;
  const now = new Date();

  // 解析相对日期
  const relativeDatePatterns = [
    { pattern: /今天|今日/i, days: 0 },
    { pattern: /明天|明日/i, days: 1 },
    { pattern: /后天/i, days: 2 },
    { pattern: /大后天/i, days: 3 },
    { pattern: /昨天|昨日/i, days: -1 },
    { pattern: /前天/i, days: -2 },
  ];

  for (const { pattern, days } of relativeDatePatterns) {
    if (pattern.test(text)) {
      const date = new Date(now);
      date.setDate(date.getDate() + days);
      date.setHours(0, 0, 0, 0);
      due_date = date.toISOString();
      if (days === 0) {
        isToday = true;
      }
      cleanedTitle = cleanedTitle.replace(pattern, "").trim();
      break;
    }
  }

  // 解析星期
  const weekPatterns = [
    { pattern: /下?周一|下?星期一/i, dayOfWeek: 1 },
    { pattern: /下?周二|下?星期二/i, dayOfWeek: 2 },
    { pattern: /下?周三|下?星期三/i, dayOfWeek: 3 },
    { pattern: /下?周四|下?星期四/i, dayOfWeek: 4 },
    { pattern: /下?周五|下?星期五/i, dayOfWeek: 5 },
    { pattern: /下?周六|下?星期六/i, dayOfWeek: 6 },
    { pattern: /下?周日|下?星期天|下?星期日/i, dayOfWeek: 0 },
  ];

  for (const { pattern, dayOfWeek } of weekPatterns) {
    if (pattern.test(text)) {
      const isNextWeek = /下/.test(text);
      const date = new Date(now);
      const currentDay = date.getDay();
      let daysToAdd = dayOfWeek - currentDay;
      if (daysToAdd <= 0 || isNextWeek) {
        daysToAdd += 7;
      }
      date.setDate(date.getDate() + daysToAdd);
      date.setHours(0, 0, 0, 0);
      due_date = date.toISOString();
      if (daysToAdd === 0) {
        isToday = true;
      }
      cleanedTitle = cleanedTitle.replace(pattern, "").trim();
      break;
    }
  }

  // 解析具体日期 (月/日 或 月-日 或 YYYY-MM-DD)
  // 支持更多格式：数字和汉字形式
  const datePatterns = [
    /(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号]?/, // 2025年3月15日 或 2025-3-15
    /(\d{1,2})[月\-/](\d{1,2})[日号]?/, // 3月15日 或 3/15
    /(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})/, // 2025-3-15
    /(\d{1,2})[月\-/](\d{1,2})/, // 3/15
    /(一|二|三|四|五|六|七|八|九|十|十一|十二)月(\d{1,2})[日号]?/, // 三月十五日
  ];

  for (const datePattern of datePatterns) {
    const dateMatch = text.match(datePattern);
    if (dateMatch) {
      let year: number, month: number, day: number;
      
      // 处理汉字月份
      if (dateMatch[1] && /[一二三四五六七八九十]/.test(dateMatch[1])) {
        const monthMap: Record<string, number> = {
          "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6,
          "七": 7, "八": 8, "九": 9, "十": 10, "十一": 11, "十二": 12
        };
        year = now.getFullYear();
        month = (monthMap[dateMatch[1]] || 1) - 1;
        day = parseInt(dateMatch[2]);
      } else if (dateMatch.length === 4) {
        // 完整日期：2025年3月15日
        year = parseInt(dateMatch[1]);
        month = parseInt(dateMatch[2]) - 1;
        day = parseInt(dateMatch[3]);
      } else {
        // 简单日期：3月15日
        year = now.getFullYear();
        month = parseInt(dateMatch[1]) - 1;
        day = parseInt(dateMatch[2]);
      }
      
      const date = new Date(year, month, day);
      if (date < now && dateMatch.length === 3) {
        // 如果只有月/日，且已过期，则设为明年
        date.setFullYear(date.getFullYear() + 1);
      }
      date.setHours(0, 0, 0, 0);
      
      // 检查是否是今天
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      if (date.getTime() === today.getTime()) {
        isToday = true;
      }
      
      due_date = date.toISOString();
      cleanedTitle = cleanedTitle.replace(datePattern, "").trim();
      break;
    }
  }

  // 解析时间 (时:分 或 时点)
  // 支持更多格式：数字和汉字形式
  const timePatterns = [
    /(\d{1,2}):(\d{2})/, // 15:30
    /(上午|下午|晚上|凌晨|中午)(\d{1,2})点(?:(\d{1,2})分)?/, // 下午3点 或 下午3点30分
    /(\d{1,2})点(?:(\d{1,2})分)?/, // 3点 或 3点30分
    /(上午|下午|晚上|凌晨|中午)(\d{1,2}):(\d{2})/, // 下午3:30
    /([零一二三四五六七八九十]+)点(?:([零一二三四五六七八九十]+)分)?/, // 三点 或 三点三十分
  ];

  let timeFound = false;
  for (const pattern of timePatterns) {
    const timeMatch = text.match(pattern);
    if (timeMatch) {
      let hours = 0;
      let minutes = 0;

      let period: string | undefined = undefined;

      // 处理汉字时间
      if (timeMatch[1] && /[零一二三四五六七八九十]/.test(timeMatch[1])) {
        const numberMap: Record<string, number> = {
          "零": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
          "六": 6, "七": 7, "八": 8, "九": 9, "十": 10,
          "十一": 11, "十二": 12, "十三": 13, "十四": 14, "十五": 15,
          "十六": 16, "十七": 17, "十八": 18, "十九": 19, "二十": 20,
          "二十一": 21, "二十二": 22, "二十三": 23
        };
        hours = numberMap[timeMatch[1]] || 0;
        if (timeMatch[2]) {
          minutes = numberMap[timeMatch[2]] || 0;
        }
      } else {
        // 数字时间
        // 检查第一个匹配组是否是上午/下午/晚上/凌晨/中午
        if (/(上午|下午|晚上|凌晨|中午)/.test(timeMatch[1])) {
          // 带上午/下午的格式：下午3点30分 或 下午3:30
          period = timeMatch[1];
          hours = parseInt(timeMatch[2]);
          minutes = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
        } else if (timeMatch.length === 4 && timeMatch[1].includes(":")) {
          // 24小时制：15:30
          hours = parseInt(timeMatch[1]);
          minutes = parseInt(timeMatch[2]);
        } else if (timeMatch.length >= 3) {
          // 简单格式：3点30分
          hours = parseInt(timeMatch[1]);
          minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        } else {
          // 最简单格式：3点
          hours = parseInt(timeMatch[1]);
          minutes = 0;
        }
      }

      // 处理上午/下午/晚上/凌晨/中午
      if (period === "下午" || period === "晚上") {
        if (hours < 12) hours += 12;
      } else if (period === "凌晨" && hours === 12) {
        hours = 0;
      } else if (period === "中午" && hours !== 12) {
        // 中午通常是12点
        if (hours < 12) hours = 12;
      }

      // 创建时间日期对象
      const timeDate = due_date ? new Date(due_date) : new Date(now);
      timeDate.setHours(hours, minutes, 0, 0);

      // 如果没有日期，使用今天或明天
      if (!due_date) {
        if (timeDate < now) {
          timeDate.setDate(timeDate.getDate() + 1);
        }
        due_date = timeDate.toISOString();
        
        // 检查是否是今天
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const timeDateOnly = new Date(timeDate);
        timeDateOnly.setHours(0, 0, 0, 0);
        if (timeDateOnly.getTime() === today.getTime()) {
          isToday = true;
        }
      } else {
        // 如果已有日期，更新日期的时间部分
        due_date = timeDate.toISOString();
      }

      // 提醒时间设置为截止时间前指定分钟数
      const reminderDate = new Date(timeDate);
      reminderDate.setMinutes(reminderDate.getMinutes() - reminderBeforeMinutes);
      reminder_time = reminderDate.toISOString();

      cleanedTitle = cleanedTitle.replace(pattern, "").trim();
      timeFound = true;
      break;
    }
  }

  // 如果没有找到时间但有日期，提醒时间设置为日期当天的9点前指定分钟数
  if (!timeFound && due_date) {
    const reminderDate = new Date(due_date);
    reminderDate.setHours(8, 60 - reminderBeforeMinutes, 0, 0);
    reminder_time = reminderDate.toISOString();
  }

  return { due_date, reminder_time, cleanedTitle, isToday };
}

// ==================== 格式化 ====================

/**
 * 格式化截止日期显示
 */
export function formatDueDate(date: string | null): string {
  if (!date) return "";

  const dueDate = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDateOnly = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate()
  );

  if (dueDateOnly.getTime() === today.getTime()) {
    return "今天";
  } else if (dueDateOnly.getTime() === tomorrow.getTime()) {
    return "明天";
  } else {
    const diffDays = Math.ceil(
      (dueDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < 0) {
      return `${Math.abs(diffDays)}天前`;
    } else if (diffDays <= 7) {
      return `${diffDays}天后`;
    } else {
      return dueDate.toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
      });
    }
  }
}

/**
 * 格式化完整日期时间
 */
export function formatDateTime(date: string | null): string {
  if (!date) return "";

  const dateObj = new Date(date);
  return dateObj.toLocaleString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ==================== 颜色工具 ====================

/**
 * 获取优先级颜色
 */
export function getPriorityColor(priority: 0 | 1 | 2 | 3): string {
  switch (priority) {
    case 3:
      return "#EF4444"; // 红色 - 高优先级
    case 2:
      return "#F59E0B"; // 橙色 - 中优先级
    case 1:
      return "#3B82F6"; // 蓝色 - 低优先级
    default:
      return "#6B7280"; // 灰色 - 无优先级
  }
}

/**
 * 获取状态颜色
 */
export function getStatusColor(
  status: "todo" | "in_progress" | "done" | "archived"
): string {
  switch (status) {
    case "done":
      return "#10B981"; // 绿色 - 已完成
    case "in_progress":
      return "#3B82F6"; // 蓝色 - 进行中
    case "archived":
      return "#6B7280"; // 灰色 - 已归档
    default:
      return "#6B7280"; // 灰色 - 待办
  }
}

// ==================== 统计工具 ====================

/**
 * 计算完成率
 */
export function calculateCompletionRate(todos: Todo[]): {
  completed: number;
  total: number;
  rate: number;
} {
  const total = todos.length;
  const completed = todos.filter((todo) => todo.status === "done").length;
  const rate = total > 0 ? (completed / total) * 100 : 0;

  return {
    completed,
    total,
    rate: Math.round(rate * 100) / 100,
  };
}

/**
 * 按日期分组任务
 */
export function groupTodosByDate(todos: Todo[]): Map<string, Todo[]> {
  const groups = new Map<string, Todo[]>();

  todos.forEach((todo) => {
    if (!todo.due_date) {
      const key = "无日期";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(todo);
      return;
    }

    const date = new Date(todo.due_date);
    const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(todo);
  });

  return groups;
}

// ==================== 筛选和排序 ====================

export interface TodoFilters {
  status?: "todo" | "in_progress" | "done" | "archived" | "all";
  priority?: 0 | 1 | 2 | 3 | "all";
  tags?: string[];
  list_id?: string | null;
  due_date_from?: string | null;
  due_date_to?: string | null;
  search?: string;
}

/**
 * 筛选任务
 */
export function filterTodos(todos: Todo[], filters: TodoFilters): Todo[] {
  let filtered = [...todos];

  // 状态筛选
  if (filters.status && filters.status !== "all") {
    filtered = filtered.filter((todo) => todo.status === filters.status);
  }

  // 优先级筛选
  if (filters.priority && filters.priority !== "all") {
    filtered = filtered.filter((todo) => todo.priority === filters.priority);
  }

  // 标签筛选
  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter((todo) =>
      todo.tags && filters.tags!.some((tag) => todo.tags.includes(tag))
    );
  }

  // 清单筛选
  if (filters.list_id !== undefined) {
    if (filters.list_id === null) {
      filtered = filtered.filter((todo) => todo.list_id === null);
    } else {
      filtered = filtered.filter((todo) => todo.list_id === filters.list_id);
    }
  }

  // 日期范围筛选
  if (filters.due_date_from) {
    filtered = filtered.filter(
      (todo) => todo.due_date && todo.due_date >= filters.due_date_from!
    );
  }
  if (filters.due_date_to) {
    filtered = filtered.filter(
      (todo) => todo.due_date && todo.due_date <= filters.due_date_to!
    );
  }

  // 搜索
  if (filters.search && filters.search.trim()) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(
      (todo) =>
        todo.title.toLowerCase().includes(searchLower) ||
        (todo.description &&
          todo.description.toLowerCase().includes(searchLower)) ||
        (todo.tags && todo.tags.some((tag) => tag.toLowerCase().includes(searchLower)))
    );
  }

  return filtered;
}

export type SortBy =
  | "created_at"
  | "updated_at"
  | "due_date"
  | "priority"
  | "title"
  | "order_index";

/**
 * 排序任务
 */
export function sortTodos(
  todos: Todo[],
  sortBy: SortBy = "order_index",
  sortOrder: "asc" | "desc" = "asc"
): Todo[] {
  const sorted = [...todos];

  sorted.sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortBy) {
      case "created_at":
      case "updated_at":
      case "due_date":
        aValue = a[sortBy] ? new Date(a[sortBy]!).getTime() : 0;
        bValue = b[sortBy] ? new Date(b[sortBy]!).getTime() : 0;
        break;
      case "priority":
      case "order_index":
        aValue = a[sortBy];
        bValue = b[sortBy];
        break;
      case "title":
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  return sorted;
}

// ==================== 树形结构 ====================

export interface TodoTree extends Todo {
  children?: TodoTree[];
}

/**
 * 构建任务树（父子关系）
 */
export function buildTodoTree(todos: Todo[]): TodoTree[] {
  const todoMap = new Map<string, TodoTree>();
  const rootTodos: TodoTree[] = [];

  // 创建所有节点的映射
  todos.forEach((todo) => {
    todoMap.set(todo.id, { ...todo, children: [] });
  });

  // 构建树形结构
  todos.forEach((todo) => {
    const node = todoMap.get(todo.id)!;
    if (todo.parent_id) {
      const parent = todoMap.get(todo.parent_id);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
      } else {
        // 父节点不存在，作为根节点
        rootTodos.push(node);
      }
    } else {
      rootTodos.push(node);
    }
  });

  // 对每个节点的子节点排序
  const sortChildren = (nodes: TodoTree[]) => {
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        node.children = sortTodos(node.children, "order_index", "asc");
        sortChildren(node.children);
      }
    });
  };

  sortChildren(rootTodos);
  return sortTodos(rootTodos, "order_index", "asc");
}

/**
 * 扁平化任务树
 */
export function flattenTodoTree(tree: TodoTree[]): Todo[] {
  const result: Todo[] = [];

  const traverse = (nodes: TodoTree[]) => {
    nodes.forEach((node) => {
      const { children, ...todo } = node;
      result.push(todo);
      if (children && children.length > 0) {
        traverse(children);
      }
    });
  };

  traverse(tree);
  return result;
}

/**
 * 查找任务树中的节点
 */
export function findTodoInTree(
  tree: TodoTree[],
  id: string
): TodoTree | null {
  for (const node of tree) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const found = findTodoInTree(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 获取任务路径（从根到当前节点的路径）
 */
export function getTodoPath(tree: TodoTree[], id: string): TodoTree[] {
  const path: TodoTree[] = [];

  const findPath = (nodes: TodoTree[], targetId: string): boolean => {
    for (const node of nodes) {
      path.push(node);
      if (node.id === targetId) {
        return true;
      }
      if (node.children && findPath(node.children, targetId)) {
        return true;
      }
      path.pop();
    }
    return false;
  };

  findPath(tree, id);
  return path;
}

// ==================== 文本高亮 ====================

/**
 * 高亮文本中的关键词
 * 返回包含 <mark> 标签的 JSX 元素
 */
export function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let index = textLower.indexOf(queryLower, lastIndex);

  while (index !== -1) {
    // 添加高亮前的文本
    if (index > lastIndex) {
      parts.push(text.substring(lastIndex, index));
    }

    // 添加高亮文本
    parts.push(
      React.createElement(
        "mark",
        {
          key: index,
          className: "bg-yellow-200 dark:bg-yellow-800 rounded px-0.5",
        },
        text.substring(index, index + query.length)
      )
    );

    lastIndex = index + query.length;
    index = textLower.indexOf(queryLower, lastIndex);
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? React.createElement(React.Fragment, null, ...parts) : text;
}

