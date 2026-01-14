"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Loader2, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Todo, updateTodo, reorderTodos, completeTodo, uncompleteTodo } from "@/lib/todo-storage";
import { formatDueDate, getPriorityColor } from "@/lib/todo-utils";
import { cn } from "@/lib/utils";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isSameDay,
  addMonths,
  subMonths,
  startOfDay,
  addDays,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { arrayMove } from "@dnd-kit/sortable";
import TodoItem from "./TodoItem";
import QuickAddTodo from "./QuickAddTodo";
import TodoContextMenu from "./TodoContextMenu";
import TodoDetail from "./TodoDetail";

// 可拖拽的任务项
function DraggableTodoItem({
  todo,
  onTaskClick,
  onToggleComplete,
  onContextMenu,
  isCompleting,
  isWeekView,
  isDayView,
}: {
  todo: Todo;
  onTaskClick?: (todo: Todo) => void;
  onToggleComplete?: (todo: Todo) => void;
  onContextMenu?: (e: React.MouseEvent, todo: Todo) => void;
  isCompleting?: boolean;
  isWeekView?: boolean;
  isDayView?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id: todo.id,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: todo.id,
  });

  // 合并两个 ref
  const setNodeRef = (node: HTMLElement | null) => {
    setDraggableRef(node);
    setDroppableRef(node);
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete?.(todo);
  };

  if (isDayView) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={cn(
          "rounded-lg border border-border bg-card/60 p-3 cursor-move hover:bg-accent/60 transition-colors group",
          isOver && "ring-2 ring-primary bg-primary/10"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onTaskClick?.(todo);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onTaskClick?.(todo);
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          onContextMenu?.(e, todo);
        }}
      >
        <div className="flex items-center gap-2">
          {/* 快速完成按钮 */}
          <button
            onClick={handleToggleComplete}
            disabled={isCompleting}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            title={todo.status === "done" ? "取消完成" : "完成"}
          >
            {isCompleting ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : todo.status === "done" ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <Circle className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
            )}
          </button>
          <span
            className={cn(
              "text-sm font-medium flex-1",
              todo.status === "done" && "line-through opacity-60"
            )}
          >
            {todo.title}
          </span>
          {todo.priority > 0 && (
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: getPriorityColor(todo.priority) }}
            />
          )}
        </div>
        {todo.due_date && (
          <div className="text-xs text-muted-foreground mt-1">
            {format(new Date(todo.due_date), "HH:mm")}
          </div>
        )}
      </div>
    );
  }

  if (isWeekView) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={cn(
          "text-xs p-1.5 rounded border cursor-move hover:bg-accent transition-colors group",
          todo.status === "done" && "opacity-60",
          isOver && "ring-2 ring-primary bg-primary/10"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onTaskClick?.(todo);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onTaskClick?.(todo);
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          onContextMenu?.(e, todo);
        }}
      >
        <div className="flex items-center gap-1 mb-1">
          {/* 快速完成按钮 */}
          <button
            onClick={handleToggleComplete}
            disabled={isCompleting}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            title={todo.status === "done" ? "取消完成" : "完成"}
          >
            {isCompleting ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : todo.status === "done" ? (
              <CheckCircle2 className="w-3 h-3 text-green-500" />
            ) : (
              <Circle className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors" />
            )}
          </button>
          {todo.priority > 0 && (
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                backgroundColor: getPriorityColor(todo.priority),
              }}
            />
          )}
          <span
            className={cn(
              "font-medium truncate",
              todo.status === "done" && "line-through"
            )}
          >
            {todo.title}
          </span>
        </div>
        {todo.due_date && (
          <div className="text-[10px] text-muted-foreground">
            {format(new Date(todo.due_date), "HH:mm")}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "text-xs p-1 rounded truncate cursor-move hover:bg-accent group",
        todo.status === "done" && "line-through opacity-60",
        isOver && "ring-2 ring-primary bg-primary/10"
      )}
      onClick={(e) => {
        e.stopPropagation();
        onTaskClick?.(todo);
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        onContextMenu?.(e, todo);
      }}
    >
      <div className="flex items-center gap-1">
        {/* 快速完成按钮 */}
        <button
          onClick={handleToggleComplete}
          disabled={isCompleting}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          title={todo.status === "done" ? "取消完成" : "完成"}
        >
          {isCompleting ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          ) : todo.status === "done" ? (
            <CheckCircle2 className="w-3 h-3 text-green-500" />
          ) : (
            <Circle className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors" />
          )}
        </button>
        {todo.priority > 0 && (
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              backgroundColor: getPriorityColor(todo.priority),
            }}
          />
        )}
        <span className="truncate">{todo.title}</span>
      </div>
    </div>
  );
}

