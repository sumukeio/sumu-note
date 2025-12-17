import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "./supabase";

// 清理文件名中的非法字符
const sanitizeFileName = (name: string): string => {
  const trimmed = name.trim() || "untitled";
  return trimmed.replace(/[\/\\:*?"<>|]/g, "_");
};

// 简单转义 YAML 中的字符串
const escapeYaml = (value: string | null): string => {
  if (!value) return '""';
  // 用双引号包裹并转义内部的双引号
  const safe = value.replace(/"/g, '\\"');
  return `"${safe}"`;
};

interface ExportNote {
  id: string;
  title: string | null;
  content: string | null;
  folder_id: string | null;
  // 有的项目没有 created_at，只保留 updated_at；这里仅依赖 updated_at，避免列不存在错误
  updated_at: string | null;
}

interface ExportFolder {
  id: string;
  name: string;
}

export async function exportUserNotesToZip(userId: string): Promise<void> {
  if (!userId) {
    throw new Error("Missing userId for export");
  }

  // 1. 拉取当前用户所有文件夹和笔记
  const [{ data: folders, error: folderError }, { data: notes, error: notesError }] =
    await Promise.all([
      supabase
        .from("folders")
        .select("id, name")
        .eq("user_id", userId),
      supabase
        .from("notes")
        .select("id, title, content, folder_id, updated_at")
        .eq("user_id", userId),
    ]);

  if (folderError) {
    throw new Error(folderError.message || "Failed to fetch folders");
  }
  if (notesError) {
    throw new Error(notesError.message || "Failed to fetch notes");
  }

  const zip = new JSZip();
  const folderMap = new Map<string, ExportFolder>();

  (folders || []).forEach((folder) => {
    folderMap.set(folder.id, folder as ExportFolder);
  });

  (notes || []).forEach((note) => {
    const n = note as ExportNote;

    const folder = n.folder_id ? folderMap.get(n.folder_id) : null;
    const folderName = folder ? sanitizeFileName(folder.name) : "";
    const noteTitle = n.title || "未命名笔记";

    const fileName = sanitizeFileName(noteTitle || "") || `note-${n.id}`;
    const filePath = folderName ? `${folderName}/${fileName}.md` : `${fileName}.md`;

    const updated = n.updated_at || "";
    const folderLabel = folder?.name || "";

    const yamlFrontMatter =
      "---\n" +
      `title: ${escapeYaml(noteTitle)}\n` +
      `updated: ${escapeYaml(updated)}\n` +
      `folder: ${escapeYaml(folderLabel)}\n` +
      "---\n\n";

    const body = (n.content || "").replace(/\r\n/g, "\n");

    zip.file(filePath, yamlFrontMatter + body, {
      date: updated ? new Date(updated) : undefined,
    });
  });

  // 3. 生成 zip 并触发下载
  const blob = await zip.generateAsync({ type: "blob" });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const zipName = `sumu-note-backup-${timestamp}.zip`;
  saveAs(blob, zipName);
}


