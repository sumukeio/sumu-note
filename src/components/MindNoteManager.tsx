"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Trash2,
  X,
  Loader2,
  Plus,
  Pencil,
  Search,
  ArrowLeft,
  Folder,
  Check,
  FolderInput,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getMindNotes,
  deleteMindNote,
  createMindNote,
  updateMindNote,
  type MindNote,
} from "@/lib/mind-note-storage";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

interface MindNoteManagerProps {
  userId: string;
  folderId?: string | null;
  folderName?: string;
  onBack?: () => void;
}

interface Folder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

// 可拖拽的文件夹卡片
function DraggableFolderCard({
  folder,
  isSelected,
  isSelectionMode,
  onClick,
  onTouchStart,
  onTouchEnd,
  onMouseDown,
  onMouseUp,
}: {
  folder: Folder;
  isSelected: boolean;
  isSelectionMode: boolean;
  onClick: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onMouseDown: () => void;
  onMouseUp: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `folder-${folder.id}`,
    data: { type: "folder", folder },
    disabled: !isSelectionMode,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `folder-${folder.id}`,
    data: { type: "folder", folder },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const setRefs = (element: HTMLDivElement | null) => {
    setNodeRef(element);
    setDroppableRef(element);
  };

  return (
    <div
      ref={setRefs}
      style={style}
      className={cn(
        "relative aspect-square rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all select-none cursor-pointer group",
        isSelected
          ? "bg-accent border-blue-500 shadow-[0_0_0_1px_#3b82f6]"
          : "bg-card border-border hover:bg-accent/50 active:scale-95",
        isOver && !isDragging && "bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500"
      )}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onClick={onClick}
    >
      <Folder
        className={cn(
          "w-10 h-10 transition-colors",
          isSelected ? "text-blue-500 fill-blue-500/20" : "text-yellow-500 fill-yellow-500/20"
        )}
      />
      <span className="text-xs font-medium text-center truncate w-full px-2">
        {folder.name}
      </span>
      {isSelectionMode && (
        <div
          className={cn(
            "absolute top-2 right-2 w-5 h-5 rounded-full bg-background border-2 flex items-center justify-center",
            isSelected ? "border-blue-500 bg-blue-500" : "border-muted-foreground"
          )}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
      )}
    </div>
  );
}

// 可拖拽的思维笔记卡片
function DraggableMindNoteCard({
  note,
  isSelected,
  isSelectionMode,
  onClick,
  onTouchStart,
  onTouchEnd,
  onMouseDown,
  onMouseUp,
}: {
  note: MindNote;
  isSelected: boolean;
  isSelectionMode: boolean;
  onClick: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onMouseDown: () => void;
  onMouseUp: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `note-${note.id}`,
    data: { type: "mind_note", note },
    disabled: !isSelectionMode,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `note-${note.id}`,
    data: { type: "mind_note", note },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const setRefs = (element: HTMLDivElement | null) => {
    setNodeRef(element);
    setDroppableRef(element);
  };

  return (
    <div
      ref={setRefs}
      style={style}
      className={cn(
        "relative h-32 p-4 rounded-xl border flex flex-col justify-between transition-all select-none cursor-pointer touch-none",
        isSelected
          ? "bg-accent border-blue-500 shadow-[0_0_0_1px_#3b82f6]"
          : "bg-card border-border active:scale-95",
        isOver && !isDragging && "bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500"
      )}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onClick={onClick}
    >
      <div>
        <h3 className="font-bold text-sm mb-1 truncate flex items-center gap-1">
          <FileText className="w-3 h-3 text-muted-foreground" />
          {note.title || "未命名思维笔记"}
        </h3>
      </div>
      <div className="flex justify-between items-center mt-2">
        <span className="text-[10px] text-muted-foreground">
          {new Date(note.updated_at).toLocaleDateString()}
        </span>
        {isSelectionMode ? (
          <div
            className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center",
              isSelected ? "bg-blue-500" : "border-2 border-zinc-400"
            )}
          >
            {isSelected && <X className="w-3 h-3 text-white" />}
          </div>
        ) : (
          <FileText className="w-3 h-3 text-muted-foreground/30" />
        )}
      </div>
    </div>
  );
}

