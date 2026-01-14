"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Todo, type TodoList, getTodoLists } from "@/lib/todo-storage";
import { formatDueDate, getPriorityColor } from "@/lib/todo-utils";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  closestCorners,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type Collision,
  useDroppable,
} from "@dnd-kit/core";
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TodoDetail from "./TodoDetail";

interface TodoKanbanProps {
  todos: Todo[];
  userId: string;
  onRefresh?: () => void;
}

type KanbanColumn = "todo" | "in_progress" | "done" | string;
type SwimlaneType = "none" | "list" | "tag" | "priority";

interface KanbanColumnConfig {
  id: KanbanColumn;
  title: string;
  color?: string;
}

const defaultColumns: KanbanColumnConfig[] = [
  { id: "todo", title: "待办", color: "#6B7280" },
  { id: "in_progress", title: "进行中", color: "#3B82F6" },
  { id: "done", title: "已完成", color: "#10B981" },
];

function KanbanCard({
  todo,
  userId,
  onUpdate,
  cardColor,
}: {
  todo: Todo;
  userId: string;
  onUpdate?: () => void;
  cardColor?: string;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityColor = getPriorityColor(todo.priority);
  const isDone = todo.status === "done";

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          ...style,
          ...(cardColor && {
            borderLeftColor: cardColor,
            borderLeftWidth: "3px",
          }),
        }}
        {...attributes}
        {...listeners}
        className={cn(
          "bg-card border border-border rounded-lg p-3 cursor-move hover:shadow-md transition-shadow",
          isDone && "opacity-60",
          cardColor && "border-l-4"
        )}
        onClick={() => setShowDetail(true)}
      >
        <div className="flex items-start gap-2 mb-2">
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
              className="w-2 h-2 rounded-full shrink-0 mt-1"
              style={{ backgroundColor: priorityColor }}
            />
          )}
        </div>

        {todo.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {todo.description}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {todo.due_date && (
            <span className="text-xs text-muted-foreground">
              {formatDueDate(todo.due_date)}
            </span>
          )}
          {todo.tags.length > 0 && (
            <div className="flex items-center gap-1">
              {todo.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground"
                >
                  #{tag}
                </span>
              ))}
              {todo.tags.length > 2 && (
                <span className="text-[10px] text-muted-foreground">
                  +{todo.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {showDetail && (
        <TodoDetail
          todo={todo}
          userId={userId}
          onClose={() => setShowDetail(false)}
          onUpdate={() => {
            onUpdate?.();
            setShowDetail(false);
          }}
          onDelete={() => {
            onUpdate?.();
            setShowDetail(false);
          }}
        />
      )}
    </>
  );
}

function KanbanColumn({
  column,
  todos,
  userId,
  onUpdate,
  cardColor,
}: {
  column: KanbanColumnConfig;
  todos: Todo[];
  userId: string;
  onUpdate?: () => void;
  cardColor?: (todo: Todo) => string | undefined;
}) {
  const { setNodeRef, isOver } = useDroppable({
    // 重要：避免与 todo.id 冲突；同时让「列」永远是一个明确的 droppable 目标
    id: `col-${column.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 min-w-0 flex flex-col rounded-lg border border-border bg-background/50",
        isOver && "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
      )}
    >
      <div
        className="p-2 sm:p-3 border-b border-border bg-accent/30"
        style={{
          ...(column.color && {
            borderTopColor: column.color,
            borderTopWidth: "3px",
          }),
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-semibold">{column.title}</h3>
          <span className="text-[10px] sm:text-xs text-muted-foreground bg-background px-1.5 sm:px-2 py-0.5 rounded-full">
            {todos.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 min-h-[150px] sm:min-h-[200px]">
        <SortableContext
          items={todos.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {todos.map((todo) => (
            <KanbanCard
              key={todo.id}
              todo={todo}
              userId={userId}
              onUpdate={onUpdate}
              cardColor={cardColor?.(todo)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default function TodoKanban({
  todos,
  userId,
  onRefresh,
}: TodoKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [columns, setColumns] = useState<KanbanColumnConfig[]>(defaultColumns);
  const [swimlaneType, setSwimlaneType] = useState<SwimlaneType>("none");
  const [showSettings, setShowSettings] = useState(false);
  const [lists, setLists] = useState<TodoList[]>([]);
  const [customColumnInput, setCustomColumnInput] = useState("");
  const [localTodos, setLocalTodos] = useState<Todo[]>(todos);

  // 同步外部 todos 到本地状态
  useEffect(() => {
    setLocalTodos(todos);
  }, [todos]);

  // 加载清单列表
  useEffect(() => {
    const loadLists = async () => {
      try {
        const listsData = await getTodoLists(userId);
        setLists(listsData);
      } catch (error) {
        console.error("Failed to load lists:", error);
      }
    };
    loadLists();
  }, [userId]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // 自定义碰撞检测：优先使用指针所在容器，避免“拖到进行中却被最近的待办卡片吸走”
  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    // 次选：矩形相交（对空列更友好）
    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) return rectCollisions;
    // 兜底：最近角
    return closestCorners(args);
  };

  // 获取所有标签（使用本地状态）
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    localTodos.forEach((todo) => {
      todo.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet);
  }, [localTodos]);

  // 按状态分组任务（使用本地状态）
  const todosByStatus = useMemo(() => {
    const result: Record<string, Todo[]> = {};
    columns.forEach((col) => {
      result[col.id] = localTodos.filter((t) => {
        if (col.id === "todo") return t.status === "todo";
        if (col.id === "in_progress") return t.status === "in_progress";
        if (col.id === "done") return t.status === "done";
        // 自定义列：按标签或其他属性
        return false;
      });
    });
    return result;
  }, [localTodos, columns]);

  // 按泳道分组（使用本地状态）
  const todosBySwimlane = useMemo(() => {
    if (swimlaneType === "none") {
      return { "": localTodos };
    }

    const result: Record<string, Todo[]> = {};

    if (swimlaneType === "list") {
      lists.forEach((list) => {
        result[list.id] = localTodos.filter((t) => t.list_id === list.id);
      });
      result["no-list"] = localTodos.filter((t) => !t.list_id);
    } else if (swimlaneType === "tag") {
      allTags.forEach((tag) => {
        result[tag] = localTodos.filter((t) => t.tags?.includes(tag));
      });
      result["no-tag"] = localTodos.filter((t) => !t.tags || t.tags.length === 0);
    } else if (swimlaneType === "priority") {
      [0, 1, 2, 3].forEach((priority) => {
        const label = priority === 0 ? "无优先级" : priority === 1 ? "低优先级" : priority === 2 ? "中优先级" : "高优先级";
        result[`priority-${priority}`] = localTodos.filter((t) => t.priority === priority);
      });
    }

    return result;
  }, [localTodos, swimlaneType, lists, allTags]);

  // 获取卡片颜色
  const getCardColor = (todo: Todo): string | undefined => {
    if (swimlaneType === "priority") {
      return todo.priority > 0 ? getPriorityColor(todo.priority) : undefined;
    }
    return undefined;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const todoId = active.id as string;
    const targetId = over.id as string;

    // 找到目标列：可能是直接拖到列上，或者拖到列内的任务上
    let targetColumn: KanbanColumnConfig | undefined;
    
    // 1) 首先检查是否直接拖到列上（col-xxx）
    if (targetId.startsWith("col-")) {
      const colId = targetId.replace("col-", "");
      targetColumn = columns.find((col) => col.id === colId);
    } else {
      // 2) 如果不是列ID，可能是拖到列内的任务上，需要找到该任务所在的列
      const targetTodo = localTodos.find((t) => t.id === targetId);
      if (targetTodo) {
        targetColumn = columns.find((col) => {
          if (col.id === "todo") return targetTodo.status === "todo";
          if (col.id === "in_progress") return targetTodo.status === "in_progress";
          if (col.id === "done") return targetTodo.status === "done";
          return false;
        });
      }
    }
    
    // 如果找到了目标列，更新任务状态
    if (targetColumn) {
      // 只处理默认的状态列（todo, in_progress, done）
      if (targetColumn.id === "todo" || targetColumn.id === "in_progress" || targetColumn.id === "done") {
        const newStatus = targetColumn.id as "todo" | "in_progress" | "done";
        const todo = localTodos.find((t) => t.id === todoId);
        if (!todo || todo.status === newStatus) return;

        // 乐观更新本地状态（立即更新UI，不刷新页面）
        setLocalTodos((prev) =>
          prev.map((t) =>
            t.id === todoId ? { ...t, status: newStatus } : t
          )
        );

        // 后台更新数据库（不调用 onRefresh，避免页面刷新）
        try {
          const { updateTodo: updateTodoFn } = await import("@/lib/todo-storage");
          await updateTodoFn(todoId, { status: newStatus });
          // 不调用 onRefresh，保持流畅的用户体验
        } catch (error) {
          console.error("Failed to update todo status:", error);
          // 回滚本地状态
          setLocalTodos(todos);
        }
      }
    }
  };

  const handleAddCustomColumn = () => {
    if (!customColumnInput.trim()) return;
    const newColumn: KanbanColumnConfig = {
      id: `custom-${Date.now()}`,
      title: customColumnInput.trim(),
      color: "#6B7280",
    };
    setColumns([...columns, newColumn]);
    setCustomColumnInput("");
  };

  const handleRemoveColumn = (columnId: string) => {
    if (defaultColumns.find((col) => col.id === columnId)) {
      // 不允许删除默认列
      return;
    }
    setColumns(columns.filter((col) => col.id !== columnId));
  };

  const activeTodo = activeId ? localTodos.find((t) => t.id === activeId) : null;

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
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 工具栏 */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">泳道：</span>
            <select
              value={swimlaneType}
              onChange={(e) => setSwimlaneType(e.target.value as SwimlaneType)}
              className="rounded-md border border-border bg-background px-3 py-1 text-sm"
            >
              <option value="none">无</option>
              <option value="list">按清单</option>
              <option value="tag">按标签</option>
              <option value="priority">按优先级</option>
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="w-4 h-4 mr-2" />
            设置
          </Button>
        </div>

        {/* 设置面板 */}
        {showSettings && (
          <div className="border-b border-border bg-background/80 p-4">
            <div className="max-w-4xl mx-auto space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">自定义列</label>
                <div className="flex gap-2">
                  <Input
                    value={customColumnInput}
                    onChange={(e) => setCustomColumnInput(e.target.value)}
                    placeholder="输入列名称"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddCustomColumn();
                      }
                    }}
                  />
                  <Button onClick={handleAddCustomColumn} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {columns.map((column) => (
                  <div
                    key={column.id}
                    className="flex items-center gap-2 px-3 py-1 rounded bg-accent"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: column.color }}
                    />
                    <span className="text-sm">{column.title}</span>
                    {!defaultColumns.find((col) => col.id === column.id) && (
                      <button
                        onClick={() => handleRemoveColumn(column.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 看板内容 */}
        <div className="flex-1 overflow-auto p-2 sm:p-4">
          {swimlaneType === "none" ? (
            // 无泳道：直接显示列
            <div className="flex gap-2 sm:gap-4 min-w-max h-full">
              {columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  todos={todosByStatus[column.id] || []}
                  userId={userId}
                  onUpdate={onRefresh}
                  cardColor={getCardColor}
                />
              ))}
            </div>
          ) : (
            // 有泳道：按泳道分组显示
            <div className="space-y-4">
              {Object.entries(todosBySwimlane).map(([swimlaneId, swimlaneTodos]) => {
                const swimlaneLabel =
                  swimlaneType === "list"
                    ? lists.find((l) => l.id === swimlaneId)?.name || "无清单"
                    : swimlaneType === "tag"
                    ? swimlaneId === "no-tag"
                      ? "无标签"
                      : `#${swimlaneId}`
                    : swimlaneType === "priority"
                    ? swimlaneId.replace("priority-", "") === "0"
                      ? "无优先级"
                      : swimlaneId.replace("priority-", "") === "1"
                      ? "低优先级"
                      : swimlaneId.replace("priority-", "") === "2"
                      ? "中优先级"
                      : "高优先级"
                    : "";

                return (
                  <div key={swimlaneId} className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground px-2">
                      {swimlaneLabel}
                    </h3>
                    <div className="flex gap-2 sm:gap-4 min-w-max">
                      {columns.map((column) => {
                        const columnTodos = swimlaneTodos.filter((t) => {
                          if (column.id === "todo") return t.status === "todo";
                          if (column.id === "in_progress") return t.status === "in_progress";
                          if (column.id === "done") return t.status === "done";
                          return false;
                        });

                        return (
                          <KanbanColumn
                            key={`${swimlaneId}-${column.id}`}
                            column={column}
                            todos={columnTodos}
                            userId={userId}
                            onUpdate={onRefresh}
                            cardColor={getCardColor}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeTodo ? (
          <div className="bg-card border border-border rounded-lg p-3 shadow-lg w-64 opacity-90">
            <div className="flex items-start gap-2">
              <h3 className="text-sm font-medium flex-1">{activeTodo.title}</h3>
              {activeTodo.priority > 0 && (
                <div
                  className="w-2 h-2 rounded-full shrink-0 mt-1"
                  style={{
                    backgroundColor: getPriorityColor(activeTodo.priority),
                  }}
                />
              )}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

