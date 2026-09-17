"use client";

import { supabase } from "./supabase";
import type { FolderItem } from "@/types/note";
import { resolveFolderIdsForDelete } from "./folder-utils";
import { setNotesDeleted } from "./note-service";

export class FolderServiceError extends Error {
  operation: string;
  constructor(operation: string, message: string, cause?: unknown) {
    super(message);
    this.name = "FolderServiceError";
    this.operation = operation;
    try {
      (this as Error & { cause?: unknown }).cause = cause;
    } catch {
      // ignore
    }
  }
}

export interface DeleteFoldersCascadeResult {
  /** 叶子优先的已删文件夹 id */
  deletedFolderIds: string[];
  /** 随文件夹一并软删的笔记 id */
  softDeletedNoteIds: string[];
  /** 删除前快照，供撤销还原 */
  deletedFolderRows: FolderItem[];
}

/**
 * 删除选中文件夹及其全部后代（叶子优先）。
 * 默认将其中未删笔记移入回收站。修复 issue010：`folders_parent_id_fkey`。
 */
export async function deleteFoldersCascade(
  userId: string,
  selectedFolderIds: string[],
  options?: { softDeleteNotes?: boolean }
): Promise<DeleteFoldersCascadeResult> {
  const softDeleteNotes = options?.softDeleteNotes !== false;
  const selected = [...new Set(selectedFolderIds.filter(Boolean))];
  if (selected.length === 0) {
    return {
      deletedFolderIds: [],
      softDeletedNoteIds: [],
      deletedFolderRows: [],
    };
  }

  const { data: allFolders, error: listError } = await supabase
    .from("folders")
    .select("id, name, parent_id, user_id, created_at")
    .eq("user_id", userId);

  if (listError) {
    throw new FolderServiceError(
      "deleteFoldersCascade",
      listError.message || "获取文件夹列表失败",
      listError
    );
  }

  const folders = (allFolders ?? []) as FolderItem[];
  const orderedIds = resolveFolderIdsForDelete(folders, selected);
  if (orderedIds.length === 0) {
    return {
      deletedFolderIds: [],
      softDeletedNoteIds: [],
      deletedFolderRows: [],
    };
  }

  const idSet = new Set(orderedIds);
  const deletedFolderRows = folders.filter((f) => idSet.has(f.id));

  let softDeletedNoteIds: string[] = [];
  if (softDeleteNotes) {
    const { data: notesInFolders, error: notesQueryError } = await supabase
      .from("notes")
      .select("id, is_deleted")
      .eq("user_id", userId)
      .in("folder_id", orderedIds);

    if (notesQueryError) {
      throw new FolderServiceError(
        "deleteFoldersCascade",
        notesQueryError.message || "查询文件夹内笔记失败",
        notesQueryError
      );
    }

    softDeletedNoteIds = (notesInFolders ?? [])
      .filter((n) => n.is_deleted !== true)
      .map((n) => String(n.id));

    if (softDeletedNoteIds.length > 0) {
      await setNotesDeleted(softDeletedNoteIds, userId, true);
    }
  }

  // 按当前叶子层批量删除，满足 parent_id 自引用外键
  const remaining = new Set(orderedIds);
  while (remaining.size > 0) {
    const leaves = [...remaining]
      .filter(
        (id) => !folders.some((f) => f.parent_id === id && remaining.has(f.id))
      )
      .sort();
    const batch = leaves.length > 0 ? leaves : [[...remaining][0]!];

    const { error: delError } = await supabase
      .from("folders")
      .delete()
      .in("id", batch)
      .eq("user_id", userId);

    if (delError) {
      throw new FolderServiceError(
        "deleteFoldersCascade",
        delError.message || "删除文件夹时出错",
        delError
      );
    }
    for (const id of batch) remaining.delete(id);
  }

  return {
    deletedFolderIds: orderedIds,
    softDeletedNoteIds,
    deletedFolderRows,
  };
}
