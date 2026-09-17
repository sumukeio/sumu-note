"use client";

/**
 * iOS 轻量文件夹笔记视图（issue002 task017）
 * 不加载 NoteManager 大包（该包在 iPhone 上 dynamic import 会永久挂起）。
 */

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  FileText,
  Folder,
  Loader2,
  Plus,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { createNote, getNotes, updateNote } from "@/lib/note-service";
import { pushAuthDebug } from "@/lib/auth-login-handoff";
import { recordRecentNote } from "@/lib/recent-notes";
import type { Note, FolderItem } from "@/types/note";

type LightFolderNotesProps = {
  userId: string;
  folderId: string;
  folderName: string;
  onBack: () => void;
  onEnterFolder?: (folderId: string, folderName: string) => void;
  initialNoteId?: string | null;
  onInitialNoteOpened?: () => void;
};

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
  const [editing, setEditing] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    pushAuthDebug("light-folder:load-start", { folderId, folderName });
    try {
      const notesPromise = getNotes(userId, {
        folder_id: folderId,
        is_deleted: false,
      });
      const foldersPromise = supabase
        .from("folders")
        .select("id, name, parent_id, user_id, created_at")
        .eq("user_id", userId)
        .eq("parent_id", folderId)
        .order("created_at", { ascending: false });

      const timed = Promise.race([
        Promise.all([notesPromise, foldersPromise]),
        new Promise<never>((_, reject) => {
          window.setTimeout(
            () => reject(new Error("LIGHT_FOLDER_TIMEOUT")),
            10_000
          );
        }),
      ]);

      const [noteRows, folderRes] = await timed;
      setNotes(noteRows);
      if (folderRes.error) {
        pushAuthDebug("light-folder:subfolders-error", {
          msg: folderRes.error.message,
        });
      } else {
        setSubFolders((folderRes.data || []) as FolderItem[]);
      }
      pushAuthDebug("light-folder:load-ok", {
        folderId,
        notes: noteRows.length,
        subFolders: folderRes.data?.length ?? 0,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      pushAuthDebug("light-folder:load-error", { msg });
      setError(
        msg === "LIGHT_FOLDER_TIMEOUT"
          ? "加载超时，请重试"
          : msg || "加载失败"
      );
    } finally {
      setLoading(false);
    }
  }, [userId, folderId, folderName]);

  useEffect(() => {
    pushAuthDebug("light-folder:mount", { folderId, folderName });
    void load();
  }, [load, folderId, folderName]);

  useEffect(() => {
    if (!initialNoteId || loading || notes.length === 0) return;
    const found = notes.find((n) => n.id === initialNoteId);
    if (found) {
      openNote(found);
      onInitialNoteOpened?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNoteId, loading, notes]);

  const openNote = (note: Note) => {
    pushAuthDebug("light-folder:open-note", { noteId: note.id });
    setEditing(note);
    setTitle(note.title || "");
    setContent(note.content || "");
    void recordRecentNote(userId, {
      noteId: note.id,
      title: note.title || "",
      folderId,
    });
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    pushAuthDebug("light-folder:create-start", { folderId });
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

  const handleSave = async () => {
    if (!editing || saving) return;
    setSaving(true);
    try {
      const updated = await updateNote(editing.id, userId, {
        title,
        content,
      });
      setNotes((prev) =>
        prev.map((n) => (n.id === updated.id ? updated : n))
      );
      setEditing(updated);
      toast({
        title: "✅ 已保存",
        description: title.trim() || "未命名笔记",
        variant: "success",
      });
      pushAuthDebug("light-folder:save-ok", { noteId: updated.id });
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

  if (editing) {
    return (
      <div className="flex flex-col gap-3 pb-24">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
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
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving}
          >
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-24">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={onBack}
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="flex-1 font-semibold truncate">{folderName}</h2>
        <Button
          size="sm"
          onClick={() => void handleCreate()}
          disabled={creating || loading}
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          <span className="ml-1">新建</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">正在加载笔记…</p>
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
          {subFolders.length > 0 ? (
            <section>
              <p className="text-xs text-muted-foreground mb-2">子文件夹</p>
              <ul className="space-y-1">
                {subFolders.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-left hover:bg-muted/50 active:bg-muted touch-manipulation"
                      onClick={() =>
                        onEnterFolder?.(f.id, f.name || "未命名文件夹")
                      }
                    >
                      <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate text-sm">{f.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <p className="text-xs text-muted-foreground mb-2">
              笔记（{notes.length}）
            </p>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                还没有笔记，点右上角新建
              </p>
            ) : (
              <ul className="space-y-1">
                {notes.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className="w-full flex items-start gap-3 rounded-lg border border-border px-3 py-3 text-left hover:bg-muted/50 active:bg-muted touch-manipulation"
                      onClick={() => openNote(n)}
                    >
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
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
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
