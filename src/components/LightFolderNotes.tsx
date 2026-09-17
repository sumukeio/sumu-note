"use client";

/**
 * iPhone/iPod 轻量文件夹（issue002 task018/019）
 * 砍：SegmentedEditor / 表格 / 格式条 / 发布 / 拖拽 Dock / wiki·标签补全 / 字数
 * 留：笔记+子文件夹 创建/移动/删除、Dock 点击（高于调试条）、同步提示、版本历史、列表缓存
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  CheckSquare,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  History,
  Loader2,
  Pin,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import {
  createNote,
  deleteNotes,
  getNotes,
  moveNotesToFolder,
  setNotesDeleted,
  setNotesPinned,
  updateNote,
} from "@/lib/note-service";
import { deleteFoldersCascade } from "@/lib/folder-service";
import {
  createNoteVersion,
  getNoteVersions,
  type NoteVersion,
} from "@/lib/version-history";
import {
  cacheNotesList,
  getCachedNotesList,
} from "@/lib/offline-storage";
import { pushAuthDebug } from "@/lib/auth-login-handoff";
import { recordRecentNote } from "@/lib/recent-notes";
import {
  MoveToFolderDialog,
  MOVE_TARGET_ROOT,
} from "@/components/MoveToFolderDialog";
import type { Note, FolderItem } from "@/types/note";
import { cn } from "@/lib/utils";

type LightFolderNotesProps = {
  userId: string;
  folderId: string;
  folderName: string;
  onBack: () => void;
  onEnterFolder?: (folderId: string, folderName: string) => void;
  initialNoteId?: string | null;
  onInitialNoteOpened?: () => void;
};

function SelectionBar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-around gap-1 border rounded-lg bg-muted/40 px-1 py-1",
        className
      )}
      data-light-selection-bar
    >
      {children}
    </div>
  );
}

export default function LightFolderNotes({
  userId,
  folderId,
  folderName,
  onBack,
  onEnterFolder,
  initialNoteId,
  onInitialNoteOpened,
}: LightFolderNotesProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [subFolders, setSubFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(
    () => new Set()
  );
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargets, setMoveTargets] = useState<FolderItem[]>([]);
  const [lastMoveTargetId, setLastMoveTargetId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [cloudBanner, setCloudBanner] = useState(false);
  const [pendingCloud, setPendingCloud] = useState<Note | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState("");
  const [folderSaving, setFolderSaving] = useState(false);
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const ignoreClickRef = useRef(false);
  const lastLocalSaveAt = useRef(0);

  const isSelectionMode =
    selectedNoteIds.size > 0 || selectedFolderIds.size > 0;
  const selectionCount = selectedNoteIds.size + selectedFolderIds.size;

  const clearSelection = () => {
    setSelectedNoteIds(new Set());
    setSelectedFolderIds(new Set());
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    pushAuthDebug("light-folder:load-start", {
      folderId,
      folderName,
      showTrash,
    });
    try {
      const cached = await Promise.race([
        getCachedNotesList({ userId, folderId, showTrash }),
        new Promise<null>((resolve) => {
          window.setTimeout(() => resolve(null), 1_200);
        }),
      ]);
      if (cached && cached.length > 0) {
        setNotes(cached as Note[]);
        setLoading(false);
      }

      const noteRows = await Promise.race([
        getNotes(userId, {
          folder_id: folderId,
          is_deleted: showTrash,
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(
            () => reject(new Error("LIGHT_FOLDER_TIMEOUT")),
            10_000
          );
        }),
      ]);
      setNotes(noteRows);

      if (!showTrash) {
        const { data, error: folderErr } = await supabase
          .from("folders")
          .select("id, name, parent_id, user_id, created_at")
          .eq("user_id", userId)
          .eq("parent_id", folderId)
          .order("created_at", { ascending: false });
        if (folderErr) {
          pushAuthDebug("light-folder:subfolders-error", {
            msg: folderErr.message,
          });
        } else {
          setSubFolders((data || []) as FolderItem[]);
        }
      } else {
        setSubFolders([]);
      }

      void cacheNotesList({
        userId,
        folderId,
        showTrash,
        notes: noteRows as never[],
      }).catch(() => {});
      pushAuthDebug("light-folder:load-ok", {
        folderId,
        notes: noteRows.length,
        showTrash,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      pushAuthDebug("light-folder:load-error", { msg });
      setError(
        msg === "LIGHT_FOLDER_TIMEOUT" ? "加载超时，请重试" : msg || "加载失败"
      );
    } finally {
      setLoading(false);
    }
  }, [userId, folderId, folderName, showTrash]);

  useEffect(() => {
    pushAuthDebug("light-folder:mount", { folderId, folderName });
    clearSelection();
    setEditing(null);
    void load();
  }, [load, folderId, folderName]);

  useEffect(() => {
    if (!initialNoteId || loading || showTrash) return;
    const found = notes.find((n) => n.id === initialNoteId);
    if (found) {
      openNote(found);
      onInitialNoteOpened?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNoteId, loading, notes, showTrash]);

  useEffect(() => {
    if (!editing?.id) {
      setCloudBanner(false);
      setPendingCloud(null);
      return;
    }
    const noteId = editing.id;
    const channel = supabase
      .channel(`light-note:${noteId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notes",
          filter: `id=eq.${noteId}`,
        },
        (payload) => {
          if (Date.now() - lastLocalSaveAt.current < 8_000) return;
          const row = payload.new as Note;
          setPendingCloud(row);
          setCloudBanner(true);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [editing?.id]);

  const toggleNote = (id: string) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFolder = (id: string) => {
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startLongPressNote = (id: string) => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      ignoreClickRef.current = true;
      setSelectedNoteIds(new Set([id]));
      setSelectedFolderIds(new Set());
      longPressTimer.current = null;
    }, 450);
  };

  const startLongPressFolder = (id: string) => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      ignoreClickRef.current = true;
      setSelectedFolderIds(new Set([id]));
      setSelectedNoteIds(new Set());
      longPressTimer.current = null;
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const openNote = (note: Note) => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }
    if (isSelectionMode) {
      toggleNote(note.id);
      return;
    }
    setEditing(note);
    setTitle(note.title || "");
    setContent(note.content || "");
    setCloudBanner(false);
    setPendingCloud(null);
    recordRecentNote(userId, {
      noteId: note.id,
      title: note.title || "",
      folderId,
    });
  };

  const openSubFolder = (f: FolderItem) => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }
    if (isSelectionMode) {
      toggleFolder(f.id);
      return;
    }
    onEnterFolder?.(f.id, f.name || "未命名文件夹");
  };

  const handleCreateNote = async () => {
    if (creating || showTrash) return;
    setCreating(true);
    try {
      const note = await createNote({
        user_id: userId,
        folder_id: folderId,
        title: "",
        content: "",
      });
      setNotes((prev) => [note, ...prev]);
      openNote(note);
      toast({ title: "已新建笔记", variant: "success" });
    } catch (e) {
      toast({
        title: "新建失败",
        description: e instanceof Error ? e.message : "请重试",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFolder = async () => {
    const name = folderNameInput.trim();
    if (!name || folderSaving) return;
    setFolderSaving(true);
    try {
      const { data, error: err } = await supabase
        .from("folders")
        .insert({ user_id: userId, name, parent_id: folderId })
        .select("id, name, parent_id, user_id, created_at")
        .single();
      if (err) throw err;
      setSubFolders((prev) => [data as FolderItem, ...prev]);
      setFolderDialogOpen(false);
      setFolderNameInput("");
      toast({ title: "已创建文件夹", description: name, variant: "success" });
    } catch (e) {
      toast({
        title: "创建文件夹失败",
        description: e instanceof Error ? e.message : "请重试",
        variant: "destructive",
      });
    } finally {
      setFolderSaving(false);
    }
  };

  const handleSave = async () => {
    if (!editing || saving) return;
    setSaving(true);
    try {
      await createNoteVersion(editing.id, userId, title, content, []);
      const updated = await updateNote(editing.id, userId, { title, content });
      lastLocalSaveAt.current = Date.now();
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setEditing(updated);
      setCloudBanner(false);
      toast({
        title: "✅ 已保存",
        description: title.trim() || "未命名笔记",
        variant: "success",
      });
    } catch (e) {
      toast({
        title: "保存失败",
        description: e instanceof Error ? e.message : "请重试",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const applyCloud = () => {
    if (!pendingCloud) return;
    setEditing(pendingCloud);
    setTitle(pendingCloud.title || "");
    setContent(pendingCloud.content || "");
    setNotes((prev) =>
      prev.map((n) => (n.id === pendingCloud.id ? pendingCloud : n))
    );
    setCloudBanner(false);
    setPendingCloud(null);
    toast({ title: "已同步他端内容", variant: "success" });
  };

  const openHistory = async () => {
    if (!editing) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      setVersions((await getNoteVersions(editing.id)).slice(0, 30));
    } catch (e) {
      toast({
        title: "无法加载历史",
        description: e instanceof Error ? e.message : "请重试",
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const restoreVersion = (v: NoteVersion) => {
    setTitle(v.title || "");
    setContent(v.content || "");
    setHistoryOpen(false);
    toast({
      title: "已载入历史版本",
      description: "请确认后点保存写入当前笔记",
    });
  };

  const handlePin = async () => {
    const ids = [...selectedNoteIds];
    if (!ids.length) {
      toast({ title: "请先选中笔记再置顶" });
      return;
    }
    const allPinned = ids.every(
      (id) => notes.find((n) => n.id === id)?.is_pinned
    );
    const next = !allPinned;
    try {
      await setNotesPinned(ids, userId, next);
      setNotes((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, is_pinned: next } : n))
      );
      clearSelection();
      toast({ title: next ? "已置顶" : "已取消置顶", variant: "success" });
    } catch (e) {
      toast({
        title: "置顶失败",
        description: e instanceof Error ? e.message : "请重试",
        variant: "destructive",
      });
    }
  };

  const handleTrashOrRestoreNotes = async () => {
    const ids = [...selectedNoteIds];
    if (!ids.length) return;
    try {
      await setNotesDeleted(ids, userId, !showTrash);
      setNotes((prev) => prev.filter((n) => !ids.includes(n.id)));
      setSelectedNoteIds(new Set());
      toast({
        title: showTrash ? "已恢复笔记" : "笔记已移入回收站",
        variant: "success",
      });
    } catch (e) {
      toast({
        title: "操作失败",
        description: e instanceof Error ? e.message : "请重试",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFolders = async () => {
    const ids = [...selectedFolderIds];
    if (!ids.length) return;
    try {
      const result = await deleteFoldersCascade(userId, ids);
      setSubFolders((prev) => prev.filter((f) => !ids.includes(f.id)));
      setSelectedFolderIds(new Set());
      setDeleteFolderOpen(false);
      toast({
        title: "已删除文件夹",
        description: `${result.deletedFolderIds.length} 个文件夹；${result.softDeletedNoteIds.length} 条笔记进回收站`,
        variant: "success",
      });
    } catch (e) {
      toast({
        title: "删除文件夹失败",
        description: e instanceof Error ? e.message : "请重试",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSelection = async () => {
    if (selectedFolderIds.size > 0 && selectedNoteIds.size > 0) {
      // 先删笔记再删文件夹
      await handleTrashOrRestoreNotes();
      setDeleteFolderOpen(true);
      return;
    }
    if (selectedFolderIds.size > 0) {
      setDeleteFolderOpen(true);
      return;
    }
    await handleTrashOrRestoreNotes();
  };

  const handlePurge = async () => {
    const ids = [...selectedNoteIds];
    if (!ids.length) return;
    try {
      await deleteNotes(ids, userId);
      setNotes((prev) => prev.filter((n) => !ids.includes(n.id)));
      clearSelection();
      setPurgeOpen(false);
      toast({ title: "已永久删除", variant: "success" });
    } catch (e) {
      toast({
        title: "删除失败",
        description: e instanceof Error ? e.message : "请重试",
        variant: "destructive",
      });
    }
  };

  const openMove = async () => {
    if (selectedNoteIds.size === 0 && selectedFolderIds.size === 0) return;
    const { data, error: err } = await supabase
      .from("folders")
      .select("id, name, parent_id, user_id, created_at")
      .eq("user_id", userId)
      .order("name");
    if (err) {
      toast({
        title: "无法加载文件夹",
        description: err.message,
        variant: "destructive",
      });
      return;
    }
    const blocked = new Set(selectedFolderIds);
    setMoveTargets(
      ((data || []) as FolderItem[]).filter(
        (f) => f.id !== folderId && !blocked.has(f.id)
      )
    );
    setMoveOpen(true);
  };

  const confirmMove = async (targetFolderId: string | null) => {
    setMoving(true);
    try {
      const noteIds = [...selectedNoteIds];
      const folderIds = [...selectedFolderIds];
      if (noteIds.length) {
        await moveNotesToFolder(noteIds, userId, targetFolderId);
        setNotes((prev) => prev.filter((n) => !noteIds.includes(n.id)));
      }
      if (folderIds.length) {
        const { error: err } = await supabase
          .from("folders")
          .update({ parent_id: targetFolderId })
          .in("id", folderIds)
          .eq("user_id", userId);
        if (err) throw err;
        setSubFolders((prev) => prev.filter((f) => !folderIds.includes(f.id)));
      }
      setLastMoveTargetId(
        targetFolderId === null ? MOVE_TARGET_ROOT : targetFolderId
      );
      clearSelection();
      setMoveOpen(false);
      toast({ title: "已移动", variant: "success" });
    } catch (e) {
      toast({
        title: "移动失败",
        description: e instanceof Error ? e.message : "请重试",
        variant: "destructive",
      });
    } finally {
      setMoving(false);
    }
  };

  const trashSingleFromEditor = async () => {
    if (!editing) return;
    try {
      await setNotesDeleted([editing.id], userId, true);
      setNotes((prev) => prev.filter((n) => n.id !== editing.id));
      setEditing(null);
      toast({ title: "已移入回收站", variant: "success" });
    } catch (e) {
      toast({
        title: "操作失败",
        description: e instanceof Error ? e.message : "请重试",
        variant: "destructive",
      });
    }
  };

  const renderSelectionActions = (compact?: boolean) => (
    <>
      {!showTrash && selectedNoteIds.size > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            compact && "flex-col h-auto py-1 gap-0.5",
            "min-h-10"
          )}
          onClick={() => void handlePin()}
        >
          <Pin className="w-4 h-4" />
          {!compact ? <span className="ml-1">置顶</span> : (
            <span className="text-[10px]">置顶</span>
          )}
        </Button>
      ) : null}
      {!showTrash ? (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            compact && "flex-col h-auto py-1 gap-0.5",
            "min-h-10"
          )}
          onClick={() => void openMove()}
        >
          <FolderInput className="w-4 h-4" />
          {!compact ? <span className="ml-1">移动</span> : (
            <span className="text-[10px]">移动</span>
          )}
        </Button>
      ) : null}
      {showTrash ? (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            compact && "flex-col h-auto py-1 gap-0.5",
            "min-h-10"
          )}
          onClick={() => void handleTrashOrRestoreNotes()}
          disabled={selectedNoteIds.size === 0}
        >
          <RotateCcw className="w-4 h-4" />
          {!compact ? <span className="ml-1">恢复</span> : (
            <span className="text-[10px]">恢复</span>
          )}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            compact && "flex-col h-auto py-1 gap-0.5",
            "min-h-10"
          )}
          onClick={() => void handleDeleteSelection()}
        >
          <Trash2 className="w-4 h-4" />
          {!compact ? (
            <span className="ml-1">
              {selectedFolderIds.size > 0 && selectedNoteIds.size === 0
                ? "删除"
                : selectedFolderIds.size > 0
                  ? "删除"
                  : "回收站"}
            </span>
          ) : (
            <span className="text-[10px]">
              {selectedFolderIds.size > 0 ? "删除" : "回收站"}
            </span>
          )}
        </Button>
      )}
      {showTrash ? (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            compact && "flex-col h-auto py-1 gap-0.5 text-destructive",
            "min-h-10 text-destructive"
          )}
          onClick={() => setPurgeOpen(true)}
          disabled={selectedNoteIds.size === 0}
        >
          <Trash2 className="w-4 h-4" />
          {!compact ? <span className="ml-1">永久删</span> : (
            <span className="text-[10px]">永久删</span>
          )}
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className={cn(compact && "flex-col h-auto py-1 gap-0.5", "min-h-10")}
        onClick={clearSelection}
      >
        <X className="w-4 h-4" />
        {!compact ? <span className="ml-1">取消</span> : (
          <span className="text-[10px]">取消</span>
        )}
      </Button>
    </>
  );

  if (editing) {
    return (
      <div className="flex flex-col gap-3 pb-24">
        {cloudBanner ? (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs flex items-center justify-between gap-2">
            <span>检测到他端已更新此笔记</span>
            <Button size="sm" variant="outline" onClick={applyCloud}>
              刷新为云端
            </Button>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditing(null)}
            aria-label="返回列表"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="标题"
            className="flex-1"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => void openHistory()}
            aria-label="版本历史"
          >
            <History className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => void trashSingleFromEditor()}
            aria-label="移入回收站"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="ml-1">保存</span>
          </Button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="开始书写…"
          className="min-h-[50vh] w-full rounded-md border border-border bg-background p-3 text-sm leading-relaxed resize-y"
        />
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>版本历史</DialogTitle>
              <DialogDescription>
                选择一版载入到编辑区，再手动保存
              </DialogDescription>
            </DialogHeader>
            {historyLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">暂无历史版本</p>
            ) : (
              <ul className="max-h-64 overflow-auto space-y-1">
                {versions.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      className="w-full text-left rounded border px-3 py-2 text-sm hover:bg-muted/50"
                      onClick={() => restoreVersion(v)}
                    >
                      <div className="font-medium truncate">
                        {v.title?.trim() || "未命名"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleString()}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-32">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={onBack}
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="flex-1 font-semibold truncate min-w-[4rem]">
          {folderName}
        </h2>
        <Button
          size="sm"
          variant={showTrash ? "default" : "outline"}
          onClick={() => {
            setShowTrash((v) => !v);
            clearSelection();
          }}
        >
          {showTrash ? "笔记" : "回收站"}
        </Button>
        {!showTrash ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setFolderNameInput("");
                setFolderDialogOpen(true);
              }}
              disabled={loading}
              title="新建文件夹"
            >
              <FolderPlus className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => void handleCreateNote()}
              disabled={creating || loading}
              title="新建笔记"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </>
        ) : null}
        {!isSelectionMode && !showTrash ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // 进入空多选态：提示用户点选
              if (notes[0]) setSelectedNoteIds(new Set([notes[0].id]));
              else if (subFolders[0])
                setSelectedFolderIds(new Set([subFolders[0].id]));
              else
                toast({
                  title: "暂无内容可多选",
                  description: "先新建笔记或文件夹",
                });
            }}
            title="多选"
          >
            <CheckSquare className="w-4 h-4" />
          </Button>
        ) : null}
      </div>

      {/* 顶栏操作条：不被底部调试绿条挡住 */}
      {isSelectionMode ? (
        <SelectionBar>
          <span className="text-xs text-muted-foreground px-2 shrink-0">
            已选 {selectionCount}
          </span>
          {renderSelectionActions(false)}
        </SelectionBar>
      ) : (
        <p className="text-[11px] text-muted-foreground px-0.5">
          长按笔记/文件夹进入多选；或点右上角多选图标
        </p>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">正在加载…</p>
          <Button variant="outline" size="sm" onClick={onBack}>
            返回
          </Button>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-16 px-4">
          <p className="text-sm text-muted-foreground text-center">{error}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}>
              返回
            </Button>
            <Button onClick={() => void load()}>重试</Button>
          </div>
        </div>
      ) : (
        <>
          {!showTrash && subFolders.length > 0 ? (
            <section>
              <p className="text-xs text-muted-foreground mb-2">子文件夹</p>
              <ul className="space-y-1">
                {subFolders.map((f) => {
                  const selected = selectedFolderIds.has(f.id);
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        className={cn(
                          "w-full flex items-center gap-3 rounded-lg border px-3 py-3 text-left touch-manipulation",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50 active:bg-muted"
                        )}
                        onClick={() => openSubFolder(f)}
                        onTouchStart={() => startLongPressFolder(f.id)}
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          toggleFolder(f.id);
                        }}
                      >
                        {isSelectionMode ? (
                          <span
                            className={cn(
                              "w-5 h-5 rounded border flex items-center justify-center shrink-0",
                              selected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-muted-foreground"
                            )}
                          >
                            {selected ? <Check className="w-3 h-3" /> : null}
                          </span>
                        ) : (
                          <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate text-sm">
                          {f.name || "未命名文件夹"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section>
            <p className="text-xs text-muted-foreground mb-2">
              {showTrash ? "回收站" : "笔记"}（{notes.length}）
            </p>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {showTrash ? "回收站为空" : "还没有笔记"}
              </p>
            ) : (
              <ul className="space-y-1">
                {notes.map((n) => {
                  const selected = selectedNoteIds.has(n.id);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={cn(
                          "w-full flex items-start gap-3 rounded-lg border px-3 py-3 text-left touch-manipulation",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50 active:bg-muted"
                        )}
                        onClick={() => openNote(n)}
                        onTouchStart={() => startLongPressNote(n.id)}
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          toggleNote(n.id);
                        }}
                      >
                        {isSelectionMode ? (
                          <span
                            className={cn(
                              "mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0",
                              selected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-muted-foreground"
                            )}
                          >
                            {selected ? <Check className="w-3 h-3" /> : null}
                          </span>
                        ) : (
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate flex items-center gap-1">
                            {n.is_pinned ? (
                              <Pin className="w-3 h-3 text-amber-500 shrink-0" />
                            ) : null}
                            {n.title?.trim() || "未命名笔记"}
                          </div>
                          {n.content ? (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {n.content}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {/* 底栏 Dock：z 高于调试条，避免被挡住 */}
      {isSelectionMode ? (
        <div
          className="fixed bottom-0 left-0 right-0 z-[10050] border-t-2 border-primary/40 bg-background px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around gap-1 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]"
          data-light-dock
        >
          {renderSelectionActions(true)}
        </div>
      ) : null}

      <MoveToFolderDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        targets={moveTargets}
        lastMoveTargetId={lastMoveTargetId}
        busy={moving}
        onSelect={(id) => void confirmMove(id)}
      />

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
            <DialogDescription>在「{folderName}」下创建子文件夹</DialogDescription>
          </DialogHeader>
          <Input
            value={folderNameInput}
            onChange={(e) => setFolderNameInput(e.target.value)}
            placeholder="文件夹名称"
            autoFocus
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setFolderDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleCreateFolder()}
              disabled={!folderNameInput.trim() || folderSaving}
            >
              {folderSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "创建"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteFolderOpen} onOpenChange={setDeleteFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除文件夹</DialogTitle>
            <DialogDescription>
              将删除选中的 {selectedFolderIds.size}{" "}
              个文件夹及其子树；其中的笔记会进入回收站。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteFolderOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteFolders()}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>永久删除</DialogTitle>
            <DialogDescription>
              选中的笔记将无法恢复，确认继续吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPurgeOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => void handlePurge()}>
              永久删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