// 可放置的日期单元格
function DateCell({
  date,
  dateKey,
  todos,
  isCurrentMonth,
  isTodayDate,
  isSelected,
  onDateClick,
  onTaskClick,
  onToggleComplete,
  onContextMenu,
  isCompleting,
  isWeekView,
  isDayView,
  weekDay,
}: {
  date: Date;
  dateKey: string;
  todos: Todo[];
  isCurrentMonth: boolean;
  isTodayDate: boolean;
  isSelected: boolean;
  onDateClick: () => void;
  onTaskClick?: (todo: Todo) => void;
  onToggleComplete?: (todo: Todo) => void;
  onContextMenu?: (e: React.MouseEvent, todo: Todo) => void;
  isCompleting?: (id: string) => boolean;
  isWeekView?: boolean;
  isDayView?: boolean;
  weekDay?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `date-${dateKey}`,
  });

  if (isDayView) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "border border-border rounded-lg p-6 transition-colors",
          isTodayDate && "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700",
          isOver && "ring-2 ring-primary bg-primary/10"
        )}
        onClick={onDateClick}
      >
        <div className="mb-4">
          <div className="text-2xl font-bold mb-1">
            {format(date, "yyyy年M月d日")}
          </div>
          <div className="text-sm text-muted-foreground">
            {format(date, "EEEE", { locale: zhCN })}
          </div>
        </div>

        <div className="space-y-2">
          {todos.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">这一天没有任务</p>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDateClick();
                }}
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                添加任务
              </Button>
            </div>
          ) : (
            todos.map((todo) => (
              <DraggableTodoItem
                key={todo.id}
                todo={todo}
                onTaskClick={onTaskClick}
                onToggleComplete={onToggleComplete}
                onContextMenu={onContextMenu}
                isCompleting={isCompleting?.(todo.id)}
                isDayView={true}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  if (isWeekView) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "border border-border rounded-lg p-2 transition-colors",
          isTodayDate && "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700",
          isSelected && "ring-2 ring-blue-500",
          isOver && "ring-2 ring-primary bg-primary/10"
        )}
        onClick={onDateClick}
      >
        <div className="text-center mb-2">
          <div className="text-xs text-muted-foreground mb-1">{weekDay}</div>
          <div
            className={cn(
              "text-lg font-semibold",
              isTodayDate && "text-blue-600 dark:text-blue-400"
            )}
          >
            {format(date, "d")}
          </div>
          <div className="text-xs text-muted-foreground">{format(date, "M月")}</div>
        </div>
        <div className="space-y-1">
          {todos.map((todo) => (
            <DraggableTodoItem
              key={todo.id}
              todo={todo}
                onTaskClick={onTaskClick}
                onToggleComplete={onToggleComplete}
                onContextMenu={onContextMenu}
                isCompleting={isCompleting?.(todo.id)}
                isWeekView={true}
              />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[60px] sm:min-h-[100px] border border-border rounded-lg p-1 sm:p-2 transition-colors",
        !isCurrentMonth && "opacity-40",
        isTodayDate && "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700",
        isSelected && "ring-2 ring-blue-500",
        isOver && "ring-2 ring-primary bg-primary/10",
        "hover:bg-accent/50 cursor-pointer"
      )}
      onClick={onDateClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "text-sm font-medium",
            isTodayDate && "text-blue-600 dark:text-blue-400",
            !isCurrentMonth && "text-muted-foreground"
          )}
        >
          {format(date, "d")}
        </span>
        {todos.length > 0 && (
          <span className="text-xs text-muted-foreground bg-accent px-1.5 py-0.5 rounded-full">
            {todos.length}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {todos.slice(0, 3).map((todo) => (
          <DraggableTodoItem
            key={todo.id}
            todo={todo}
            onTaskClick={onTaskClick}
            onToggleComplete={onToggleComplete}
            onContextMenu={onContextMenu}
            isCompleting={isCompleting?.(todo.id)}
          />
        ))}
        {todos.length > 3 && (
          <div className="text-xs text-muted-foreground px-1">
            +{todos.length - 3} 更多
          </div>
        )}
      </div>
    </div>
  );
}

type CalendarView = "month" | "week" | "day";

interface TodoCalendarProps {
  todos: Todo[];
  userId: string;
  onRefresh?: () => void;
  onTaskClick?: (todo: Todo) => void;
}

export default function TodoCalendar({
  todos,
  userId,
  onRefresh,
  onTaskClick,
}: TodoCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddTodo, setShowAddTodo] = useState(false);
  const [activeTodo, setActiveTodo] = useState<Todo | null>(null);
  const [localTodos, setLocalTodos] = useState<Todo[]>(todos);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    todo: Todo;
    position: { x: number; y: number };
  } | null>(null);

  // 同步外部 todos 到本地状态
  useEffect(() => {
    setLocalTodos(todos);
  }, [todos]);

  // 处理快速完成/取消完成
  const handleToggleComplete = async (todo: Todo) => {
    setCompletingIds((prev) => new Set(prev).add(todo.id));
    
    try {
      if (todo.status === "done") {
        await uncompleteTodo(todo.id);
      } else {
        await completeTodo(todo.id);
      }
      // 更新本地状态
      setLocalTodos((prev) =>
        prev.map((t) =>
          t.id === todo.id
            ? {
                ...t,
                status: t.status === "done" ? "todo" : "done",
                completed_at: t.status === "done" ? null : new Date().toISOString(),
              }
            : t
        )
      );
      onRefresh?.();
    } catch (error) {
      console.error("Failed to toggle todo:", error);
    } finally {
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(todo.id);
        return next;
      });
    }
  };

  // 拖拽传感器
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const todoId = event.active.id as string;
    const todo = todos.find((t) => t.id === todoId);
    setActiveTodo(todo || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTodo(null);

    if (!over) return;

    const todoId = active.id as string;
    const targetId = over.id as string;

    // 如果拖拽到另一个任务（同一日期内排序）
    if (targetId !== todoId && !targetId.startsWith("date-")) {
      const sourceTodo = localTodos.find((t) => t.id === todoId);
      const targetTodo = localTodos.find((t) => t.id === targetId);

      if (sourceTodo && targetTodo) {
        // 检查是否在同一日期
        const sourceDate = sourceTodo.due_date
          ? format(new Date(sourceTodo.due_date), "yyyy-MM-dd")
          : null;
        const targetDate = targetTodo.due_date
          ? format(new Date(targetTodo.due_date), "yyyy-MM-dd")
          : null;

        if (sourceDate === targetDate && sourceDate) {
          // 同一日期内排序
          const dateTodos = localTodos.filter(
            (t) =>
              t.due_date &&
              format(new Date(t.due_date), "yyyy-MM-dd") === sourceDate
          );
          const sourceIndex = dateTodos.findIndex((t) => t.id === todoId);
          const targetIndex = dateTodos.findIndex((t) => t.id === targetId);

          if (sourceIndex !== -1 && targetIndex !== -1) {
            const newDateTodos = arrayMove(dateTodos, sourceIndex, targetIndex);
            const otherTodos = localTodos.filter(
              (t) =>
                !t.due_date ||
                format(new Date(t.due_date), "yyyy-MM-dd") !== sourceDate
            );
            const newTodos = [...otherTodos, ...newDateTodos];
            setLocalTodos(newTodos);

            // 更新数据库
            try {
              await reorderTodos(newDateTodos.map((t) => t.id));
              // 不调用 onRefresh，避免页面刷新
            } catch (error) {
              console.error("Failed to reorder todos:", error);
              setLocalTodos(todos); // 回滚
            }
            return;
          }
        }
      }
    }

    // 如果拖拽到日期单元格（改变截止日期）
    if (targetId.startsWith("date-")) {
      const dateStr = targetId.replace("date-", "");
      const targetDate = new Date(dateStr);
      const sourceTodo = localTodos.find((t) => t.id === todoId);

      if (sourceTodo) {
        const oldDate = sourceTodo.due_date
          ? format(new Date(sourceTodo.due_date), "yyyy-MM-dd")
          : null;
        const newDate = format(targetDate, "yyyy-MM-dd");

        // 如果日期没有改变，不执行更新
        if (oldDate === newDate) {
          return;
        }

        // 乐观更新本地状态
        const updatedTodo = {
          ...sourceTodo,
          due_date: targetDate.toISOString(),
        };
        setLocalTodos((prev) =>
          prev.map((t) => (t.id === todoId ? updatedTodo : t))
        );

        try {
          await updateTodo(todoId, {
            due_date: format(targetDate, "yyyy-MM-dd"),
          });
          // 不调用 onRefresh，避免页面刷新
        } catch (error) {
          console.error("Failed to update todo due date:", error);
          setLocalTodos(todos); // 回滚
        }
      }
    }
  };

  // 获取当前视图的日期范围
  const dateRange = useMemo(() => {
    switch (view) {
      case "month":
        return {
          start: startOfWeek(startOfMonth(currentDate), { locale: zhCN }),
          end: endOfWeek(endOfMonth(currentDate), { locale: zhCN }),
        };
      case "week":
        return {
          start: startOfWeek(currentDate, { locale: zhCN }),
          end: endOfWeek(currentDate, { locale: zhCN }),
        };
      case "day":
        return {
          start: startOfDay(currentDate),
          end: startOfDay(addDays(currentDate, 1)),
        };
      default:
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate),
        };
    }
  }, [currentDate, view]);

  // 获取日历中的所有日期
  const calendarDays = useMemo(() => {
    return eachDayOfInterval({
      start: dateRange.start,
      end: dateRange.end,
    });
  }, [dateRange]);

  // 按日期分组任务（使用本地状态）
  const todosByDate = useMemo(() => {
    const map = new Map<string, Todo[]>();
    localTodos.forEach((todo) => {
      if (todo.due_date) {
        const dateKey = format(new Date(todo.due_date), "yyyy-MM-dd");
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(todo);
      } else {
        // 无日期的任务显示在"无日期"组
        const key = "no-date";
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(todo);
      }
    });
    return map;
  }, [localTodos]);

  // 获取某一天的任务
  const getTodosForDate = (date: Date): Todo[] => {
    const dateKey = format(date, "yyyy-MM-dd");
    return todosByDate.get(dateKey) || [];
  };

  // 导航到上一个月/周/日
  const goToPrevious = () => {
    switch (view) {
      case "month":
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case "week":
        setCurrentDate(addDays(currentDate, -7));
        break;
      case "day":
        setCurrentDate(addDays(currentDate, -1));
        break;
    }
  };

  // 导航到下一个月/周/日
  const goToNext = () => {
    switch (view) {
      case "month":
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case "week":
        setCurrentDate(addDays(currentDate, 7));
        break;
      case "day":
        setCurrentDate(addDays(currentDate, 1));
        break;
    }
  };

  // 跳转到今天
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // 处理日期点击
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowAddTodo(true);
  };

  // 处理任务点击（双击编辑）
  const handleTaskClick = (todo: Todo) => {
    setSelectedTodo(todo);
  };

  // 处理任务更新
  const handleTaskUpdate = () => {
    setSelectedTodo(null);
    onRefresh?.();
  };

  // 处理任务删除
  const handleTaskDelete = () => {
    setSelectedTodo(null);
    onRefresh?.();
  };

  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent, todo: Todo) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      todo,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  // 处理上下文菜单更新
  const handleContextMenuUpdate = () => {
    setContextMenu(null);
    onRefresh?.();
  };

  // 渲染月视图
  const renderMonthView = () => {
    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

    return (
      <div className="flex-1 overflow-y-auto p-2 sm:p-4">
        <div className="max-w-6xl mx-auto">
          {/* 星期标题 */}
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-2">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-semibold text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* 日期网格 */}
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {calendarDays.map((day, index) => {
                const dayTodos = getTodosForDate(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isTodayDate = isToday(day);
                const isSelected = !!selectedDate && isSameDay(day, selectedDate);
                const dateKey = format(day, "yyyy-MM-dd");

                return (
                  <DateCell
                    key={day.toISOString()}
                    date={day}
                    dateKey={dateKey}
                    todos={dayTodos}
                    isCurrentMonth={isCurrentMonth}
                    isTodayDate={isTodayDate}
                    isSelected={isSelected}
                    onDateClick={() => handleDateClick(day)}
                    onTaskClick={handleTaskClick}
                    onToggleComplete={handleToggleComplete}
                    onContextMenu={handleContextMenu}
                    isCompleting={(id) => completingIds.has(id)}
                  />
                );
              })}
            </div>
            <DragOverlay>
              {activeTodo ? (
                <div className="bg-card border border-border rounded p-1 shadow-lg opacity-90 text-xs">
                  <div className="flex items-center gap-1">
                    {activeTodo.priority > 0 && (
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: getPriorityColor(activeTodo.priority),
                        }}
                      />
                    )}
                    <span>{activeTodo.title}</span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    );
  };

  // 渲染周视图
  const renderWeekView = () => {
    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

    return (
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-y-auto p-2 sm:p-4">
          <div className="max-w-6xl mx-auto">
            {/* 星期标题 */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
              {calendarDays.slice(0, 7).map((day, index) => {
                const dayTodos = getTodosForDate(day);
                const isTodayDate = isToday(day);
                const isSelected = !!selectedDate && isSameDay(day, selectedDate);
                const dateKey = format(day, "yyyy-MM-dd");

                return (
                  <DateCell
                    key={day.toISOString()}
                    date={day}
                    dateKey={dateKey}
                    todos={dayTodos}
                    isCurrentMonth={true}
                    isTodayDate={isTodayDate}
                    isSelected={isSelected}
                    onDateClick={() => handleDateClick(day)}
                    onTaskClick={handleTaskClick}
                    onToggleComplete={handleToggleComplete}
                    onContextMenu={handleContextMenu}
                    isCompleting={(id) => completingIds.has(id)}
                    isWeekView={true}
                    weekDay={weekDays[index]}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <DragOverlay>
          {activeTodo ? (
            <div className="bg-card border border-border rounded p-1 shadow-lg opacity-90 text-xs">
              <div className="flex items-center gap-1">
                {activeTodo.priority > 0 && (
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: getPriorityColor(activeTodo.priority),
                    }}
                  />
                )}
                <span>{activeTodo.title}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  };

  // 渲染日视图
  const renderDayView = () => {
    const day = calendarDays[0];
    const dayTodos = getTodosForDate(day);
    const isTodayDate = isToday(day);
    const dateKey = format(day, "yyyy-MM-dd");

    return (
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-y-auto p-2 sm:p-4">
          <div className="max-w-4xl mx-auto">
            <DateCell
              date={day}
              dateKey={dateKey}
              todos={dayTodos}
              isCurrentMonth={true}
              isTodayDate={isTodayDate}
              isSelected={false}
              onDateClick={() => handleDateClick(day)}
              onTaskClick={handleTaskClick}
              onToggleComplete={handleToggleComplete}
              isCompleting={(id) => completingIds.has(id)}
              isDayView={true}
            />
          </div>
        </div>
        <DragOverlay>
          {activeTodo ? (
            <div className="bg-card border border-border rounded p-1 shadow-lg opacity-90 text-xs">
              <div className="flex items-center gap-1">
                {activeTodo.priority > 0 && (
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: getPriorityColor(activeTodo.priority),
                    }}
                  />
                )}
                <span>{activeTodo.title}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b border-border bg-background/50 flex-wrap gap-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="outline" size="sm" onClick={goToPrevious} className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} className="h-8 px-2 sm:px-3 text-xs sm:text-sm">
            今天
          </Button>
          <Button variant="outline" size="sm" onClick={goToNext} className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="ml-2 sm:ml-4 text-sm sm:text-lg font-semibold truncate">
            {view === "month" && format(currentDate, "yyyy年M月", { locale: zhCN })}
            {view === "week" && `${format(dateRange.start, "M月d日")} - ${format(dateRange.end, "M月d日")}`}
            {view === "day" && format(currentDate, "yyyy年M月d日", { locale: zhCN })}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={view === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("month")}
            className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
          >
            月
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("week")}
            className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
          >
            周
          </Button>
          <Button
            variant={view === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("day")}
            className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
          >
            日
          </Button>
        </div>
      </div>

      {/* 日历内容 */}
      {view === "month" && renderMonthView()}
      {view === "week" && renderWeekView()}
      {view === "day" && renderDayView()}

      {/* 快速添加任务（选中日期时显示） */}
      {showAddTodo && selectedDate && (
        <div className="border-t border-border bg-background/80 backdrop-blur">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                为 {format(selectedDate, "yyyy年M月d日", { locale: zhCN })} 添加任务
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowAddTodo(false);
                  setSelectedDate(null);
                }}
              >
                ×
              </Button>
            </div>
            <QuickAddTodo
              userId={userId}
              listId={null}
              onTaskCreated={() => {
                onRefresh?.();
                setShowAddTodo(false);
                setSelectedDate(null);
              }}
            />
          </div>
        </div>
      )}

      {/* 任务详情弹窗 */}
      {selectedTodo && (
        <TodoDetail
          todo={selectedTodo}
          userId={userId}
          onClose={() => setSelectedTodo(null)}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
        />
      )}

      {/* 上下文菜单 */}
      {contextMenu && (
        <TodoContextMenu
          todo={contextMenu.todo}
          userId={userId}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onUpdate={handleContextMenuUpdate}
          onDelete={handleContextMenuUpdate}
        />
      )}
    </div>
  );
}

