"use client";

import { supabase } from "./supabase";

export interface NoteVersion {
  id: string;
  note_id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  tags: string | null;
  created_at: string;
}

/**
 * 获取笔记的所有版本历史
 */
export async function getNoteVersions(noteId: string): Promise<NoteVersion[]> {
  const { data, error } = await supabase
    .from("note_versions")
    .select("*")
    .eq("note_id", noteId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch note versions:", error);
    throw new Error(error.message || "获取版本历史失败");
  }

  return (data || []) as NoteVersion[];
}

/**
 * 创建笔记版本（在保存笔记时调用）
 */
export async function createNoteVersion(
  noteId: string,
  userId: string,
  title: string,
  content: string,
  tags: string[]
): Promise<void> {
  const { error } = await supabase.from("note_versions").insert({
    note_id: noteId,
    user_id: userId,
    title,
    content,
    tags: tags.join(","),
  });

  if (error) {
    console.error("Failed to create note version:", error);
    // 不抛出错误，版本历史创建失败不应影响笔记保存
  }
}

/**
 * 删除笔记的所有版本历史
 */
export async function deleteNoteVersions(noteId: string): Promise<void> {
  const { error } = await supabase
    .from("note_versions")
    .delete()
    .eq("note_id", noteId);

  if (error) {
    console.error("Failed to delete note versions:", error);
    throw new Error(error.message || "删除版本历史失败");
  }
}










