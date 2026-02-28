"use client";

import { supabase } from "./supabase";
import type { Note, NoteCreate, NoteUpdate } from "@/types/note";

export type { Note, NoteCreate, NoteUpdate } from "@/types/note";

export class NoteServiceError extends Error {
  operation: string;
  constructor(operation: string, message: string, cause?: unknown) {
    // ErrorOptions.cause 在现代运行时可用；这里保持兼容为主
    super(message);
    this.name = "NoteServiceError";
    this.operation = operation;
    try {
      (this as any).cause = cause;
    } catch {
      // ignore
    }
  }
}

function throwNoteServiceError(operation: string, error: unknown, fallbackMessage: string): never {
  const msg =
    (error as { message?: string } | null | undefined)?.message?.trim() ||
    fallbackMessage;
  throw new NoteServiceError(operation, msg, error);
}

export interface GetNotesOptions {
  folder_id: string;
  is_deleted?: boolean; // true=仅回收站, false=仅非删除, 不传=不过滤
}

/**
 * 获取指定文件夹下的笔记列表（支持回收站筛选）
 */
export async function getNotes(
  userId: string,
  options: GetNotesOptions
): Promise<Note[]> {
  let query = supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .eq("folder_id", options.folder_id)
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (options.is_deleted === true) {
    query = query.eq("is_deleted", true);
  } else if (options.is_deleted === false) {
    query = query.or("is_deleted.eq.false,is_deleted.is.null");
  }

  const { data, error } = await query;
  if (error) throwNoteServiceError("getNotes", error, "获取笔记列表失败");
  return (data || []) as Note[];
}

/**
 * 获取当前用户所有笔记（不按文件夹过滤，仅非删除）- 用于统计、导出等
 */
export async function getNotesForUser(userId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .or("is_deleted.eq.false,is_deleted.is.null")
    .order("updated_at", { ascending: false });

  if (error) throwNoteServiceError("getNotesForUser", error, "获取笔记失败");
  return (data || []) as Note[];
}

/**
 * 按 id 获取单条笔记（需属于该用户）
 */
export async function getNoteById(
  id: string,
  userId: string
): Promise<Note | null> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throwNoteServiceError("getNoteById", error, "获取笔记失败");
  return data as Note | null;
}

/**
 * 按 id 在指定文件夹下获取单条笔记（用于 initialNoteId 打开编辑）
 */
export async function getNoteByIdInFolder(
  id: string,
  userId: string,
  folderId: string
): Promise<Note | null> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("folder_id", folderId)
    .maybeSingle();

  if (error) throwNoteServiceError("getNoteByIdInFolder", error, "获取笔记失败");
  return data as Note | null;
}

/**
 * 按 id 或 title 获取单条笔记（公开页用：先 id 再 title，不校验 user_id）
 */
export async function getNoteByIdOrTitle(
  idOrTitle: string,
  userId?: string
): Promise<Note | null> {
  const { data: byId, error: errById } = await supabase
    .from("notes")
    .select("*")
    .eq("id", idOrTitle)
    .maybeSingle();

  if (!errById && byId) {
    if (userId && (byId as Note).user_id !== userId) return null;
    return byId as Note;
  }

  const { data: byTitle, error: errByTitle } = await supabase
    .from("notes")
    .select("*")
    .ilike("title", idOrTitle)
    .limit(1);

  if (errByTitle || !byTitle?.length) return null;
  const note = byTitle[0] as Note;
  if (userId && note.user_id !== userId) return null;
  return note;
}

/**
 * 获取笔记的 folder_id（用于 dashboard 根据 noteId 解析文件夹）
 */
