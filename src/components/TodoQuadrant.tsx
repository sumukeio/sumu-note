"use client";

import { useState, useMemo, useEffect } from "react";
import { type Todo, updateTodo } from "@/lib/todo-storage";
import { getPriorityColor } from "@/lib/todo-utils";
import { cn } from "@/lib/utils";
import TodoDetail from "./TodoDetail";
import { isBefore, isAfter, startOfDay, endOfDay, addDays, format } from "date-fns";
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

interface TodoQuadrantProps {
  todos: Todo[];
  userId: string;
  onRefresh?: () => void;
}

type Quadrant = "urgent-important" | "not-urgent-important" | "urgent-not-important" | "not-urgent-not-important";

interface QuadrantConfig {
  id: Quadrant;
  title: string;
  description: string;
  bgColor: string;
  borderColor: string;
}

const quadrants: QuadrantConfig[] = [
  {
    id: "urgent-important",
    title: "重要且紧急",
    description: "立即处理",
    bgColor: "bg-red-50 dark:bg-red-950/20",
    borderColor: "border-red-300 dark:border-red-700",
  },
  {
    id: "not-urgent-important",
    title: "重要不紧急",
    description: "计划处理",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    borderColor: "border-blue-300 dark:border-blue-700",
  },
  {
    id: "urgent-not-important",
    title: "不重要但紧急",
    description: "快速处理",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
    borderColor: "border-yellow-300 dark:border-yellow-700",
  },
  {
    id: "not-urgent-not-important",
    title: "不重要不紧急",
    description: "稍后处理",
    bgColor: "bg-gray-50 dark:bg-gray-950/20",
    borderColor: "border-gray-300 dark:border-gray-700",
  },
];

