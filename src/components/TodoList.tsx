"use client";

import { useState, useMemo, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  CheckSquare,
  Square,
  Trash2,
  Move,
  Tag as TagIcon,
  Flag,
  X,
} from "lucide-react";
import {
  completeTodo,
  uncompleteTodo,
  batchCompleteTodos,
  batchDeleteTodos,
  batchUpdateTodos,
  getTodoLists,
  reorderTodos,
  type Todo,
  type TodoList,
} from "@/lib/todo-storage";
import { formatDueDate, getPriorityColor, groupTodosByDate } from "@/lib/todo-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  closestCenter,
} from "@dnd-kit/core";
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TodoItem from "./TodoItem";
import TodoContextMenu from "./TodoContextMenu";

// 可排序的 TodoItem 包装组件
function SortableTodoItem(props: React.ComponentProps<typeof TodoItem>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        className="cursor-move"
        style={{ touchAction: "none" }}
      >
        <TodoItem {...props} />
      </div>
    </div>
  );
}

interface TodoListProps {
  todos: Todo[];
  userId: string;
  onRefresh?: () => void;
  groupByDate?: boolean;
  searchQuery?: string;
}

export default function TodoList({
  todos,
  userId,
  onRefresh,
  groupByDate = true,
  searchQuery = "",
}: TodoListProps) {
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isBatchOperating, setIsBatchOperating] = useState(false);
  const [lists, setLists] = useState<TodoList[]>([]);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showPriorityDialog, setShowPriorityDialog] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localTodos, setLocalTodos] = useState<Todo[]>(todos);
  const [contextMenu, setContextMenu] = useState<{
    todo: Todo;
    position: { x: number; y: number };
  } | null>(null);

  // 同步外部 todos 变化
  useEffect(() => {
    setLocalTodos(todos);
  }, [todos]);

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
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    // 如果是在分组模式下，需要处理分组内的排序
    if (groupByDate && groupedTodos) {
      // 找到任务所在的日期组
      let sourceDate: string | null = null;
      let targetDate: string | null = null;
      let sourceIndex = -1;
      let targetIndex = -1;

      for (const [date, dateTodos] of groupedTodos.entries()) {
        const sourceIdx = dateTodos.findIndex((t) => t.id === active.id);
        const targetIdx = dateTodos.findIndex((t) => t.id === over.id);
        if (sourceIdx !== -1) sourceDate = date;
        if (targetIdx !== -1) targetDate = date;
        if (sourceIdx !== -1) sourceIndex = sourceIdx;
        if (targetIdx !== -1) targetIndex = targetIdx;
      }

      // 如果是在同一组内拖拽
      if (sourceDate === targetDate && sourceDate) {
        const dateTodos = groupedTodos.get(sourceDate) || [];
        const newTodos = arrayMove(dateTodos, sourceIndex, targetIndex);
        setLocalTodos((prev) => {
          const result = [...prev];
          const todoIds = newTodos.map((t) => t.id);
          const otherTodos = prev.filter((t) => !todoIds.includes(t.id));
          return [...otherTodos, ...newTodos];
        });

        // 更新数据库（后台更新，不刷新页面）
        try {
          await reorderTodos(newTodos.map((t) => t.id));
          // 不调用 onRefresh，保持流畅的用户体验
        } catch (error) {
          console.error("Failed to reorder todos:", error);
          setLocalTodos(todos); // 回滚
        }
      }
    } else {
      // 普通列表模式
      const oldIndex = localTodos.findIndex((t) => t.id === active.id);
      const newIndex = localTodos.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newTodos = arrayMove(localTodos, oldIndex, newIndex);
        setLocalTodos(newTodos);

        // 更新数据库（后台更新，不刷新页面）
        try {
          await reorderTodos(newTodos.map((t) => t.id));
          // 不调用 onRefresh，保持流畅的用户体验
        } catch (error) {
          console.error("Failed to reorder todos:", error);
          setLocalTodos(todos); // 回滚
        }
      }
    }
  };

  // 加载清单列表
  useEffect(() => {
    if (showMoveDialog) {
      getTodoLists(userId).then(setLists).catch(console.error);
    }
  }, [userId, showMoveDialog]);

  const handleToggleComplete = async (todo: Todo) => {
    setCompletingIds((prev) => new Set(prev).add(todo.id));

    // 乐观更新：先更新本地状态
    const newStatus = todo.status === "done" ? "todo" : "done";
    const newCompletedAt = newStatus === "done" ? new Date().toISOString() : null;
    
    setLocalTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id
          ? {
              ...t,
              status: newStatus,
              completed_at: newCompletedAt,
            }
          : t
      )
    );

    try {
      if (todo.status === "done") {
        await uncompleteTodo(todo.id);
      } else {
        await completeTodo(todo.id);
      }
      // 不调用 onRefresh，保持流畅的用户体验
    } catch (error) {
      console.error("Failed to toggle todo:", error);
      // 回滚到原始状态
      setLocalTodos((prev) =>
        prev.map((t) =>
          t.id === todo.id
            ? {
                ...t,
                status: todo.status,
                completed_at: todo.completed_at,
              }
            : t
        )
      );
    } finally {
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(todo.id);
        return next;
      });
    }
  };

  const handleToggleSelect = (todoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(todoId)) {
        next.delete(todoId);
      } else {
        next.add(todoId);
      }
      return next;
    });
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

  const handleSelectAll = () => {
    if (selectedIds.size === todos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(todos.map((t) => t.id)));
    }
  };

  const handleBatchComplete = async () => {
    if (selectedIds.size === 0) return;
    setIsBatchOperating(true);
    try {
      await batchCompleteTodos(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsSelectMode(false);
      onRefresh?.();
    } catch (error) {
      console.error("Failed to batch complete todos:", error);
      alert("批量完成失败，请重试");
    } finally {
      setIsBatchOperating(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个任务吗？`)) {
      return;
    }
    setIsBatchOperating(true);
    try {
      await batchDeleteTodos(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsSelectMode(false);
      onRefresh?.();
    } catch (error) {
      console.error("Failed to batch delete todos:", error);
      alert("批量删除失败，请重试");
    } finally {
      setIsBatchOperating(false);
    }
  };

  const handleBatchMove = async (listId: string | null) => {
    if (selectedIds.size === 0) return;
    setIsBatchOperating(true);
    try {
      await batchUpdateTodos(Array.from(selectedIds), { list_id: listId });
      setSelectedIds(new Set());
      setIsSelectMode(false);
      setShowMoveDialog(false);
      onRefresh?.();
    } catch (error) {
      console.error("Failed to batch move todos:", error);
      alert("批量移动失败，请重试");
    } finally {
      setIsBatchOperating(false);
    }
  };

  const handleBatchSetTags = async () => {
    if (selectedIds.size === 0 || !tagInput.trim()) return;
    const tags = tagInput
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setIsBatchOperating(true);
    try {
      // 获取当前任务，合并标签
      const selectedTodos = todos.filter((t) => selectedIds.has(t.id));
      for (const todo of selectedTodos) {
        const existingTags = todo.tags || [];
        const newTags = Array.from(new Set([...existingTags, ...tags]));
        await batchUpdateTodos([todo.id], { tags: newTags });
      }
      setSelectedIds(new Set());
      setIsSelectMode(false);
      setShowTagDialog(false);
      setTagInput("");
      onRefresh?.();
    } catch (error) {
      console.error("Failed to batch set tags:", error);
      alert("批量设置标签失败，请重试");
    } finally {
      setIsBatchOperating(false);
    }
  };

  const handleBatchSetPriority = async (priority: 0 | 1 | 2 | 3) => {
    if (selectedIds.size === 0) return;
    setIsBatchOperating(true);
    try {
      await batchUpdateTodos(Array.from(selectedIds), { priority });
      setSelectedIds(new Set());
      setIsSelectMode(false);
      setShowPriorityDialog(false);
      onRefresh?.();
    } catch (error) {
      console.error("Failed to batch set priority:", error);
      alert("批量设置优先级失败，请重试");
    } finally {
      setIsBatchOperating(false);
    }
  };

  // 按日期分组
  const groupedTodos = useMemo(() => {
    if (!groupByDate) {
      return null;
    }
    return groupTodosByDate(localTodos);
  }, [localTodos, groupByDate]);

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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 批量操作工具栏 */}
      {isSelectMode && (
        <div className="border-b border-border bg-background/50 backdrop-blur p-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="flex items-center gap-2"
            >
              {selectedIds.size === todos.length ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span className="text-xs">
                {selectedIds.size === todos.length ? "取消全选" : "全选"}
              </span>
            </Button>
            <span className="text-sm text-muted-foreground">
              已选择 {selectedIds.size} 个任务
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchComplete}
              disabled={selectedIds.size === 0 || isBatchOperating}
              className="flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs">完成</span>
            </Button>
            <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedIds.size === 0 || isBatchOperating}
                  className="flex items-center gap-2"
                >
                  <Move className="w-4 h-4" />
                  <span className="text-xs">移动</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>移动到清单</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleBatchMove(null)}
                    disabled={isBatchOperating}
                  >
                    无清单
                  </Button>
                  {lists.map((list) => (
                    <Button
                      key={list.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleBatchMove(list.id)}
                      disabled={isBatchOperating}
                    >
                      {list.name}
                    </Button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedIds.size === 0 || isBatchOperating}
                  className="flex items-center gap-2"
                >
                  <TagIcon className="w-4 h-4" />
                  <span className="text-xs">标签</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>添加标签</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="输入标签，用逗号或空格分隔"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleBatchSetTags();
                      }
                    }}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowTagDialog(false);
                        setTagInput("");
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleBatchSetTags}
                      disabled={!tagInput.trim() || isBatchOperating}
                    >
                      确定
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={showPriorityDialog} onOpenChange={setShowPriorityDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedIds.size === 0 || isBatchOperating}
                  className="flex items-center gap-2"
                >
                  <Flag className="w-4 h-4" />
                  <span className="text-xs">优先级</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>设置优先级</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  {[
                    { value: 0, label: "无优先级" },
                    { value: 1, label: "低优先级" },
                    { value: 2, label: "中优先级" },
                    { value: 3, label: "高优先级" },
                  ].map((p) => (
                    <Button
                      key={p.value}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleBatchSetPriority(p.value as 0 | 1 | 2 | 3)}
                      disabled={isBatchOperating}
                    >
                      <div
                        className="w-2 h-2 rounded-full mr-2"
                        style={{
                          backgroundColor:
                            p.value > 0 ? getPriorityColor(p.value as 0 | 1 | 2 | 3) : "transparent",
                        }}
                      />
                      {p.label}
                    </Button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchDelete}
              disabled={selectedIds.size === 0 || isBatchOperating}
              className="flex items-center gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-xs">删除</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsSelectMode(false);
                setSelectedIds(new Set());
              }}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              <span className="text-xs">取消</span>
            </Button>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4">
        <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4">
          {/* 多选模式切换按钮 */}
          {!isSelectMode && todos.length > 0 && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSelectMode(true)}
                className="flex items-center gap-2"
              >
                <CheckSquare className="w-4 h-4" />
                <span className="text-xs">多选</span>
              </Button>
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {groupByDate && groupedTodos ? (
              // 按日期分组显示
              Array.from(groupedTodos.entries())
                .sort(([dateA], [dateB]) => {
                  if (dateA === "无日期") return 1;
                  if (dateB === "无日期") return -1;
                  return dateA.localeCompare(dateB);
                })
                .map(([date, dateTodos]) => (
                  <div key={date} className="space-y-2">
                    <div className="flex items-center gap-2 px-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        {date}
                      </h3>
                      <span className="text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
                        {dateTodos.length}
                      </span>
                    </div>
                    <SortableContext
                      items={dateTodos.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {dateTodos.map((todo) => (
                          <SortableTodoItem
                            key={todo.id}
                            todo={todo}
                            isCompleting={completingIds.has(todo.id)}
                            onToggleComplete={() => handleToggleComplete(todo)}
                            userId={userId}
                            onUpdate={onRefresh ?? (() => {})}
                            isSelectMode={isSelectMode}
                            isSelected={selectedIds.has(todo.id)}
                            onToggleSelect={() => handleToggleSelect(todo.id)}
                            searchQuery={searchQuery}
                            onContextMenu={handleContextMenu}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </div>
                ))
            ) : (
              // 普通列表显示
              <SortableContext
                items={localTodos.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {localTodos.map((todo) => (
                    <SortableTodoItem
                      key={todo.id}
                      todo={todo}
                      isCompleting={completingIds.has(todo.id)}
                      onToggleComplete={() => handleToggleComplete(todo)}
                      userId={userId}
                      onUpdate={onRefresh ?? (() => {})}
                      isSelectMode={isSelectMode}
                      isSelected={selectedIds.has(todo.id)}
                      onToggleSelect={() => handleToggleSelect(todo.id)}
                      searchQuery={searchQuery}
                    />
                  ))}
                </div>
              </SortableContext>
            )}

            <DragOverlay>
              {activeId ? (
                <div className="bg-card border border-border rounded-lg p-3 shadow-lg opacity-90">
                  {localTodos.find((t) => t.id === activeId)?.title || ""}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

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

