"use client";

import { supabase } from "./supabase";

export interface RecentNoteEntry {
  noteId: string;
  folderId: string | null;
  title: string;
  lastOpenedAt: number;
}

export const MAX_RECENTS = 20;

function storageKey(userId: string) {
  return `sumunote:recent-notes:${userId}`;
}

/** 规范化并按最近打开时间排序截断（纯函数，可测） */
export function normalizeRecentEntries(
  raw: unknown,
  max = MAX_RECENTS
): RecentNoteEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === "object")
    .map((x: Record<string, unknown>) => ({
      noteId: String(x.noteId ?? ""),
      folderId: x.folderId == null || x.folderId === "" ? null : String(x.folderId),
      title: String(x.title ?? ""),
      lastOpenedAt: Number(x.lastOpenedAt ?? 0),
    }))
    .filter((x) => x.noteId && Number.isFinite(x.lastOpenedAt) && x.lastOpenedAt > 0)
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
    .slice(0, max);
}

/** 合并两端列表：同 noteId 取较新 lastOpenedAt（纯函数） */
export function mergeRecentEntries(
  a: RecentNoteEntry[],
  b: RecentNoteEntry[],
  max = MAX_RECENTS
): RecentNoteEntry[] {
  const map = new Map<string, RecentNoteEntry>();
  for (const e of [...a, ...b]) {
    const prev = map.get(e.noteId);
    if (!prev || e.lastOpenedAt >= prev.lastOpenedAt) {
      map.set(e.noteId, e);
    }
  }
  return [...map.values()]
    .sort((x, y) => y.lastOpenedAt - x.lastOpenedAt)
    .slice(0, max);
}

/** 将一条记录插到最前（纯函数） */
export function upsertRecentEntry(
  list: RecentNoteEntry[],
  entry: Omit<RecentNoteEntry, "lastOpenedAt"> & { lastOpenedAt?: number },
  max = MAX_RECENTS
): RecentNoteEntry[] {
  const now = entry.lastOpenedAt ?? Date.now();
  const next: RecentNoteEntry = {
    noteId: entry.noteId,
    folderId: entry.folderId ?? null,
    title: entry.title ?? "",
    lastOpenedAt: now,
  };
  return normalizeRecentEntries(
    [next, ...list.filter((x) => x.noteId !== next.noteId)],
    max
  );
}

export function getLocalRecentNotes(userId: string): RecentNoteEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    return normalizeRecentEntries(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function setLocalRecentNotes(
  userId: string,
  entries: RecentNoteEntry[]
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify(normalizeRecentEntries(entries))
    );
  } catch {
    // ignore
  }
}

/** @deprecated 使用 getLocalRecentNotes；保留别名避免旧引用断裂 */
export function getRecentNotes(userId: string): RecentNoteEntry[] {
  return getLocalRecentNotes(userId);
}

async function fetchCloudRecentNotes(
  userId: string
): Promise<RecentNoteEntry[] | null> {
  const { data, error } = await supabase
    .from("user_recent_notes")
    .select("entries")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // 表未部署时静默降级本地
    const msg = error.message || "";
    if (
      error.code === "42P01" ||
      msg.includes("Could not find the table") ||
      msg.includes("does not exist")
    ) {
      return null;
    }
    console.warn("[recent-notes] cloud fetch failed:", msg);
    return null;
  }
  if (!data) return [];
  return normalizeRecentEntries((data as { entries?: unknown }).entries);
}

async function saveCloudRecentNotes(
  userId: string,
  entries: RecentNoteEntry[]
): Promise<boolean> {
  const { error } = await supabase.from("user_recent_notes").upsert(
    {
      user_id: userId,
      entries: normalizeRecentEntries(entries),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.warn("[recent-notes] cloud save failed:", error.message);
    return false;
  }
  return true;
}

/**
 * 拉取云端并与本地合并，写回两端。云表未就绪时仅用本地。
 */
export async function syncRecentNotes(
  userId: string
): Promise<RecentNoteEntry[]> {
  const local = getLocalRecentNotes(userId);
  const cloud = await fetchCloudRecentNotes(userId);
  if (cloud === null) {
    return local;
  }
  const merged = mergeRecentEntries(local, cloud);
  setLocalRecentNotes(userId, merged);
  // 若合并结果与云端不同，回写云端
  const cloudSig = JSON.stringify(cloud);
  const mergedSig = JSON.stringify(merged);
  if (cloudSig !== mergedSig) {
    await saveCloudRecentNotes(userId, merged);
  }
  return merged;
}

/**
 * 记录最近打开：先写本地（即时），再异步同步云端。
 */
export function recordRecentNote(
  userId: string,
  entry: Omit<RecentNoteEntry, "lastOpenedAt"> & { lastOpenedAt?: number }
): void {
  if (!userId || !entry.noteId) return;
  const next = upsertRecentEntry(getLocalRecentNotes(userId), entry);
  setLocalRecentNotes(userId, next);
  void saveCloudRecentNotes(userId, next);
}

export function removeRecentNote(userId: string, noteId: string): void {
  const next = getLocalRecentNotes(userId).filter((x) => x.noteId !== noteId);
  setLocalRecentNotes(userId, next);
  void saveCloudRecentNotes(userId, next);
}