export default function TodoQuadrant({
  todos,
  userId,
  onRefresh,
}: TodoQuadrantProps) {
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [activeTodo, setActiveTodo] = useState<Todo | null>(null);
  const [manualAssignments, setManualAssignments] = useState<
    Map<string, Quadrant>
  >(new Map());
  const [localTodos, setLocalTodos] = useState<Todo[]>(todos);

  // 同步外部 todos 到本地状态，但保留手动分配
  useEffect(() => {
    // 合并外部更新和本地手动分配
    const updatedTodos = todos.map((todo) => {
      // 如果任务有手动分配，确保它显示在正确的象限
      const manualQuadrant = manualAssignments.get(todo.id);
      if (manualQuadrant) {
        // 根据手动分配的象限，确保任务的优先级和截止日期匹配
        let expectedPriority = todo.priority;
        let expectedDueDate = todo.due_date;

        switch (manualQuadrant) {
          case "urgent-important":
            expectedPriority = 3;
            break;
          case "not-urgent-important":
            expectedPriority = 2;
            break;
          case "urgent-not-important":
            expectedPriority = 1;
            break;
          case "not-urgent-not-important":
            expectedPriority = 0;
            break;
        }

        // 如果任务的属性不匹配手动分配的象限，更新任务
        if (todo.priority !== expectedPriority) {
          return { ...todo, priority: expectedPriority as 0 | 1 | 2 | 3 };
        }
      }
      return todo;
    });
    setLocalTodos(updatedTodos);
  }, [todos, manualAssignments]);

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
    const todo = localTodos.find((t) => t.id === todoId);
    setActiveTodo(todo || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTodo(null);

    if (!over) return;

    const todoId = active.id as string;
    let targetQuadrant: Quadrant | undefined;

    // 检查 over.id 是否是象限ID
    const quadrantId = over.id as string;
    const foundQuadrant = quadrants.find((q) => q.id === quadrantId);
    
    if (foundQuadrant) {
      // 直接拖到象限上
      targetQuadrant = foundQuadrant.id;
    } else {
      // 可能是拖到象限内的任务上，需要找到该任务所在的象限
      const targetTodo = localTodos.find((t) => t.id === quadrantId);
      if (targetTodo) {
        // 根据任务属性找到它所在的象限
        const urgent = isUrgent(targetTodo);
        const important = isImportant(targetTodo);
        
        if (urgent && important) {
          targetQuadrant = "urgent-important";
        } else if (!urgent && important) {
          targetQuadrant = "not-urgent-important";
        } else if (urgent && !important) {
          targetQuadrant = "urgent-not-important";
        } else {
          targetQuadrant = "not-urgent-not-important";
        }
      }
    }

    // 验证目标象限是否有效
    if (!targetQuadrant || !quadrants.find((q) => q.id === targetQuadrant)) {
      return;
    }

    // 找到任务
    const todo = localTodos.find((t) => t.id === todoId);
    if (!todo) return;

    // 先保存手动分配（立即更新本地状态）
    setManualAssignments((prev) => {
      const next = new Map(prev);
      next.set(todoId, targetQuadrant!);
      return next;
    });

    // 计算更新
    let updates: { priority?: number; due_date?: string } = {};
    let newPriority: 0 | 1 | 2 | 3 = todo.priority;
    let newDueDate: string | null = todo.due_date;

    switch (targetQuadrant) {
      case "urgent-important":
        // 重要且紧急：高优先级 + 3天内截止
        newPriority = 3;
        newDueDate = format(addDays(new Date(), 2), "yyyy-MM-dd");
        updates = {
          priority: 3,
          due_date: newDueDate,
        };
        break;
      case "not-urgent-important":
        // 重要不紧急：中高优先级 + 未来日期
        newPriority = 2;
        newDueDate = todo.due_date || format(addDays(new Date(), 7), "yyyy-MM-dd");
        updates = {
          priority: 2,
          due_date: newDueDate,
        };
        break;
      case "urgent-not-important":
        // 不重要但紧急：低优先级 + 3天内截止
        newPriority = 1;
        newDueDate = format(addDays(new Date(), 2), "yyyy-MM-dd");
        updates = {
          priority: 1,
          due_date: newDueDate,
        };
        break;
      case "not-urgent-not-important":
        // 不重要不紧急：无优先级 + 未来日期
        newPriority = 0;
        newDueDate = todo.due_date || format(addDays(new Date(), 14), "yyyy-MM-dd");
        updates = {
          priority: 0,
          due_date: newDueDate,
        };
        break;
    }

    // 乐观更新本地状态（立即更新UI，不刷新页面）
    setLocalTodos((prev) =>
      prev.map((t) =>
        t.id === todoId
          ? {
              ...t,
              priority: newPriority,
              due_date: newDueDate,
            }
          : t
      )
    );

    // 后台更新数据库（不调用 onRefresh，避免页面刷新）
    try {
      await updateTodo(todoId, updates);
      // 不调用 onRefresh，保持流畅的用户体验
    } catch (error) {
      console.error("Failed to update todo quadrant:", error);
      // 回滚本地状态
      setLocalTodos(todos);
      setManualAssignments((prev) => {
        const next = new Map(prev);
        next.delete(todoId);
        return next;
      });
    }
  };

  // 判断任务是否紧急（基于截止日期）
  const isUrgent = (todo: Todo): boolean => {
    if (!todo.due_date) return false;
    const dueDate = new Date(todo.due_date);
    const today = startOfDay(new Date());
    const threeDaysLater = endOfDay(new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000));
    // 紧急：截止日期在 [今天, 未来3天内]
    return !isBefore(dueDate, today) && !isAfter(dueDate, threeDaysLater);
  };

  // 判断任务是否重要（基于优先级）
  const isImportant = (todo: Todo): boolean => {
    return todo.priority >= 2; // 中优先级或高优先级
  };

  // 将任务分类到四个象限（考虑手动分配）
  const todosByQuadrant = useMemo(() => {
    const map = new Map<Quadrant, Todo[]>();
    quadrants.forEach((q) => map.set(q.id, []));

    localTodos.forEach((todo) => {
      if (todo.status === "done") return; // 已完成的任务不显示

      // 检查是否有手动分配
      const manualQuadrant = manualAssignments.get(todo.id);
      if (manualQuadrant) {
        map.get(manualQuadrant)!.push(todo);
        return;
      }

      // 自动分类
      const urgent = isUrgent(todo);
      const important = isImportant(todo);

      let quadrant: Quadrant;
      if (urgent && important) {
        quadrant = "urgent-important";
      } else if (!urgent && important) {
        quadrant = "not-urgent-important";
      } else if (urgent && !important) {
        quadrant = "urgent-not-important";
      } else {
        quadrant = "not-urgent-not-important";
      }

      map.get(quadrant)!.push(todo);
    });

    return map;
  }, [localTodos, manualAssignments]);

  const handleTodoClick = (todo: Todo) => {
    setSelectedTodo(todo);
  };

  if (localTodos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">还没有任务</p>
          <p className="text-xs mt-1">在下方输入框添加你的第一个任务吧</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-6xl mx-auto">
          {/* 四象限网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full min-h-[400px] md:min-h-[600px]">
            {quadrants.map((quadrant) => {
              const quadrantTodos = todosByQuadrant.get(quadrant.id) || [];

              return (
                <QuadrantCell
                  key={quadrant.id}
                  quadrant={quadrant}
                  todos={quadrantTodos}
                  onTodoClick={handleTodoClick}
                />
              );
            })}
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

        <DragOverlay>
          {activeTodo ? (
            <div className="bg-background border border-border rounded-lg p-2 shadow-lg opacity-90">
              <div className="flex items-center gap-1.5">
                {activeTodo.priority > 0 && (
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: getPriorityColor(activeTodo.priority),
                    }}
                  />
                )}
                <span className="text-sm font-medium">{activeTodo.title}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

// 可拖拽的任务卡片
function DraggableTodoCard({
  todo,
  onTodoClick,
}: {
  todo: Todo;
  onTodoClick: (todo: Todo) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: todo.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-background/80 border border-border rounded-lg p-2 cursor-move hover:bg-accent/50 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        onTodoClick(todo);
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm font-medium truncate">{todo.title}</span>
            {todo.priority > 0 && (
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: getPriorityColor(todo.priority),
                }}
              />
            )}
          </div>
          {todo.due_date && (
            <div className="text-xs text-muted-foreground">
              截止: {new Date(todo.due_date).toLocaleDateString("zh-CN")}
            </div>
          )}
          {todo.tags.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {todo.tags.slice(0, 2).map((tag) => (
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
}

// 可放置的象限单元格
function QuadrantCell({
  quadrant,
  todos,
  onTodoClick,
}: {
  quadrant: QuadrantConfig;
  todos: Todo[];
  onTodoClick: (todo: Todo) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: quadrant.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border-2 p-4 flex flex-col",
        quadrant.bgColor,
        quadrant.borderColor,
        isOver && "ring-2 ring-primary"
      )}
    >
                {/* 象限标题 */}
                <div className="mb-3">
                  <h3 className="text-sm font-bold mb-1">{quadrant.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {quadrant.description}
                  </p>
                  <span className="text-xs text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full mt-1 inline-block">
                    {todos.length} 个任务
                  </span>
                </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {todos.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-xs">
            暂无任务
          </div>
        ) : (
          todos.map((todo) => (
            <DraggableTodoCard key={todo.id} todo={todo} onTodoClick={onTodoClick} />
          ))
        )}
      </div>
    </div>
  );
}

