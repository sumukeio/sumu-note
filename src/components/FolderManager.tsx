"use client";

import { useState, useRef, useEffect } from "react";
import { Folder, Trash2, FolderInput, X, Check, Loader2, Plus, Pencil } from "lucide-react"; // 🔥 引入 Pencil
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";

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

  const fetchFolders = async () => {
    const { data } = await supabase.from('folders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
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
  const handleTouchStart = (id: string) => { if (isSelectionMode) return; ignoreClickRef.current = false; timerRef.current = setTimeout(() => { const newSet = new Set(selectedIds); newSet.add(id); setSelectedIds(newSet); if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50); ignoreClickRef.current = true; }, 500); };
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
        const { error: notesError } = await supabase.from('notes').update({ folder_id: targetFolderId }).in('folder_id', idsToMove);
        if (notesError) {
          toast({
            title: "移动失败",
            description: notesError.message || "移动笔记时出错",
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

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto mt-10 text-muted-foreground"/>;

  return (
    <div className="pb-32" onClick={(e) => { if (e.target === e.currentTarget && isSelectionMode) exitSelectionMode(); }}>
      <header className="flex items-center justify-between mb-6 py-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">我的文件夹 <span className="text-xs font-normal text-muted-foreground bg-accent px-2 py-1 rounded-full">{folders.length}</span></h1>
        <div className="flex gap-2">
            {isSelectionMode ? <button onClick={exitSelectionMode} className="text-sm text-muted-foreground">取消</button> : <Button size="sm" onClick={handleCreateFolder} variant="outline"><Plus className="w-4 h-4 mr-1"/> 新建</Button>}
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {folders.map((folder) => {
          const isSelected = selectedIds.has(folder.id);
          return (
            <div key={folder.id} className={cn("relative aspect-square rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all select-none cursor-pointer group", isSelected ? "bg-accent border-blue-500 shadow-[0_0_0_1px_#3b82f6]" : "bg-card border-border hover:bg-accent/50 active:scale-95")} onTouchStart={() => handleTouchStart(folder.id)} onTouchEnd={handleTouchEnd} onMouseDown={() => handleTouchStart(folder.id)} onMouseUp={handleTouchEnd} onClick={() => handleClick(folder)}>
                <Folder className={cn("w-10 h-10 transition-colors", isSelected ? "text-blue-500 fill-blue-500/20" : "text-yellow-500 fill-yellow-500/20")} />
                <span className="text-xs font-medium text-center truncate w-full px-2">{folder.name}</span>
                {isSelectionMode && (<div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-background border-2 border-muted-foreground flex items-center justify-center">{isSelected && <div className="w-full h-full bg-blue-500 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white"/></div>}</div>)}
            </div>
          );
        })}
      </div>

      <div className={cn("fixed left-0 right-0 flex justify-center z-50 transition-all duration-300", "bottom-[calc(2rem+env(safe-area-inset-bottom,0px))]", isSelectionMode ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none")}>
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
    </div>
  );
}