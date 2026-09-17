/** 空标题保存时，从正文首行自动生成标题的字数上限（issue004 / ADR） */
export const AUTO_TITLE_MAX_LENGTH = 10;

/**
 * 从笔记正文推导自动标题：取首行，去掉常见 Markdown 标记，截断至上限。
 * 仅用于「标题为空」时的兜底，不覆盖用户已填标题。
 */
export function deriveAutoTitleFromContent(
  content: string,
  maxLength: number = AUTO_TITLE_MAX_LENGTH
): string {
  const firstLine = content.split("\n")[0] ?? "";
  const cleaned = firstLine.replace(/[#*`]/g, "").trim();
  if (!cleaned) return "";
  const limit = Math.max(0, maxLength);
  return cleaned.slice(0, limit);
}
