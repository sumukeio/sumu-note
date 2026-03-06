"use client";

import { useState, useRef, useEffect } from "react";
import { Folder, Trash2, FolderInput, X, Check, Loader2, Plus, Pencil } from "lucide-react"; // 🔥 引入 Pencil
import { supabase } from "@/lib/supabase";
import { updateNotesFolder } from "@/lib/note-service";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { DndContext, DragOverlay, useDraggable, useDroppable, TouchSensor, MouseSensor, useSensor, useSensors, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { vibrateSelection } from "@/lib/haptics";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

interface FolderManagerProps {
  userId: string;
  onEnterFolder: (folderId: string, folderName: string) => void;
}

export default function FolderManager({ userId, onEnterFolder }: FolderManagerProps) {
  const { toast } = useToast();
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [targetFolders, setTargetFolders] = useState<any[]>([]); 
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState<"create" | "rename">("create");
  const [editingFolder, setEditingFolder] = useState<any | null>(null);
  const [folderNameInput, setFolderNameInput] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveConfirmDialogOpen, setMoveConfirmDialogOpen] = useState(false);
  const [pendingMoveTargetId, setPendingMoveTargetId] = useState<string | null>(null);

  const isSelectionMode = selectedIds.size > 0;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const ignoreClickRef = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const fetchFolders = async () => {
    // 只获取根文件夹（parent_id 为 null 的文件夹）
    const { data } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .is('parent_id', null)
      .order('created_at', { ascending: false });
    if (data) setFolders(data);
    setLoading(false);
  };

  useEffect(() => { if (userId) fetchFolders(); }, [userId]);


  const handleCreateFolder = async () => {
    setEditMode("create");
    setEditingFolder(null);
    setFolderNameInput("");
    setIsEditDialogOpen(true);
  };

  const toggleSelection = (id: string) => { const newSet = new Set(selectedIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedIds(newSet); };
  const handleTouchStart = (id: string) => { if (isSelectionMode) return; ignoreClickRef.current = false; timerRef.current = setTimeout(() => { const newSet = new Set(selectedIds); newSet.add(id); setSelectedIds(newSet); vibrateSelection(); ignoreClickRef.current = true; }, 500); };
  const handleTouchEnd = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  const handleClick = (folder: any) => { if (ignoreClickRef.current) { ignoreClickRef.current = false; return; } if (isSelectionMode) { toggleSelection(folder.id); } else { onEnterFolder(folder.id, folder.name); } };
  const exitSelectionMode = () => setSelectedIds(new Set());

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('folders').delete().in('id', ids);
    if (!error) {
      setFolders(prev => prev.filter(f => !selectedIds.has(f.id)));
      exitSelectionMode();
      toast({
        title: "删除成功",
        description: `${ids.length} 个文件夹已删除`,
        variant: "default",
      });
    } else {
      toast({
        title: "删除失败",
        description: error.message || "删除文件夹时出错",
        variant: "destructive",
      });
    }
    setDeleteDialogOpen(false);
  };

  const handleMoveClick = () => {
    const targets = folders.filter(f => !selectedIds.has(f.id));
    setTargetFolders(targets);
    setIsMoveDialogOpen(true);
  };

  const handleMoveTargetClick = (targetFolderId: string) => {
    setPendingMoveTargetId(targetFolderId);
    setMoveConfirmDialogOpen(true);
  };

  const executeMove = async (targetFolderId: string, keepOriginal: boolean) => {
    const idsToMove = Array.from(selectedIds);
    if (keepOriginal) {
        const { error } = await supabase.from('folders').update({ parent_id: targetFolderId }).in('id', idsToMove);
        if (error) {
          toast({
            title: "移动失败",
            description: error.message || "移动文件夹时出错",
            variant: "destructive",
          });
          return;
        }
    } else {
        try {
          await updateNotesFolder(idsToMove, targetFolderId, userId);
        } catch (notesError: unknown) {
          toast({
            title: "移动失败",
            description: (notesError as Error)?.message || "移动笔记时出错",
            variant: "destructive",
          });
          return;
        }
        const { error: foldersError } = await supabase.from('folders').delete().in('id', idsToMove);
        if (foldersError) {
          toast({
            title: "移动失败",
            description: foldersError.message || "删除文件夹时出错",
            variant: "destructive",
          });
          return;
        }
    }
    toast({
      title: "移动成功",
      description: `${idsToMove.length} 个文件夹已移动`,
      variant: "success",
    });
    fetchFolders();
    setIsMoveDialogOpen(false);
    setMoveConfirmDialogOpen(false);
    setPendingMoveTargetId(null);
    exitSelectionMode();
  };

  // 🔥 新增：重命名功能
  const handleRename = async () => {
    if (selectedIds.size !== 1) return; // 只有单选才能重命名
    
    const id = Array.from(selectedIds)[0];
    const folder = folders.find(f => f.id === id);
    if (!folder) return;

    setEditMode("rename");
    setEditingFolder(folder);
    setFolderNameInput(folder.name || "");
    setIsEditDialogOpen(true);
  };

  const handleSaveFolder = async () => {
    const name = folderNameInput.trim();
    if (!name) return;

    if (editMode === "create") {
      const { error } = await supabase
        .from("folders")
        .insert({ user_id: userId, name });
      if (!error) {
        setIsEditDialogOpen(false);
        setFolderNameInput("");
        fetchFolders();
      }
    } else if (editMode === "rename" && editingFolder) {
      if (name === editingFolder.name) {
        setIsEditDialogOpen(false);
        return;
      }
      const { error } = await supabase
        .from("folders")
        .update({ name })
        .eq("id", editingFolder.id);

      if (!error) {
        setIsEditDialogOpen(false);
        setFolderNameInput("");
        fetchFolders();
        exitSelectionMode();
        toast({
          title: "重命名成功",
          description: "文件夹名称已更新",
          variant: "success",
        });
      } else {
        toast({
          title: "重命名失败",
          description: error.message || "更新文件夹名称时出错",
          variant: "destructive",
        });
      }
    }
  };

  // 拖拽处理函数
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    // 如果拖拽的文件夹未被选中，自动选中它
    if (!selectedIds.has(event.active.id as string)) {
      const newSet = new Set(selectedIds);
      newSet.add(event.active.id as string);
      setSelectedIds(newSet);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { over } = event;
    if (!over) return;
    
    const draggedFolderId = event.active.id as string;
    const targetFolderId = over.id as string;
    
    // 如果拖拽到另一个文件夹上
    if (targetFolderId !== draggedFolderId && targetFolderId.startsWith('folder-')) {
      const actualTargetId = targetFolderId.replace('folder-', '');
      // 检查不能将文件夹拖到自己或自己的子文件夹中
      if (actualTargetId === draggedFolderId) return;
      
      // 检查循环引用：不能将文件夹拖到自己的子文件夹中
      const checkCircularReference = (folderId: string, targetId: string): boolean => {
        const targetFolder = folders.find(f => f.id === targetId);
        if (!targetFolder) return false;
        if (targetFolder.parent_id === folderId) return true;
        if (targetFolder.parent_id) {
          return checkCircularReference(folderId, targetFolder.parent_id);
        }
        return false;
      };
      
      if (checkCircularReference(draggedFolderId, actualTargetId)) {
        toast({
          title: "移动失败",
          description: "不能将文件夹移动到自己的子文件夹中",
          variant: "destructive",
        });
        return;
      }
      
      // 执行移动（保留文件夹结构）
      const { error, data } = await supabase
        .from('folders')
        .update({ parent_id: actualTargetId })
        .eq('id', draggedFolderId)
        .select();
      
      if (!error && data && data.length > 0) {
        toast({
          title: "移动成功",
          description: "文件夹已移动",
          variant: "default",
        });
        // 刷新文件夹列表
        await fetchFolders();
        exitSelectionMode();
      } else {
        toast({
          title: "移动失败",
          description: error?.message || "移动文件夹时出错",
          variant: "destructive",
        });
      }
    }
  };

  // 可拖拽的文件夹卡片组件
  function DraggableFolderCard({ folder, isSelected, isSelectionMode, onClick, onTouchStart, onTouchEnd, onMouseDown, onMouseUp }: any) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: folder.id,
      data: folder,
    });
    const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 };
    
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        data-root-folder-card
        className={cn("relative aspect-square rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all select-none cursor-pointer group", isSelected ? "bg-accent border-blue-500 shadow-[0_0_0_1px_#3b82f6]" : "bg-card border-border hover:bg-accent/50 active:scale-95")}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onClick={onClick}
      >
        <Folder className={cn("w-10 h-10 transition-colors", isSelected ? "text-blue-500 fill-blue-500/20" : "text-yellow-500 fill-yellow-500/20")} />
        <span className="text-xs font-medium text-center truncate w-full px-2">{folder.name}</span>
        {isSelectionMode && (<div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-background border-2 border-muted-foreground flex items-center justify-center">{isSelected && <div className="w-full h-full bg-blue-500 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white"/></div>}</div>)}
      </div>
    );
  }

  // 可放置的文件夹卡片组件
  function DroppableFolderCard({ folder, isSelected, isSelectionMode, onClick, onTouchStart, onTouchEnd, onMouseDown, onMouseUp, activeId }: any) {
    const { setNodeRef, isOver } = useDroppable({
      id: `folder-${folder.id}`,
    });
    const isDraggingThis = activeId === folder.id;
    
    return (
      <div
        ref={setNodeRef}
        data-root-folder-card
        className={cn(
          "relative aspect-square rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all select-none cursor-pointer group",
          isOver && !isDraggingThis && "bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500",
          isSelected ? "bg-accent border-blue-500 shadow-[0_0_0_1px_#3b82f6]" : "bg-card border-border hover:bg-accent/50 active:scale-95"
        )}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onClick={onClick}
      >
        <Folder className={cn("w-10 h-10 transition-colors", isSelected ? "text-blue-500 fill-blue-500/20" : "text-yellow-500 fill-yellow-500/20")} />
        <span className="text-xs font-medium text-center truncate w-full px-2">{folder.name}</span>
        {isSelectionMode && (<div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-background border-2 border-muted-foreground flex items-center justify-center">{isSelected && <div className="w-full h-full bg-blue-500 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white"/></div>}</div>)}
      </div>
    );
  }

  const isDragging = activeId !== null;

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto mt-10 text-muted-foreground"/>;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="pb-32">
        <header className="flex items-center justify-between mb-6 py-4">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 truncate flex-1 min-w-0">
            <span className="truncate">我的文件夹</span>
            <span className="text-xs font-normal text-muted-foreground bg-accent px-2 py-1 rounded-full shrink-0 hidden sm:inline">{folders.length}</span>
          </h1>
          <div className="flex gap-2 shrink-0">
              {isSelectionMode ? (
                <>
                  <button onClick={exitSelectionMode} className="text-sm text-muted-foreground sm:inline hidden">取消</button>
                  <Button variant="ghost" size="icon" onClick={exitSelectionMode} className="sm:hidden">
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    className="sm:inline-flex hidden gap-1"
                    onClick={handleCreateFolder}
                  >
                    <Plus className="w-4 h-4" />
                    <span>新建</span>
                  </Button>
                  <Button
                    size="icon"
                    variant="default"
                    className="sm:hidden min-w-10 min-h-10"
                    onClick={handleCreateFolder}
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </>
              )}
          </div>
        </header>

        <div
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4"
          onClick={(e) => {
            if (!isSelectionMode) return;
            const target = e.target as HTMLElement;
            if (target.closest("[data-root-folder-card]")) return;
            exitSelectionMode();
          }}
        >
          {folders.map((folder) => {
            const isSelected = selectedIds.has(folder.id);
            const isActive = activeId === folder.id;
            // 如果正在拖拽这个文件夹，使用可拖拽组件；否则使用可放置组件
            if (isActive) {
              return (
                <DraggableFolderCard
                  key={folder.id}
                  folder={folder}
                  isSelected={isSelected}
                  isSelectionMode={isSelectionMode}
                  onClick={() => handleClick(folder)}
                  onTouchStart={() => handleTouchStart(folder.id)}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={() => handleTouchStart(folder.id)}
                  onMouseUp={handleTouchEnd}
                />
              );
            } else {
              return (
                <DroppableFolderCard
                  key={folder.id}
                  folder={folder}
                  isSelected={isSelected}
                  isSelectionMode={isSelectionMode}
                  onClick={() => handleClick(folder)}
                  onTouchStart={() => handleTouchStart(folder.id)}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={() => handleTouchStart(folder.id)}
                  onMouseUp={handleTouchEnd}
                  activeId={activeId}
                />
              );
            }
          })}
        </div>
        {/* 底部数量显示：移动端显示，桌面端隐藏（已在 header 显示） */}
        <div className="shrink-0 px-4 py-2 text-center border-t border-border/40 sm:hidden">
          <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full">{folders.length} 文件夹</span>
        </div>
      </div>

      <div className={cn("fixed left-0 right-0 flex justify-center z-50 transition-all duration-300", "bottom-[calc(2rem+env(safe-area-inset-bottom,0px)+var(--vv-bottom-inset,0px))]", isSelectionMode ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none")}>
        <div className="relative bg-background/90 backdrop-blur-md border border-border px-4 sm:px-8 py-3 rounded-2xl shadow-2xl flex items-center gap-4 sm:gap-8">
            <button onClick={(e) => { e.stopPropagation(); exitSelectionMode(); }} className="absolute -top-3 -right-3 w-6 h-6 bg-muted rounded-full flex items-center justify-center border border-border shadow-md"><X className="w-3 h-3" /></button>
            
            {/* 🔥 重命名按钮 (单选可用，多选变灰) */}
            <div className={cn("flex flex-col items-center gap-1 transition-all", selectedIds.size === 1 ? "cursor-pointer hover:scale-110" : "opacity-30 grayscale cursor-not-allowed")} onClick={handleRename}>
                <div className="p-2 bg-accent rounded-lg"><Pencil className="w-5 h-5" /></div>
                <span className="text-[10px]">重命名</span>
            </div>

            <div className="flex flex-col items-center gap-1 cursor-pointer hover:scale-110 transition-transform" onClick={handleMoveClick}>
                <div className="p-2 bg-accent rounded-lg"><FolderInput className="w-5 h-5" /></div>
                <span className="text-[10px]">移动</span>
            </div>
            
            <div className="flex flex-col items-center gap-1 cursor-pointer hover:scale-110 transition-transform" onClick={handleDelete}>
                <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-lg"><Trash2 className="w-5 h-5" /></div>
                <span className="text-[10px]">删除</span>
            </div>
        </div>
      </div>

      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>移动到...</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto py-4">
                {targetFolders.map(tf => (
                    <Button key={tf.id} variant="outline" className="justify-start h-auto py-3" onClick={() => handleMoveTargetClick(tf.id)}>
                        <Folder className="w-4 h-4 mr-2 text-yellow-500" />{tf.name}
                    </Button>
                ))}
            </div>
        </DialogContent>
      </Dialog>

      {/* 新建 / 重命名 文件夹弹窗 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editMode === "create" ? "新建文件夹" : "重命名文件夹"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              placeholder="输入文件夹名称"
              value={folderNameInput}
              onChange={(e) => setFolderNameInput(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleSaveFolder}
                disabled={!folderNameInput.trim()}
              >
                确定
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除文件夹</DialogTitle>
            <DialogDescription>
              删除这 {selectedIds.size} 个文件夹？里面的笔记也会消失！
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 移动确认对话框 */}
      <Dialog open={moveConfirmDialogOpen} onOpenChange={setMoveConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移动文件夹</DialogTitle>
            <DialogDescription>
              保留原文件夹结构吗？
              <br />
              <br />
              [确定] = 保留文件夹结构
              <br />
              [取消] = 不保留，只移动笔记
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                if (pendingMoveTargetId) {
                  executeMove(pendingMoveTargetId, false);
                }
              }}
            >
              不保留
            </Button>
            <Button
              onClick={() => {
                if (pendingMoveTargetId) {
                  executeMove(pendingMoveTargetId, true);
                }
              }}
            >
              保留
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DragOverlay>
        {activeId ? (
          <div className="w-32 h-32 bg-accent/90 backdrop-blur border border-blue-500 rounded-2xl shadow-2xl p-4 flex flex-col justify-center items-center rotate-3">
            <Folder className="w-10 h-10 text-blue-500 fill-blue-500/20 mb-2" />
            <span className="text-xs font-bold">移动中...</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}