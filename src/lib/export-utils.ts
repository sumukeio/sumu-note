import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "./supabase";
import { getNotesForUser } from "./note-service";

// 清理文件名中的非法字符
const sanitizeFileName = (name: string): string => {
  const trimmed = name.trim() || "untitled";
  return trimmed.replace(/[\/\\:*?"<>|]/g, "_");
};

// 简单转义 YAML 中的字符串
const escapeYaml = (value: string | null): string => {
  if (!value) return '""';
  const safe = value.replace(/"/g, '\\"');
  return `"${safe}"`;
};

interface ExportFolder {
  id: string;
  name: string;
}

export async function exportUserNotesToZip(userId: string): Promise<void> {
  if (!userId) {
    throw new Error("Missing userId for export");
  }

  const [foldersRes, notes] = await Promise.all([
    supabase.from("folders").select("id, name").eq("user_id", userId),
    getNotesForUser(userId),
  ]);

  if (foldersRes.error) {
    throw new Error(foldersRes.error.message || "Failed to fetch folders");
  }

  const folders = foldersRes.data || [];
  const zip = new JSZip();
  const folderMap = new Map<string, ExportFolder>();

  folders.forEach((folder) => {
    folderMap.set(folder.id, folder as ExportFolder);
  });

  notes.forEach((n) => {

    const folder = n.folder_id ? folderMap.get(n.folder_id) : null;
    const folderName = folder ? sanitizeFileName(folder.name) : "";
    const noteTitle = n.title ?? "未命名笔记";

    const fileName = sanitizeFileName(noteTitle) || `note-${n.id}`;
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