// Dock 项组件
function DroppableDockItem({
  id,
  icon: Icon,
  label,
  disabled,
  onClick,
  variant = "default",
}: {
  id: string;
  icon: any;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  variant?: "default" | "destructive";
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const isDestructive = variant === "destructive";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col items-center gap-1 transition-all",
        disabled ? "opacity-30 grayscale cursor-not-allowed" : "cursor-pointer",
        isOver ? "scale-125 -translate-y-2" : "hover:scale-110"
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "p-2 rounded-lg transition-colors",
          isOver
            ? isDestructive
              ? "bg-red-500 text-white shadow-lg shadow-red-500/50"
              : "bg-blue-500 text-white shadow-lg shadow-blue-500/50"
            : isDestructive
            ? "bg-red-500/10 text-red-500"
            : "bg-accent text-foreground"
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <span className={cn("text-[10px]", isOver ? "font-bold" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  );
}

export default function MindNoteManager({
  userId,
  folderId,
  folderName,
  onBack,
}: MindNoteManagerProps) {
  const router = useRouter();
  const [view, setView] = useState<"folders" | "notes">(folderId === undefined ? "folders" : "notes");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [mindNotes, setMindNotes] = useState<MindNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState<"create_folder" | "create_note" | "rename_folder" | "rename_note">("create_folder");
  const [editingItem, setEditingItem] = useState<Folder | MindNote | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [targetFolders, setTargetFolders] = useState<Folder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const isSelectionMode = selectedIds.size > 0;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const ignoreClickRef = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // 获取文件夹列表
  const fetchFolders = async () => {
    const { data } = await supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .eq("parent_id", folderId || null)
      .order("created_at", { ascending: false });
    if (data) setFolders(data);
  };

  // 获取思维笔记列表
  const fetchMindNotes = async () => {
    try {
      const notes = await getMindNotes(userId, folderId);
      setMindNotes(notes);
    } catch (error) {
      console.error("Failed to fetch mind notes:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchFolders(), fetchMindNotes()]);
      setLoading(false);
    };
    if (userId) {
      loadData();
    }
  }, [userId, folderId]);

  const handleCreateFolder = () => {
    setEditMode("create_folder");
    setEditingItem(null);
    setNameInput("");
    setIsEditDialogOpen(true);
  };

  const handleCreateNote = () => {
    setEditMode("create_note");
    setEditingItem(null);
    setNameInput("");
    setIsEditDialogOpen(true);
  };

  const handleSave = async () => {
    const name = nameInput.trim();
    if (!name) return;

    try {
      if (editMode === "create_folder") {
        const { error } = await supabase
          .from("folders")
          .insert({ user_id: userId, name, parent_id: folderId || null });
        if (!error) {
          setIsEditDialogOpen(false);
          fetchFolders();
        }
      } else if (editMode === "create_note") {
        const newNote = await createMindNote(userId, {
          title: name,
          folder_id: folderId || null,
        });
        setIsEditDialogOpen(false);
        fetchMindNotes();
        router.push(`/dashboard/mind-notes/${newNote.id}`);
      } else if (editMode === "rename_folder" && editingItem) {
        const { error } = await supabase
          .from("folders")
          .update({ name })
          .eq("id", editingItem.id);
        if (!error) {
          setIsEditDialogOpen(false);
          fetchFolders();
          exitSelectionMode();
        }
      } else if (editMode === "rename_note" && editingItem) {
        const updatedNote = await updateMindNote(editingItem.id, { title: name });
        setMindNotes((prev) =>
          prev.map((n) => (n.id === updatedNote.id ? updatedNote : n))
        );
        setIsEditDialogOpen(false);
        exitSelectionMode();
      }
    } catch (error) {
      console.error("Failed to save:", error);
      alert("操作失败，请稍后重试");
    }
  };

  const handleRename = () => {
    if (selectedIds.size !== 1) return;
    const id = Array.from(selectedIds)[0];
    
    // 检查是文件夹还是思维笔记
    const folder = folders.find((f) => f.id === id);
    const note = mindNotes.find((n) => n.id === id);
    
    if (folder) {
      setEditMode("rename_folder");
      setEditingItem(folder);
      setNameInput(folder.name);
      setIsEditDialogOpen(true);
    } else if (note) {
      setEditMode("rename_note");
      setEditingItem(note);
      setNameInput(note.title);
      setIsEditDialogOpen(true);
    }
  };

  const handleDelete = async () => {
    const ids = Array.from(selectedIds);
    const folderIds: string[] = [];
    const noteIds: string[] = [];

    ids.forEach((id) => {
      if (folders.find((f) => f.id === id)) {
        folderIds.push(id);
      } else {
        noteIds.push(id);
      }
    });

    if (confirm(`确定要删除这 ${ids.length} 个项目吗？`)) {
      try {
        if (folderIds.length > 0) {
          await supabase.from("folders").delete().in("id", folderIds);
          setFolders((prev) => prev.filter((f) => !folderIds.includes(f.id)));
        }
        if (noteIds.length > 0) {
          await Promise.all(noteIds.map((id) => deleteMindNote(id)));
          setMindNotes((prev) => prev.filter((n) => !noteIds.includes(n.id)));
        }
        exitSelectionMode();
      } catch (error) {
        console.error("Failed to delete:", error);
        alert("删除失败，请稍后重试");
      }
    }
  };

  const handleMoveClick = () => {
    const targets = folders.filter((f) => !selectedIds.has(f.id));
    setTargetFolders(targets);
    setIsMoveDialogOpen(true);
  };

  const executeMove = async (targetFolderId: string | null) => {
    const ids = Array.from(selectedIds);
    const folderIds: string[] = [];
    const noteIds: string[] = [];

    ids.forEach((id) => {
      if (folders.find((f) => f.id === id)) {
        folderIds.push(id);
      } else {
        noteIds.push(id);
      }
    });

    try {
      if (folderIds.length > 0) {
        await supabase
          .from("folders")
          .update({ parent_id: targetFolderId })
          .in("id", folderIds);
      }
      if (noteIds.length > 0) {
        await Promise.all(
          noteIds.map((id) =>
            updateMindNote(id, { folder_id: targetFolderId })
          )
        );
      }
      fetchFolders();
      fetchMindNotes();
      setIsMoveDialogOpen(false);
      exitSelectionMode();
    } catch (error) {
      console.error("Failed to move:", error);
      alert("移动失败，请稍后重试");
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleTouchStart = (id: string) => {
    if (isSelectionMode) return;
    ignoreClickRef.current = false;
    timerRef.current = setTimeout(() => {
      const newSet = new Set(selectedIds);
      newSet.add(id);
      setSelectedIds(newSet);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(50);
      }
      ignoreClickRef.current = true;
    }, 500);
  };

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleFolderClick = (folder: Folder) => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }
    if (isSelectionMode) {
      toggleSelection(folder.id);
    } else {
      router.push(`/dashboard/mind-notes?folder=${folder.id}`);
    }
  };

  const handleNoteClick = (note: MindNote) => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }
    if (isSelectionMode) {
      toggleSelection(note.id);
    } else {
      router.push(`/dashboard/mind-notes/${note.id}`);
    }
  };

  const exitSelectionMode = () => setSelectedIds(new Set());

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overId = over.id as string;

    if (overId === "dock-delete") {
      handleDelete();
    } else if (overId === "dock-move") {
      handleMoveClick();
    } else if (overId.startsWith("folder-")) {
      const targetFolderId = overId.replace("folder-", "");
      try {
        if (activeData?.type === "mind_note") {
          await updateMindNote(activeData.note.id, { folder_id: targetFolderId });
          await fetchMindNotes();
        } else if (activeData?.type === "folder") {
          await supabase
            .from("folders")
            .update({ parent_id: targetFolderId })
            .eq("id", activeData.folder.id);
          await fetchFolders();
        }
      } catch (error) {
        console.error("Failed to move:", error);
        alert("移动失败，请稍后重试");
      }
    }
  };

  const filteredFolders = folders.filter((folder) => {
    if (!searchQuery) return true;
    return folder.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredNotes = mindNotes.filter((note) => {
    if (!searchQuery) return true;
    return (note.title || "").toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-[80vh] pb-32" onClick={(e) => { if (e.target === e.currentTarget && isSelectionMode) exitSelectionMode(); }}>
        <header className="sticky top-0 bg-background/80 backdrop-blur z-10 border-b border-border/40">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              {onBack ? (
                <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push("/dashboard")}
                  className="-ml-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <h1 className="text-lg font-bold">{folderName || "思维笔记"}</h1>
              <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full">
                {folders.length + mindNotes.length}
              </span>
            </div>
            <div className="flex gap-2 items-center">
              {!isSelectionMode && (
                <>
                  <Button size="sm" onClick={handleCreateFolder} variant="outline">
                    <Folder className="w-4 h-4 mr-1" /> 文件夹
                  </Button>
                  <Button size="sm" onClick={handleCreateNote} variant="outline">
                    <Plus className="w-4 h-4 mr-1" /> 新建
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索文件夹和思维笔记..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-accent/50 border-none h-9"
              />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
          {/* 文件夹列表 */}
          {filteredFolders.map((folder) => (
            <DraggableFolderCard
              key={folder.id}
              folder={folder}
              isSelected={selectedIds.has(folder.id)}
              isSelectionMode={isSelectionMode}
              onClick={() => handleFolderClick(folder)}
              onTouchStart={() => handleTouchStart(folder.id)}
              onTouchEnd={handleTouchEnd}
              onMouseDown={() => handleTouchStart(folder.id)}
              onMouseUp={handleTouchEnd}
            />
          ))}

          {/* 思维笔记列表 */}
          {filteredNotes.map((note) => (
            <DraggableMindNoteCard
              key={note.id}
              note={note}
              isSelected={selectedIds.has(note.id)}
              isSelectionMode={isSelectionMode}
              onClick={() => handleNoteClick(note)}
              onTouchStart={() => handleTouchStart(note.id)}
              onTouchEnd={handleTouchEnd}
              onMouseDown={() => handleTouchStart(note.id)}
              onMouseUp={handleTouchEnd}
            />
          ))}

          {/* 空状态 */}
          {filteredFolders.length === 0 && filteredNotes.length === 0 && (
            <div className="col-span-full text-center py-10 text-muted-foreground border-2 border-dashed border-border rounded-xl flex flex-col items-center gap-2">
              {searchQuery ? (
                <p>未找到相关内容</p>
              ) : (
                <>
                  <FileText className="w-12 h-12 opacity-50" />
                  <p>还没有内容</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={handleCreateFolder} variant="outline">
                      <Folder className="w-4 h-4 mr-1" /> 创建文件夹
                    </Button>
                    <Button size="sm" onClick={handleCreateNote} variant="outline">
                      <Plus className="w-4 h-4 mr-1" /> 创建思维笔记
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Dock 工具栏 */}
        <div
          className={cn(
            "fixed left-0 right-0 bottom-8 flex justify-center z-50 transition-all duration-300",
            isSelectionMode
              ? "translate-y-0 opacity-100"
              : "translate-y-20 opacity-0 pointer-events-none"
          )}
        >
          <div className="relative bg-background/90 backdrop-blur-md border border-border px-8 py-3 rounded-2xl shadow-2xl flex items-center gap-8">
            <button
              onClick={(e) => {
                e.stopPropagation();
                exitSelectionMode();
              }}
              className="absolute -top-3 -right-3 w-6 h-6 bg-muted rounded-full flex items-center justify-center border border-border shadow-md"
            >
              <X className="w-3 h-3" />
            </button>

            <div
              className={cn(
                "flex flex-col items-center gap-1 transition-all",
                selectedIds.size === 1
                  ? "cursor-pointer hover:scale-110"
                  : "opacity-30 grayscale cursor-not-allowed"
              )}
              onClick={handleRename}
            >
              <div className="p-2 bg-accent rounded-lg">
                <Pencil className="w-5 h-5" />
              </div>
              <span className="text-[10px]">重命名</span>
            </div>

            <DroppableDockItem
              id="dock-move"
              icon={FolderInput}
              label="移动"
              onClick={handleMoveClick}
            />

            <DroppableDockItem
              id="dock-delete"
              icon={Trash2}
              label="删除"
              variant="destructive"
              onClick={handleDelete}
            />
          </div>
        </div>

        <DragOverlay>
          {activeId ? (
            <div className="w-40 h-24 bg-accent/90 backdrop-blur border border-blue-500 rounded-xl shadow-2xl p-4 flex flex-col justify-center items-center rotate-3">
              <FileText className="w-8 h-8 text-blue-500 mb-2" />
              <span className="text-xs font-bold">
                {selectedIds.size > 1 ? `已选择 ${selectedIds.size} 项` : "移动中..."}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </div>

      {/* 创建/重命名对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editMode === "create_folder"
                ? "新建文件夹"
                : editMode === "create_note"
                ? "新建思维笔记"
                : editMode === "rename_folder"
                ? "重命名文件夹"
                : "重命名思维笔记"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder={
                editMode.includes("folder") ? "输入文件夹名称" : "输入思维笔记标题"
              }
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                } else if (e.key === "Escape") {
                  setIsEditDialogOpen(false);
                }
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEditDialogOpen(false)}>
                取消
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!nameInput.trim()}>
                确定
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 移动对话框 */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移动到...</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto py-4">
            <Button
              variant="outline"
              className="justify-start h-auto py-3"
              onClick={() => executeMove(null)}
            >
              <Folder className="w-4 h-4 mr-2 text-yellow-500" />
              根目录
            </Button>
            {targetFolders.map((tf) => (
              <Button
                key={tf.id}
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => executeMove(tf.id)}
              >
                <Folder className="w-4 h-4 mr-2 text-yellow-500" />
                {tf.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
