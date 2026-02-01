"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  createTodoList,
  updateTodoList,
  deleteTodoList,
  type TodoList,
  type CreateTodoListData,
} from "@/lib/todo-storage";
import { cn } from "@/lib/utils";

interface TodoListSidebarProps {
  lists: TodoList[];
  selectedListId: string | null | "today" | "done";
  onSelectList: (listId: string | null | "today" | "done") => void;
  onListCreated: (list: TodoList) => void;
  onListUpdated: (list: TodoList) => void;
  onListDeleted: (listId: string) => void;
  userId: string;
}

export default function TodoListSidebar({
  lists,
  selectedListId,
  onSelectList,
  onListCreated,
  onListUpdated,
  onListDeleted,
  userId,
}: TodoListSidebarProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleCreateList = async () => {
    setIsCreating(true);
  };

  const handleCreateSubmit = async (name: string) => {
    if (!name.trim()) {
      setIsCreating(false);
      return;
    }

    try {
      const newList = await createTodoList(userId, {
        name: name.trim(),
      });
      onListCreated(newList);
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to create list:", error);
      const errorMessage = error instanceof Error ? error.message : "创建清单失败";
      toast({
        title: "创建失败",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleEditStart = (list: TodoList) => {
    setEditingId(list.id);
    setEditName(list.name);
  };

  const handleEditSubmit = async (id: string) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }

    setLoading(id);
    try {
      const updatedList = await updateTodoList(id, {
        name: editName.trim(),
      });
      onListUpdated(updatedList);
      setEditingId(null);
    } catch (error) {
      console.error("Failed to update list:", error);
      const errorMessage = error instanceof Error ? error.message : "更新清单失败";
      toast({
        title: "更新失败",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) {
      setDeleteDialogOpen(false);
      return;
    }
    setLoading(pendingDeleteId);
    try {
      await deleteTodoList(pendingDeleteId);
      onListDeleted(pendingDeleteId);
      toast({
        title: "删除成功",
        description: "清单已删除",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to delete list:", error);
      toast({
        title: "删除失败",
        description: "删除清单时出错，请重试",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
      setDeleteDialogOpen(false);
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* 标题 */}
      <div className="shrink-0 p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-muted-foreground">清单</h2>
      </div>

      {/* 清单列表 - 中间可滚动 */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {/* 全部任务 */}
        <button
          onClick={() => onSelectList(null)}
          className={cn(
            "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
            selectedListId === null
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/50"
          )}
        >
          全部任务
        </button>

        {/* 今天 */}
        <button
          onClick={() => onSelectList("today")}
          className={cn(
            "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
            selectedListId === "today"
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/50"
          )}
        >
          📅 今天
        </button>

        {/* 已完成 */}
        <button
          onClick={() => onSelectList("done")}
          className={cn(
            "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
            selectedListId === "done"
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/50"
          )}
        >
          ✅ 已完成
        </button>

        {/* 清单项 */}
        {lists.map((list) => (
          <div
            key={list.id}
            className={cn(
              "group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
              selectedListId === list.id
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            )}
          >
            {editingId === list.id ? (
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleEditSubmit(list.id);
                    } else if (e.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  autoFocus
                  className="h-7 text-sm"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleEditSubmit(list.id)}
                  disabled={loading === list.id}
                  className="h-7 w-7"
                >
                  {loading === list.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                  className="h-7 w-7"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onSelectList(list.id)}
                  className="flex-1 text-left truncate"
                >
                  {list.name}
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEditStart(list)}
                    className="h-7 w-7"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(list.id)}
                    disabled={loading === list.id}
                    className="h-7 w-7"
                  >
                    {loading === list.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}

        {/* 创建清单输入框 */}
        {isCreating && (
          <div className="px-3 py-2">
            <CreateListInput
              onSubmit={handleCreateSubmit}
              onCancel={() => setIsCreating(false)}
            />
          </div>
        )}
      </div>

      {/* 新建清单按钮 - 固定在侧边栏底部，不随列表滚动 */}
      <div className="shrink-0 sticky bottom-0 p-4 border-t border-border bg-background z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreateList}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          新建清单
        </Button>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除这个清单吗？清单中的任务不会被删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setPendingDeleteId(null);
              }}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={loading !== null}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateListInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSubmit(name);
            setName("");
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
        placeholder="清单名称"
        autoFocus
        className="h-8 text-sm"
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={() => {
          onSubmit(name);
          setName("");
        }}
        className="h-8 w-8"
      >
        <Check className="w-3 h-3" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={onCancel}
        className="h-8 w-8"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

