"use client";

import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, startOfDay, isToday } from "date-fns";
import { zhCN } from "date-fns/locale";
import { type Todo } from "@/lib/todo-storage";
import { getPriorityColor } from "@/lib/todo-utils";
import { cn } from "@/lib/utils";
import TodoDetail from "./TodoDetail";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TodoGanttProps {
  todos: Todo[];
  userId: string;
  onRefresh?: () => void;
}

export default function TodoGantt({
  todos,
  userId,
  onRefresh,
}: TodoGanttProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [hoveredTodo, setHoveredTodo] = useState<string | null>(null);

  // 获取当前周的日期范围
  const weekRange = useMemo(() => {
    const start = startOfWeek(currentWeek, { locale: zhCN });
    const end = endOfWeek(currentWeek, { locale: zhCN });
    return { start, end };
  }, [currentWeek]);

  // 获取周中的所有日期
  const weekDays = useMemo(() => {
    return eachDayOfInterval({
      start: weekRange.start,
      end: weekRange.end,
    });
  }, [weekRange]);

  // 过滤有截止日期的任务
  const todosWithDates = useMemo(() => {
    return todos.filter((todo) => todo.due_date);
  }, [todos]);

  // 计算任务在甘特图中的位置和宽度
  const getTaskPosition = (todo: Todo) => {
    if (!todo.due_date) return null;

    const taskDate = startOfDay(new Date(todo.due_date));
    const weekStart = startOfDay(weekRange.start);
    const weekEnd = startOfDay(weekRange.end);

    // 如果任务不在当前周范围内，不显示
    if (taskDate < weekStart || taskDate > weekEnd) {
      return null;
    }

    // 计算任务在周中的位置（0-6）
    const dayIndex = Math.floor(
      (taskDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 计算任务在当天的位置（基于时间，0-100%）
    const taskDateTime = new Date(todo.due_date);
    const hours = taskDateTime.getHours();
    const minutes = taskDateTime.getMinutes();
    const dayProgress = (hours * 60 + minutes) / (24 * 60);

    return {
      dayIndex,
      dayProgress,
      left: `${(dayIndex * 100 + dayProgress * 100) / 7}%`,
      width: "14%", // 默认宽度为一天的宽度
    };
  };

  // 导航到上一周
  const goToPreviousWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1));
  };

  // 导航到下一周
  const goToNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1));
  };

  // 跳转到本周
  const goToThisWeek = () => {
    setCurrentWeek(new Date());
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/50 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToThisWeek}>
            本周
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="ml-4 text-lg font-semibold">
            {format(weekRange.start, "M月d日", { locale: zhCN })} -{" "}
            {format(weekRange.end, "M月d日", { locale: zhCN })}
          </div>
        </div>
      </div>

      {/* 甘特图内容 */}
      <div className="flex-1 overflow-auto p-4">
        <div className="min-w-max">
          {/* 表头：日期 */}
          <div className="sticky top-0 bg-background z-10 border-b border-border mb-2">
            <div className="flex">
              <div className="w-48 shrink-0 p-2 font-semibold text-sm">任务</div>
              <div className="flex-1 flex">
                {weekDays.map((day) => {
                  const isTodayDate = isToday(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "flex-1 min-w-[120px] p-2 text-center border-l border-border",
                        isTodayDate && "bg-blue-50 dark:bg-blue-950/30"
                      )}
                    >
                      <div
                        className={cn(
                          "text-sm font-medium",
                          isTodayDate && "text-blue-600 dark:text-blue-400"
                        )}
                      >
                        {format(day, "EEE", { locale: zhCN })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(day, "M/d")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 任务行 */}
          <div className="space-y-1">
            {todosWithDates.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p className="text-sm">没有带日期的任务</p>
                <p className="text-xs mt-1">为任务设置截止日期后，它们会显示在甘特图中</p>
              </div>
            ) : (
              todosWithDates.map((todo, index) => {
                const position = getTaskPosition(todo);
                const priorityColor = getPriorityColor(todo.priority);
                const isDone = todo.status === "done";

                if (!position) return null;

                return (
                  <div
                    key={todo.id}
                    className="flex items-center h-12 border-b border-border hover:bg-accent/50 transition-colors"
                    onMouseEnter={() => setHoveredTodo(todo.id)}
                    onMouseLeave={() => setHoveredTodo(null)}
                  >
                    {/* 任务名称列 */}
                    <div className="w-48 shrink-0 p-2 flex items-center gap-2">
                      {todo.priority > 0 && (
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: priorityColor }}
                        />
                      )}
                      <span
                        className={cn(
                          "text-sm truncate flex-1",
                          isDone && "line-through text-muted-foreground"
                        )}
                      >
                        {todo.title}
                      </span>
                    </div>

                    {/* 甘特图条 */}
                    <div className="flex-1 relative h-full flex items-center">
                      <div className="absolute inset-0 flex">
                        {weekDays.map((day) => (
                          <div
                            key={day.toISOString()}
                            className="flex-1 border-l border-border"
                          />
                        ))}
                      </div>
                      <div
                        className={cn(
                          "absolute h-6 rounded px-2 flex items-center text-xs font-medium cursor-pointer transition-all",
                          hoveredTodo === todo.id && "shadow-lg z-20",
                          isDone && "opacity-60"
                        )}
                        style={{
                          left: position.left,
                          width: position.width,
                          backgroundColor: priorityColor || "#6B7280",
                          color: "white",
                        }}
                        onClick={() => setSelectedTodo(todo)}
                      >
                        <span className="truncate">{todo.title}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 任务详情弹窗 */}
      {selectedTodo && (
        <TodoDetail
          todo={selectedTodo}
          userId={userId}
          onClose={() => setSelectedTodo(null)}
          onUpdate={() => {
            onRefresh?.();
            setSelectedTodo(null);
          }}
          onDelete={() => {
            onRefresh?.();
            setSelectedTodo(null);
          }}
        />
      )}
    </div>
  );
}






