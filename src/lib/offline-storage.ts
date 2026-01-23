"use client";

import localforage from "localforage";
import { supabase } from "./supabase";

// 配置 localforage
localforage.config({
  name: "SumuNote",
  storeName: "pending_sync",
  description: "SumuNote offline storage",
});

export interface PendingSyncNote {
  note_id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string;
  is_pinned: boolean;
  is_published: boolean;
  timestamp: number;
  operation: "update" | "create" | "delete";
}

/**
 * 检测网络状态
 */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine;
}

/**
 * 监听网络状态变化
 */
export function onNetworkStatusChange(
  callback: (isOnline: boolean) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

/**
 * 保存待同步的笔记到本地存储
 */
export async function savePendingSyncNote(
  note: Omit<PendingSyncNote, "timestamp">
): Promise<void> {
  const pendingNote: PendingSyncNote = {
    ...note,
    timestamp: Date.now(),
  };

  await localforage.setItem(`note:${note.note_id}`, pendingNote);
}

/**
 * 获取所有待同步的笔记
 */
export async function getPendingSyncNotes(): Promise<PendingSyncNote[]> {
  const keys = await localforage.keys();
  const noteKeys = keys.filter((key) => typeof key === "string" && key.startsWith("note:"));
  
  const notes: PendingSyncNote[] = [];
  for (const key of noteKeys) {
    const note = await localforage.getItem<PendingSyncNote>(key);
    if (note) {
      notes.push(note);
    }
  }

  return notes.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * 删除已同步的笔记
 */
export async function removePendingSyncNote(noteId: string): Promise<void> {
  await localforage.removeItem(`note:${noteId}`);
}

/**
 * 同步所有待同步的笔记到 Supabase
 */
export async function syncPendingNotes(): Promise<{
  success: number;
  failed: number;
}> {
  if (!isOnline()) {
    return { success: 0, failed: 0 };
  }

  const pendingNotes = await getPendingSyncNotes();
  let success = 0;
  let failed = 0;

  for (const note of pendingNotes) {
    try {
      if (note.operation === "update") {
        const { error } = await supabase
          .from("notes")
          .update({
            title: note.title,
            content: note.content,
            tags: note.tags,
            is_pinned: note.is_pinned,
            is_published: note.is_published,
            updated_at: new Date().toISOString(),
          })
          .eq("id", note.note_id)
          .eq("user_id", note.user_id);

        if (!error) {
          await removePendingSyncNote(note.note_id);
          success++;
        } else {
          console.error("Failed to sync note:", error);
          failed++;
        }
      } else if (note.operation === "create") {
        // 创建新笔记的逻辑（如果需要支持离线创建）
        // 这里暂时跳过，因为创建笔记需要文件夹ID等上下文
        failed++;
      } else if (note.operation === "delete") {
        // 删除笔记的逻辑
        const { error } = await supabase
          .from("notes")
          .delete()
          .eq("id", note.note_id)
          .eq("user_id", note.user_id);

        if (!error) {
          await removePendingSyncNote(note.note_id);
          success++;
        } else {
          console.error("Failed to sync delete:", error);
          failed++;
        }
      }
    } catch (error) {
      console.error("Error syncing note:", error);
      failed++;
    }
  }

  return { success, failed };
}































