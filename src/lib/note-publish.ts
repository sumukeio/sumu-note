import type { Note } from "@/types/note";

/** 是否满足公开页可读条件（issue005） */
export function isNotePubliclyReadable(
  note:
    | Pick<Note, "is_published" | "is_deleted">
    | null
    | undefined
): boolean {
  if (!note) return false;
  if (note.is_published !== true) return false;
  if (note.is_deleted === true) return false;
  return true;
}
