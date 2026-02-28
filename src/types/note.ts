/**
 * 笔记领域统一类型（与 notes 表字段对齐）
 * 全项目引用此文件，避免多处重复定义与 any
 */

export interface Note {
  id: string;
  user_id: string;
  folder_id: string | null;
  title: string | null;
  content: string | null;
  tags: string | null;
  is_pinned: boolean | null;
  is_published: boolean | null;
  is_deleted: boolean | null;
  created_at?: string | null;
  updated_at: string | null;
}

/** 创建笔记时入参（插入 notes 表） */
export interface NoteCreate {
  user_id: string;
  folder_id: string | null;
  title?: string | null;
  content?: string | null;
  tags?: string | null;
  is_pinned?: boolean | null;
  is_published?: boolean | null;
}

/** 更新笔记时可更新字段 */
export interface NoteUpdate {
  title?: string | null;
  content?: string | null;
  tags?: string | null;
  is_pinned?: boolean | null;
  is_published?: boolean | null;
  is_deleted?: boolean | null;
  folder_id?: string | null;
  updated_at?: string | null;
}

/** 文件夹项（列表/移动等用，与 folders 表字段对齐） */
export interface FolderItem {
  id: string;
  name: string | null;
  created_at?: string | null;
  parent_id?: string | null;
  user_id?: string | null;
}
