"use client";

import { useState, useRef, useEffect } from "react";
import { Folder, Trash2, FolderInput, X, Check, Loader2, Plus, Pencil } from "lucide-react"; // 🔥 引入 Pencil
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

interface FolderManagerProps {
  userId: string;
  onEnterFolder: (folderId: string, folderName: string) => void;
}

export default function FolderManager({ userId, onEnterFolder }: FolderManagerProps) {
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [targetFolders, setTargetFolders] = useState<any[]>([]); 
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState<"create" | "rename">("create");
  const [editingFolder, setEditingFolder] = useState<any | null>(null);
  const [folderNameInput, setFolderNameInput] = useState("");

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

  const handleDelete = async () => {
    if (confirm(`删除这 ${selectedIds.size} 个文件夹？里面的笔记也会消失！`)) {
      const { error } = await supabase.from('folders').delete().in('id', Array.from(selectedIds));
      if (!error) { setFolders(prev => prev.filter(f => !selectedIds.has(f.id))); exitSelectionMode(); }
    }
  };

  const handleMoveClick = () => {
    const targets = folders.filter(f => !selectedIds.has(f.id));
    setTargetFolders(targets);
    setIsMoveDialogOpen(true);
  };

  const executeMove = async (targetFolderId: string, keepOriginal: boolean) => {
    const idsToMove = Array.from(selectedIds);
    if (keepOriginal) {
        await supabase.from('folders').update({ parent_id: targetFolderId }).in('id', idsToMove);
    } else {
        await supabase.from('notes').update({ folder_id: targetFolderId }).in('folder_id', idsToMove);
        await supabase.from('folders').delete().in('id', idsToMove);
    }
    fetchFolders();
    setIsMoveDialogOpen(false);
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
      } else {
        alert("重命名失败");
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

      <div className="grid grid-cols-3 gap-4">
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

      <div className={cn("fixed left-0 right-0 bottom-8 flex justify-center z-50 transition-all duration-300", isSelectionMode ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none")}>
        <div className="relative bg-background/90 backdrop-blur-md border border-border px-8 py-3 rounded-2xl shadow-2xl flex items-center gap-8">
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
            <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto py-4">
                {targetFolders.map(tf => (
                    <Button key={tf.id} variant="outline" className="justify-start h-auto py-3" onClick={() => { if (confirm(`保留原文件夹结构吗？\n\n[确定] = 保留\n[取消] = 不保留`)) executeMove(tf.id, true); else executeMove(tf.id, false); }}>
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
    </div>
  );
}