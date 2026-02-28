"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { getNotesForUser } from "@/lib/note-service";
import type { Note } from "@/types/note";
import { cn } from "@/lib/utils";
import JSZip from "jszip";
import { saveAs } from "file-saver";

interface Folder {
  id: string;
  name: string;
  notes: Note[];
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function ExportDialog({ isOpen, onClose, userId }: ExportDialogProps) {
  const { toast } = useToast();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [uncategorizedNotes, setUncategorizedNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  // 状态管理
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());

  // 加载数据
  useEffect(() => {
    if (isOpen && userId) {
      // 重置状态
      setSelectedNotes(new Set());
      setExpandedFolders(new Set());
      loadData();
    }
  }, [isOpen, userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 获取所有文件夹
      const foldersResult = await supabase
        .from("folders")
        .select("id, name")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (foldersResult.error) {
        console.error("Folders error:", foldersResult.error);
        throw new Error(foldersResult.error.message || "获取文件夹失败");
      }

      const foldersData = foldersResult.data || [];
      const notesData = await getNotesForUser(userId);

      console.log("Loaded data:", {
        foldersCount: foldersData.length,
        notesCount: notesData.length
      });

      // 按文件夹分组笔记
      const folderMap = new Map<string, Note[]>();
      const uncategorized: Note[] = [];

      notesData.forEach((note) => {
        if (note.folder_id) {
          if (!folderMap.has(note.folder_id)) {
            folderMap.set(note.folder_id, []);
          }
          folderMap.get(note.folder_id)!.push(note);
        } else {
          uncategorized.push(note);
        }
      });

      // 构建文件夹列表
      const foldersWithNotes: Folder[] = foldersData.map((folder) => ({
        ...folder,
        notes: folderMap.get(folder.id) || [],
      }));

      setFolders(foldersWithNotes);
      setUncategorizedNotes(uncategorized);

      // 默认折叠所有文件夹
      setExpandedFolders(new Set());
    } catch (error: any) {
      console.error("Failed to load data:", error);
      
      // 详细错误信息
      let errorMessage = "未知错误";
      if (error) {
        if (typeof error === "string") {
          errorMessage = error;
        } else if (error.message) {
          errorMessage = error.message;
        } else if (error.details) {
          errorMessage = error.details;
        } else if (error.hint) {
          errorMessage = error.hint;
        } else {
          // 尝试序列化错误对象
          try {
            errorMessage = JSON.stringify(error);
          } catch {
            errorMessage = String(error);
          }
        }
      }
      
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        error: error,
        errorString: String(error),
        errorType: typeof error
      });
      
      // 显示错误提示
      toast({
        title: "加载失败",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 切换文件夹展开/折叠
  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // 获取文件夹下所有笔记ID
  const getFolderNoteIds = (folder: Folder): string[] => {
    return folder.notes.map((note) => note.id);
  };

  // 获取文件夹复选框状态
  const getFolderCheckboxState = (folder: Folder): "checked" | "indeterminate" | "unchecked" => {
    const folderNoteIds = getFolderNoteIds(folder);
    if (folderNoteIds.length === 0) return "unchecked";
    
    const selectedCount = folderNoteIds.filter((id) => selectedNotes.has(id)).length;
    if (selectedCount === 0) return "unchecked";
    if (selectedCount === folderNoteIds.length) return "checked";
    return "indeterminate";
  };

  // 切换文件夹选择（选中/取消选中该文件夹下的所有笔记）
  const toggleFolderSelection = (folder: Folder) => {
    const folderNoteIds = getFolderNoteIds(folder);
    if (folderNoteIds.length === 0) return;

    const allSelected = folderNoteIds.every((id) => selectedNotes.has(id));
    
    setSelectedNotes((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        // 取消选中
        folderNoteIds.forEach((id) => next.delete(id));
      } else {
        // 选中所有
        folderNoteIds.forEach((id) => next.add(id));
      }
      return next;
    });

    // 如果文件夹折叠，展开它
    if (!expandedFolders.has(folder.id)) {
      setExpandedFolders((prev) => new Set(prev).add(folder.id));
    }
  };

  // 切换笔记选择
  const toggleNoteSelection = (noteId: string) => {
    setSelectedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    const allNoteIds = new Set<string>();
    folders.forEach((folder) => {
      folder.notes.forEach((note) => allNoteIds.add(note.id));
    });
    uncategorizedNotes.forEach((note) => allNoteIds.add(note.id));

    const allSelected = Array.from(allNoteIds).every((id) => selectedNotes.has(id));

    if (allSelected) {
      setSelectedNotes(new Set());
    } else {
      setSelectedNotes(allNoteIds);
    }
  };

  // 检查是否全选
  const isAllSelected = () => {
    const allNoteIds = new Set<string>();
    folders.forEach((folder) => {
      folder.notes.forEach((note) => allNoteIds.add(note.id));
    });
    uncategorizedNotes.forEach((note) => allNoteIds.add(note.id));

    if (allNoteIds.size === 0) return false;
    return Array.from(allNoteIds).every((id) => selectedNotes.has(id));
  };

  // 清理文件名
  const sanitizeFileName = (name: string): string => {
    const trimmed = name.trim() || "未命名";
    return trimmed.replace(/[\/\\:*?"<>|]/g, "_");
  };

  // 导出功能
  const handleExport = async () => {
    if (selectedNotes.size === 0) return;

    setExporting(true);
    try {
      const zip = new JSZip();
      const folderMap = new Map<string, Folder>();

      // 创建文件夹映射
      folders.forEach((folder) => {
        folderMap.set(folder.id, folder);
      });

      // 按文件夹分组选中的笔记
      const notesByFolder = new Map<string, Note[]>();
      const uncategorizedSelected: Note[] = [];

      // 处理文件夹中的笔记
      folders.forEach((folder) => {
        const selectedInFolder = folder.notes.filter((note) => selectedNotes.has(note.id));
        if (selectedInFolder.length > 0) {
          notesByFolder.set(folder.id, selectedInFolder);
        }
      });

      // 处理未分类笔记
      uncategorizedNotes.forEach((note) => {
        if (selectedNotes.has(note.id)) {
          uncategorizedSelected.push(note);
        }
      });

      // 添加文件夹中的笔记到压缩包
      notesByFolder.forEach((notes, folderId) => {
        const folder = folderMap.get(folderId);
        if (!folder) return;

        const folderName = sanitizeFileName(folder.name);
        notes.forEach((note) => {
          const fileName = sanitizeFileName(note.title || "未命名笔记") + ".md";
          const filePath = `${folderName}/${fileName}`;
          zip.file(filePath, note.content || "");
        });
      });

      // 添加未分类笔记到压缩包根目录
      uncategorizedSelected.forEach((note) => {
        const fileName = sanitizeFileName(note.title || "未命名笔记") + ".md";
        zip.file(fileName, note.content || "");
      });

      // 生成并下载
      const blob = await zip.generateAsync({ type: "blob" });
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const zipName = `notes_export_${timestamp}.zip`;
      saveAs(blob, zipName);

      // 显示成功提示
      toast({
        title: "导出成功",
        description: `成功导出 ${selectedNotes.size} 个笔记！`,
        variant: "success",
      });
      onClose();
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "导出失败",
        description: "导出失败，请重试",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const selectedCount = selectedNotes.size;
  const allSelected = isAllSelected();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>导出笔记</DialogTitle>
          <DialogDescription>选择要导出的笔记和文件夹</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* 全选 */}
            <div className="flex items-center gap-2 p-3 border-b sticky top-0 bg-background z-10">
              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && selectedCount > 0}
                onChange={toggleSelectAll}
                id="select-all"
              />
              <label
                htmlFor="select-all"
                className="text-sm font-medium cursor-pointer flex-1"
              >
                全选
              </label>
              <span className="text-sm text-muted-foreground">
                {selectedCount} 个笔记
              </span>
            </div>

            {/* 文件夹和笔记列表 */}
            <div className="py-2">
              {/* 文件夹 */}
              {folders.map((folder) => {
                const isExpanded = expandedFolders.has(folder.id);
                const folderState = getFolderCheckboxState(folder);
                const hasNotes = folder.notes.length > 0;

                return (
                  <div key={folder.id} className="select-none">
                    {/* 文件夹行 */}
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 hover:bg-accent/50 cursor-pointer",
                        hasNotes && "border-b"
                      )}
                    >
                      {/* 展开/折叠图标 */}
                      <button
                        onClick={() => toggleFolder(folder.id)}
                        className="p-1 hover:bg-accent rounded"
                        disabled={!hasNotes}
                      >
                        {hasNotes ? (
                          isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )
                        ) : (
                          <div className="w-4 h-4" />
                        )}
                      </button>

                      {/* 文件夹复选框 */}
                      <Checkbox
                        checked={folderState === "checked"}
                        indeterminate={folderState === "indeterminate"}
                        onChange={() => toggleFolderSelection(folder)}
                        id={`folder-${folder.id}`}
                      />

                      {/* 文件夹名称 */}
                      <label
                        htmlFor={`folder-${folder.id}`}
                        className="flex-1 cursor-pointer font-medium"
                      >
                        {folder.name}
                      </label>

                      <span className="text-xs text-muted-foreground">
                        {folder.notes.length} 个笔记
                      </span>
                    </div>

                    {/* 文件夹下的笔记 */}
                    {isExpanded && hasNotes && (
                      <div className="pl-8">
                        {folder.notes.map((note) => (
                          <div
                            key={note.id}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-accent/30 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedNotes.has(note.id)}
                              onChange={() => toggleNoteSelection(note.id)}
                              id={`note-${note.id}`}
                            />
                            <label
                              htmlFor={`note-${note.id}`}
                              className="flex-1 cursor-pointer text-sm"
                            >
                              {note.title || "未命名笔记"}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 未分类笔记 */}
              {uncategorizedNotes.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
                    未分类笔记
                  </div>
                  {uncategorizedNotes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-accent/30 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedNotes.has(note.id)}
                        onChange={() => toggleNoteSelection(note.id)}
                        id={`note-${note.id}`}
                      />
                      <label
                        htmlFor={`note-${note.id}`}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        {note.title || "未命名笔记"}
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {/* 空状态 */}
              {folders.length === 0 && uncategorizedNotes.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  暂无笔记
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={exporting}>
            取消
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedCount === 0 || exporting || loading}
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                导出中...
              </>
            ) : (
              `导出 (${selectedCount} 个笔记)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
