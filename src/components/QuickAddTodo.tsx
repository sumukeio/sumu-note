"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTodo } from "@/lib/todo-storage";
import { parseTaskInput } from "@/lib/todo-utils";
import { getUserSettings } from "@/lib/user-settings";

interface QuickAddTodoProps {
  userId: string;
  listId: string | null;
  onTaskCreated?: () => void;
  onSwitchToToday?: () => void;
}

export default function QuickAddTodo({
  userId,
  listId,
  onTaskCreated,
  onSwitchToToday,
}: QuickAddTodoProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reminderBeforeMinutes, setReminderBeforeMinutes] = useState(15);

  // 加载用户设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getUserSettings(userId);
        setReminderBeforeMinutes(settings.reminder_before_minutes);
      } catch (error) {
        console.error("Failed to load user settings:", error);
      }
    };
    loadSettings();
  }, [userId]);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;

    const trimmedInput = input.trim();
    setInput("");
    setLoading(true);

    try {
      // 解析输入，提取日期/时间/标签/优先级
      const parsed = parseTaskInput(trimmedInput, reminderBeforeMinutes);

      // 创建任务
      await createTodo(userId, {
        title: parsed.title,
        list_id: listId,
        due_date: parsed.due_date || null,
        reminder_time: parsed.reminder_time || null,
        tags: parsed.tags,
        priority: parsed.priority,
      });

      // 如果识别到是今天的任务，自动切换到"今天"清单
      if (parsed.isToday && onSwitchToToday) {
        onSwitchToToday();
      }

      onTaskCreated?.();
    } catch (error) {
      console.error("Failed to create todo:", error);
      // 恢复输入以便重试
      setInput(trimmedInput);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur p-2 sm:p-4">
      <div className="flex items-center gap-2 max-w-4xl mx-auto">
        <div className="relative flex-1">
          <Input
            placeholder="添加任务... (支持智能识别：明天下午3点 #工作 @重要)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="pl-8 sm:pl-10 pr-2 sm:pr-4 text-sm sm:text-base"
          />
          <Plus className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!input.trim() || loading}
          size="sm"
          className="shrink-0"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <span className="hidden sm:inline">添加</span>
          )}
        </Button>
      </div>
    </div>
  );
}

