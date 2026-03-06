/**
 * 从 Markdown 正文中解析标题，用于目录/大纲（Task 7.5.3）
 */

export interface OutlineItem {
  level: number; // 1 | 2 | 3
  text: string;
  id: string;
}

/** 将标题文本转为可作 id 的 slug */
export function slugify(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .toLowerCase() || "heading";
}

/** 解析 content 中的 # ## ### 标题行，返回有序列表 */
export function extractOutline(content: string): OutlineItem[] {
  if (!content) return [];
  const lines = content.split("\n");
  const result: OutlineItem[] = [];
  const seen = new Map<string, number>();

  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].trim();
    if (!text) continue;
    let baseId = slugify(text);
    let id = baseId;
    let n = seen.get(baseId) ?? 0;
    seen.set(baseId, n + 1);
    if (n > 0) id = `${baseId}-${n}`;
    result.push({ level, text, id });
  }
  return result;
}
