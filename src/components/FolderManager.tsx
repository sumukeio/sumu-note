"use client";

import { useState, useRef, useEffect } from "react";
import { Folder, Trash2, FolderInput, X, Check, Loader2, Plus, MoreHorizontal } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

interface FolderManagerProps {
  userId: string;
  onEnterFolder: (folderId: string, folderName: string) => void; // 进入文件夹的回调
}

export default function FolderManager({ userId, onEnterFolder }: FolderManagerProps) {
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // 移动文件夹相关的状态
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [targetFolders, setTargetFolders] = useState<any[]>([]); // 可移动到的目标文件夹列表

  const isSelectionMode = selectedIds.size > 0;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const ignoreClickRef = useRef(false);

  // 1. 加载文件夹
  const fetchFolders = async () => {
    const { data } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (data) setFolders(data);
    setLoading(false);
  };

  useEffect(() => { if (userId) fetchFolders(); }, [userId]);

  // 2. 新建文件夹
  const handleCreateFolder = async () => {
    const name = prompt("新建文件夹名称：");
    if (!name) return;
    const { error } = await supabase.from('folders').insert({ user_id: userId, name });
    if (!error) fetchFolders();
  };

  // 交互逻辑 (长按/点击)
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleTouchStart = (id: string) => {
    if (isSelectionMode) return;
    ignoreClickRef.current = false;
    timerRef.current = setTimeout(() => {
      const newSet = new Set(selectedIds);
      newSet.add(id);
      setSelectedIds(newSet);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
      ignoreClickRef.current = true;
    }, 500);
  };
  const handleTouchEnd = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  const handleClick = (folder: any) => {
    if (ignoreClickRef.current) { ignoreClickRef.current = false; return; }
    if (isSelectionMode) {
      toggleSelection(folder.id);
    } else {
      // 🔥 点击进入文件夹
      onEnterFolder(folder.id, folder.name);
    }
  };

  const exitSelectionMode = () => setSelectedIds(new Set());

  // --- Dock 操作 ---
  
  // 删除文件夹 (连带删除下面的笔记 - 级联删除在数据库层面设置了 cascade 最好，如果没有，这里只是演示)
  const handleDelete = async () => {
    if (confirm(`删除这 ${selectedIds.size} 个文件夹？里面的笔记也会消失！`)) {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from('folders').delete().in('id', ids);
      if (!error) {
        setFolders(prev => prev.filter(f => !selectedIds.has(f.id)));
        exitSelectionMode();
      }
    }
  };

  // 准备移动
  const handleMoveClick = () => {
    // 过滤出除了自己以外的文件夹作为目标
    const targets = folders.filter(f => !selectedIds.has(f.id));
    setTargetFolders(targets);
    setIsMoveDialogOpen(true);
  };

  // 执行移动 (核心逻辑)
  const executeMove = async (targetFolderId: string, keepOriginal: boolean) => {
    const idsToMove = Array.from(selectedIds);
    
    if (keepOriginal) {
        // 方案 A：套娃 (保留原文件夹，成为子文件夹)
        // update folders set parent_id = targetFolderId where id in selectedIds
        const { error } = await supabase
            .from('folders')
            .update({ parent_id: targetFolderId })
            .in('id', idsToMove);
        if (error) alert("移动失败");
    } else {
        // 方案 B：合并 (只把笔记移过去，删除原文件夹)
        // 1. 把选中文件夹下的所有笔记，folder_id 改为 targetFolderId
        const { error: noteError } = await supabase
            .from('notes')
            .update({ folder_id: targetFolderId })
            .in('folder_id', idsToMove);
            
        if (noteError) {
            alert("移动笔记失败");
            return;
        }

        // 2. 删除原文件夹
        await supabase.from('folders').delete().in('id', idsToMove);
    }

    // 刷新并关闭
    fetchFolders();
    setIsMoveDialogOpen(false);
    exitSelectionMode();
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto mt-10 text-muted-foreground"/>;

  return (
    <div className="pb-32" onClick={(e) => { if (e.target === e.currentTarget && isSelectionMode) exitSelectionMode(); }}>
      
      {/* 顶部 */}
      <header className="flex items-center justify-between mb-6 py-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
            我的文件夹 
            <span className="text-xs font-normal text-muted-foreground bg-accent px-2 py-1 rounded-full">{folders.length}</span>
        </h1>
        <div className="flex gap-2">
            {isSelectionMode ? (
                <button onClick={exitSelectionMode} className="text-sm text-muted-foreground">取消</button>
            ) : (
                <Button size="sm" onClick={handleCreateFolder} variant="outline"><Plus className="w-4 h-4 mr-1"/> 新建</Button>
            )}
        </div>
      </header>

      {/* 文件夹网格 */}
      <div className="grid grid-cols-3 gap-4">
        {folders.map((folder) => {
          const isSelected = selectedIds.has(folder.id);
          return (
            <div key={folder.id}
                className={cn(
                    "relative aspect-square rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all select-none cursor-pointer group",
                    isSelected ? "bg-accent border-blue-500 shadow-[0_0_0_1px_#3b82f6]" : "bg-card border-border hover:bg-accent/50 active:scale-95"
                )}
                onTouchStart={() => handleTouchStart(folder.id)} onTouchEnd={handleTouchEnd}
                onMouseDown={() => handleTouchStart(folder.id)} onMouseUp={handleTouchEnd}
                onClick={() => handleClick(folder)}
            >
                {/* 文件夹图标 */}
                <Folder className={cn("w-10 h-10 transition-colors", isSelected ? "text-blue-500 fill-blue-500/20" : "text-yellow-500 fill-yellow-500/20")} />
                
                <span className="text-xs font-medium text-center truncate w-full px-2">{folder.name}</span>
                
                {isSelectionMode && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-background border-2 border-muted-foreground flex items-center justify-center">
                        {isSelected && <div className="w-full h-full bg-blue-500 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white"/></div>}
                    </div>
                )}
            </div>
          );
        })}
      </div>

      {/* Dock */}
      <div className={cn("fixed left-0 right-0 bottom-8 flex justify-center z-50 transition-all duration-300", isSelectionMode ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none")}>
        <div className="relative bg-background/90 backdrop-blur-md border border-border px-8 py-3 rounded-2xl shadow-2xl flex items-center gap-8">
            <button onClick={(e) => { e.stopPropagation(); exitSelectionMode(); }} className="absolute -top-3 -right-3 w-6 h-6 bg-muted rounded-full flex items-center justify-center border border-border shadow-md"><X className="w-3 h-3" /></button>
            
            {/* 移动按钮 */}
            <div className="flex flex-col items-center gap-1 cursor-pointer hover:scale-110 transition-transform" onClick={handleMoveClick}>
                <div className="p-2 bg-accent rounded-lg"><FolderInput className="w-5 h-5" /></div>
                <span className="text-[10px]">移动</span>
            </div>
            
            {/* 删除按钮 */}
            <div className="flex flex-col items-center gap-1 cursor-pointer hover:scale-110 transition-transform" onClick={handleDelete}>
                <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-lg"><Trash2 className="w-5 h-5" /></div>
                <span className="text-[10px]">删除</span>
            </div>
        </div>
      </div>

      {/* 移动选择弹窗 (简易版) */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>移动到...</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto py-4">
                {targetFolders.length === 0 && <p className="text-center text-muted-foreground col-span-2">没有其他文件夹可移动</p>}
                {targetFolders.map(tf => (
                    <Button key={tf.id} variant="outline" className="justify-start h-auto py-3" onClick={() => {
                        // 选中目标后，弹出二次确认
                        if (confirm(`保留原文件夹结构吗？\n\n[确定] = 保留 (变成子文件夹)\n[取消] = 不保留 (只合并文件)`)) {
                            executeMove(tf.id, true);
                        } else {
                            executeMove(tf.id, false);
                        }
                    }}>
                        <Folder className="w-4 h-4 mr-2 text-yellow-500" />
                        {tf.name}
                    </Button>
                ))}
            </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}