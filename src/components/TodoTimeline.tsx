"use client";

import { useState, useMemo } from "react";
import { format, startOfDay, endOfDay, eachDayOfInterval, isToday, isSameDay, addDays, subDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import { type Todo } from "@/lib/todo-storage";
import { formatDueDate, getPriorityColor } from "@/lib/todo-utils";
import { cn } from "@/lib/utils";
import TodoDetail from "./TodoDetail";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TodoTimelineProps {
  todos: Todo[];
  userId: string;
  onRefresh?: () => void;
}

type TimelineView = "day" | "week" | "month";

export default function TodoTimeline({
  todos,
  userId,
  onRefresh,
}: TodoTimelineProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<TimelineView>("week");
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);

  // 获取时间线日期范围
  const dateRange = useMemo(() => {
    const start = startOfDay(currentDate);
    let end: Date;

    switch (view) {
      case "day":
        end = endOfDay(currentDate);
        break;
      case "week":
        end = endOfDay(addDays(start, 6));
        break;
      case "month":
        end = endOfDay(addDays(start, 29)); // 显示30天
        break;
      default:
        end = endOfDay(addDays(start, 6));
    }

    return { start, end };
  }, [currentDate, view]);

  // 获取时间线中的所有日期
  const timelineDays = useMemo(() => {
    return eachDayOfInterval({
      start: dateRange.start,
      end: dateRange.end,
    });
  }, [dateRange]);

  // 按日期分组任务
  const todosByDate = useMemo(() => {
    const map = new Map<string, Todo[]>();
    
    todos.forEach((todo) => {
      if (todo.due_date) {
        const dateKey = format(new Date(todo.due_date), "yyyy-MM-dd");
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(todo);
      } else {
        // 无日期的任务显示在第一个日期
        const firstDateKey = format(timelineDays[0], "yyyy-MM-dd");
        if (!map.has(firstDateKey)) {
          map.set(firstDateKey, []);
        }
        map.get(firstDateKey)!.push(todo);
      }
    });

    return map;
  }, [todos, timelineDays]);

  // 获取某一天的任务
  const getTodosForDate = (date: Date): Todo[] => {
    const dateKey = format(date, "yyyy-MM-dd");
    return todosByDate.get(dateKey) || [];
  };

  // 导航到前一天/周/月
  const goToPrevious = () => {
    switch (view) {
      case "day":
        setCurrentDate(subDays(currentDate, 1));
        break;
      case "week":
        setCurrentDate(subDays(currentDate, 7));
        break;
      case "month":
        setCurrentDate(subDays(currentDate, 30));
        break;
    }
  };

  // 导航到下一天/周/月
  const goToNext = () => {
    switch (view) {
      case "day":
        setCurrentDate(addDays(currentDate, 1));
        break;
      case "week":
        setCurrentDate(addDays(currentDate, 7));
        break;
      case "month":
        setCurrentDate(addDays(currentDate, 30));
        break;
    }
  };

  // 跳转到今天
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // 获取时间线标题
  const getTimelineTitle = () => {
    switch (view) {
      case "day":
        return format(currentDate, "yyyy年M月d日 EEEE", { locale: zhCN });
      case "week":
        return `${format(dateRange.start, "M月d日")} - ${format(dateRange.end, "M月d日")}`;
      case "month":
        return format(currentDate, "yyyy年M月");
      default:
        return "";
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/50 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPrevious}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            今天
          </Button>
          <Button variant="outline" size="sm" onClick={goToNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="ml-4 text-lg font-semibold">{getTimelineTitle()}</div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={view === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("day")}
          >
            日
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("week")}
          >
            周
          </Button>
          <Button
            variant={view === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("month")}
          >
            月
          </Button>
        </div>
      </div>

      {/* 时间线内容 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-6xl mx-auto">
          <div className="space-y-4">
            {timelineDays.map((day) => {
              const dayTodos = getTodosForDate(day);
              const isTodayDate = isToday(day);
              const dateKey = format(day, "yyyy-MM-dd");

              return (
                <div
                  key={dateKey}
                  className={cn(
                    "border-l-2 pl-4 pb-4 relative",
                    isTodayDate ? "border-blue-500" : "border-border"
                  )}
                >
                  {/* 时间轴节点 */}
                  <div className="absolute left-[-6px] top-0">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full border-2",
                        isTodayDate
                          ? "bg-blue-500 border-blue-500"
                          : "bg-background border-border"
                      )}
                    />
                  </div>

                  {/* 日期标题 */}
                  <div className="mb-3">
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        isTodayDate && "text-blue-600 dark:text-blue-400"
                      )}
                    >
                      {format(day, "M月d日 EEEE", { locale: zhCN })}
                    </div>
                    {dayTodos.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {dayTodos.length} 个任务
                      </div>
                    )}
                  </div>

                  {/* 任务列表 */}
                  {dayTodos.length > 0 ? (
                    <div className="space-y-2">
                      {dayTodos.map((todo) => {
                        const priorityColor = getPriorityColor(todo.priority);
                        const isDone = todo.status === "done";
                        const dueTime = todo.due_date
                          ? format(new Date(todo.due_date), "HH:mm")
                          : null;

                        return (
                          <div
                            key={todo.id}
                            className={cn(
                              "bg-card border border-border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer",
                              isDone && "opacity-60"
                            )}
                            onClick={() => setSelectedTodo(todo)}
                          >
                            <div className="flex items-start gap-3">
                              {/* 时间 */}
                              {dueTime && (
                                <div className="text-xs font-medium text-muted-foreground shrink-0 w-12">
                                  {dueTime}
                                </div>
                              )}
                              
                              {/* 任务内容 */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3
                                    className={cn(
                                      "text-sm font-medium flex-1",
                                      isDone && "line-through text-muted-foreground"
                                    )}
                                  >
                                    {todo.title}
                                  </h3>
                                  {todo.priority > 0 && (
                                    <div
                                      className="w-2 h-2 rounded-full shrink-0"
                                      style={{ backgroundColor: priorityColor }}
                                    />
                                  )}
                                </div>

                                {todo.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                    {todo.description}
                                  </p>
                                )}

                                {/* 标签 */}
                                {todo.tags.length > 0 && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {todo.tags.map((tag) => (
                                      <span
                                        key={tag}
                                        className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground"
                                      >
                                        #{tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground py-2">
                      这一天没有任务
                    </div>
                  )}
                </div>
              );
            })}
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

