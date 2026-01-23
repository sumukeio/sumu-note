"use client";

import { supabase } from "./supabase";
import type { Todo } from "./todo-storage";

// ==================== 提醒管理器 ====================

interface ReminderTimer {
  todoId: string;
  timerId: number;
  reminderTime: Date;
}

class TodoReminderManager {
  private timers: Map<string, ReminderTimer> = new Map();
  private checkInterval: number | null = null;
  private permissionGranted: boolean = false;

  constructor() {
    // 检查浏览器是否支持通知
    if (typeof window !== "undefined" && "Notification" in window) {
      this.requestPermission();
    }
  }

  /**
   * 请求通知权限
   */
  async requestPermission(): Promise<boolean> {
    if (typeof window === "undefined" || !("Notification" in window)) {
      console.warn("浏览器不支持通知功能");
      return false;
    }

    if (Notification.permission === "granted") {
      this.permissionGranted = true;
      return true;
    }

    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      this.permissionGranted = permission === "granted";
      return this.permissionGranted;
    }

    return false;
  }

  /**
   * 添加任务提醒
   */
  addReminder(todo: Todo): void {
    if (!todo.reminder_time) return;

    const reminderTime = new Date(todo.reminder_time);
    const now = new Date();

    // 如果提醒时间已过，跳过
    if (reminderTime <= now) {
      return;
    }

    // 清除旧的提醒（如果存在）
    this.removeReminder(todo.id);

    // 计算延迟时间（毫秒）
    const delay = reminderTime.getTime() - now.getTime();

    // 设置定时器
    const timerId = window.setTimeout(() => {
      this.showNotification(todo);
      this.timers.delete(todo.id);
    }, delay);

    this.timers.set(todo.id, {
      todoId: todo.id,
      timerId,
      reminderTime,
    });
  }

  /**
   * 移除任务提醒
   */
  removeReminder(todoId: string): void {
    const timer = this.timers.get(todoId);
    if (timer) {
      clearTimeout(timer.timerId);
      this.timers.delete(todoId);
    }
  }

  /**
   * 显示通知
   */
  private showNotification(todo: Todo): void {
    if (!this.permissionGranted) {
      console.warn("通知权限未授予");
      return;
    }

    const title = `任务提醒: ${todo.title}`;
    const body = todo.description || "该任务即将到期";
    const icon = "/favicon.ico"; // 可以替换为应用图标

    const notification = new Notification(title, {
      body,
      icon,
      tag: `todo-${todo.id}`, // 使用 tag 避免重复通知
      requireInteraction: false, // 不需要用户交互
    });

    // 点击通知时聚焦到窗口（如果应用在后台）
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // 5秒后自动关闭通知
    setTimeout(() => {
      notification.close();
    }, 5000);
  }

  /**
   * 批量添加提醒（用于初始化时加载所有任务）
   */
  addReminders(todos: Todo[]): void {
    todos.forEach((todo) => {
      if (todo.reminder_time && todo.status !== "done") {
        this.addReminder(todo);
      }
    });
  }

  /**
   * 清除所有提醒
   */
  clearAll(): void {
    this.timers.forEach((timer) => {
      clearTimeout(timer.timerId);
    });
    this.timers.clear();
  }

  /**
   * 启动定期检查（用于检查即将到来的提醒）
   */
  startPeriodicCheck(userId: string, checkIntervalMs: number = 60000): void {
    if (this.checkInterval) {
      return; // 已经启动
    }

    this.checkInterval = window.setInterval(async () => {
      await this.checkUpcomingReminders(userId);
    }, checkIntervalMs);
  }

  /**
   * 停止定期检查
   */
  stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * 检查即将到来的提醒
   */
  private async checkUpcomingReminders(userId: string): Promise<void> {
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000); // 未来1小时

    const { data: todos, error } = await supabase
      .from("todos")
      .select("*")
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .neq("status", "done")
      .not("reminder_time", "is", null)
      .gte("reminder_time", now.toISOString())
      .lte("reminder_time", nextHour.toISOString());

    if (error) {
      console.error("Failed to check upcoming reminders:", error);
      return;
    }

    // 添加新的提醒
    todos?.forEach((todo) => {
      if (!this.timers.has(todo.id)) {
        this.addReminder(todo as Todo);
      }
    });
  }
}

// 创建全局单例
let reminderManager: TodoReminderManager | null = null;

/**
 * 获取提醒管理器实例
 */
export function getReminderManager(): TodoReminderManager {
  if (!reminderManager) {
    reminderManager = new TodoReminderManager();
  }
  return reminderManager;
}

/**
 * 初始化提醒系统（在应用启动时调用）
 */
export async function initReminderSystem(userId: string): Promise<void> {
  const manager = getReminderManager();
  
  // 请求权限
  await manager.requestPermission();
  
  // 加载所有待办任务的提醒
  const { data: todos, error } = await supabase
    .from("todos")
    .select("*")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .neq("status", "done")
    .not("reminder_time", "is", null)
    .gte("reminder_time", new Date().toISOString());

  if (error) {
    console.error("Failed to load reminders:", error);
    return;
  }

  manager.addReminders((todos || []) as Todo[]);
  
  // 启动定期检查（每分钟检查一次）
  manager.startPeriodicCheck(userId, 60000);
}

/**
 * 清理提醒系统（在应用关闭或用户登出时调用）
 */
export function cleanupReminderSystem(): void {
  const manager = getReminderManager();
  manager.stopPeriodicCheck();
  manager.clearAll();
}











