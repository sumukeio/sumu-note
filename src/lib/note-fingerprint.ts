/**
 * 笔记内容指纹，用于 Realtime 自更新过滤（区分“自己保存”与“他人/他端更新”）
 */
export function buildNoteFingerprint(data: {
  title?: string | null;
  content?: string | null;
  tags?: string | null;
  is_pinned?: boolean | null;
  is_published?: boolean | null;
}): string {
  const t = (data.title ?? "").trim();
  const c = data.content ?? "";
  const tagsStr = (data.tags ?? "").trim();
  const pinned = data.is_pinned ? "1" : "0";
  const published = data.is_published ? "1" : "0";
  return `${t}\n<<<TAGS>>>\n${tagsStr}\n<<<FLAGS>>>\n${pinned}${published}\n<<<CONTENT>>>\n${c}`;
}