export async function getNoteFolderId(
  noteId: string,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("notes")
    .select("folder_id")
    .eq("id", noteId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return (data as { folder_id: string | null }).folder_id;
}

/**
 * 全局搜索笔记（title / content / tags 模糊匹配）
 */
export async function searchNotes(
  userId: string,
  query: string
): Promise<Pick<Note, "id" | "title" | "content" | "folder_id" | "updated_at" | "tags">[]> {
  if (!query.trim()) return [];
  const q = `%${query.trim()}%`;
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, content, folder_id, updated_at, tags")
    .eq("user_id", userId)
    .or(`title.ilike.${q},content.ilike.${q},tags.ilike.${q}`);

  if (error) throwNoteServiceError("searchNotes", error, "搜索失败");
  return (data || []) as Pick<Note, "id" | "title" | "content" | "folder_id" | "updated_at" | "tags">[];
}

/**
 * 查询引用某笔记的笔记（反链：content 中包含 [[id]] 或 [[title]]）
 */
export async function getBacklinks(
  excludeNoteId: string,
  idPattern: string,
  titlePattern: string | null
): Promise<Pick<Note, "id" | "title" | "content" | "updated_at">[]> {
  let q = supabase
    .from("notes")
    .select("id, title, content, updated_at")
    .neq("id", excludeNoteId);

  if (titlePattern) {
    q = q.or(`content.ilike.${idPattern},content.ilike.${titlePattern}`);
  } else {
    q = q.ilike("content", idPattern);
  }

  const { data, error } = await q;
  if (error) throwNoteServiceError("getBacklinks", error, "获取反链失败");
  return (data || []) as Pick<Note, "id" | "title" | "content" | "updated_at">[];
}

/**
 * 创建笔记
 */
export async function createNote(data: NoteCreate): Promise<Note> {
  const { data: row, error } = await supabase
    .from("notes")
    .insert({
      user_id: data.user_id,
      folder_id: data.folder_id ?? null,
      title: data.title ?? "",
      content: data.content ?? "",
      tags: data.tags ?? null,
      is_pinned: data.is_pinned ?? false,
      is_published: data.is_published ?? false,
    })
    .select()
    .single();

  if (error) throwNoteServiceError("createNote", error, "创建笔记失败");
  return row as Note;
}

/**
 * 更新笔记（部分字段）
 */
export async function updateNote(
  id: string,
  userId: string,
  data: NoteUpdate
): Promise<Note> {
  const payload: Record<string, unknown> = { ...data };
  if (payload.updated_at === undefined) {
    payload.updated_at = new Date().toISOString();
  }

  const { data: row, error } = await supabase
    .from("notes")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throwNoteServiceError("updateNote", error, "更新笔记失败");
  return row as Note;
}

/**
 * 硬删除笔记（物理删除）
 */
export async function deleteNote(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throwNoteServiceError("deleteNote", error, "删除笔记失败");
}

/**
 * 批量硬删除笔记
 */
export async function deleteNotes(ids: string[], userId: string): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("notes")
    .delete()
    .in("id", ids)
    .eq("user_id", userId);

  if (error) throwNoteServiceError("deleteNotes", error, "删除笔记失败");
}

/**
 * 批量软删除/恢复
 */
export async function setNotesDeleted(
  ids: string[],
  userId: string,
  is_deleted: boolean
): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("notes")
    .update({ is_deleted })
    .in("id", ids)
    .eq("user_id", userId);

  if (error) throwNoteServiceError("setNotesDeleted", error, "操作失败");
}

/**
 * 批量置顶/取消置顶
 */
export async function setNotesPinned(
  ids: string[],
  userId: string,
  is_pinned: boolean
): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("notes")
    .update({ is_pinned })
    .in("id", ids)
    .eq("user_id", userId);

  if (error) throwNoteServiceError("setNotesPinned", error, "操作失败");
}

/**
 * 移动单条笔记到某文件夹
 */
export async function moveNoteToFolder(
  id: string,
  userId: string,
  folder_id: string | null
): Promise<void> {
  const { error } = await supabase
    .from("notes")
    .update({ folder_id })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throwNoteServiceError("moveNoteToFolder", error, "移动失败");
}

/**
 * 批量移动笔记到某文件夹
 */
export async function moveNotesToFolder(
  ids: string[],
  userId: string,
  targetFolderId: string
): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("notes")
    .update({ folder_id: targetFolderId })
    .in("id", ids)
    .eq("user_id", userId);

  if (error) throwNoteServiceError("moveNotesToFolder", error, "移动失败");
}

/**
 * 批量更新笔记的 folder_id（用于文件夹移动时，将原文件夹下笔记移到目标文件夹）
 */
export async function updateNotesFolder(
  folderIds: string[],
  targetFolderId: string,
  userId: string
): Promise<void> {
  if (!folderIds.length) return;
  const { error } = await supabase
    .from("notes")
    .update({ folder_id: targetFolderId })
    .in("folder_id", folderIds)
    .eq("user_id", userId);

  if (error) throwNoteServiceError("updateNotesFolder", error, "移动笔记失败");
}
