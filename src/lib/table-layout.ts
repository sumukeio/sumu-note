/**
 * 表格布局（列宽等）相关工具
 * - table_key：基于表格 Markdown 文本生成稳定 key，用于跨预览/编辑匹配元数据
 * - extractMarkdownTables：从整段 Markdown 中提取表格 block（用于预览态生成 key）
 */

export function hashStringToKey(input: string): string {
  // djb2 变体，输出 base36，足够用于 key 区分
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  // 转为无符号 32bit
  const u = h >>> 0;
  return u.toString(36);
}

export function tableKeyFromMarkdown(tableMarkdown: string): string {
  const normalized = tableMarkdown
    .trim()
    .replace(/\r\n/g, "\n")
    // 压缩表格行内多余空格，避免同表格因空格差异 key 不同
    .replace(/[ \t]+/g, " ");
  return `tbl_${hashStringToKey(normalized)}`;
}

/**
 * 从 Markdown 中提取 GFM 表格 blocks（按出现顺序）
 * 规则（足够覆盖常见场景）：连续的以 '|' 开头并以 '|' 结尾的行，且至少包含 2 行（含分隔行）
 */
export function extractMarkdownTables(markdown: string): string[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const tables: string[] = [];

  const isTableLine = (line: string) => /^\|[\s\S]*\|$/.test(line.trim());
  const isSeparatorLine = (line: string) => /^\|[\s-|:]*\|$/.test(line.trim());

  let i = 0;
  while (i < lines.length) {
    if (!isTableLine(lines[i])) {
      i++;
      continue;
    }

    // 找连续的 table lines
    const start = i;
    while (i < lines.length && isTableLine(lines[i])) i++;
    const endExclusive = i;

    const block = lines.slice(start, endExclusive);
    // 至少包含 header + separator（或至少 2 行），且其中包含分隔行
    const hasSep = block.some((l) => isSeparatorLine(l));
    if (block.length >= 2 && hasSep) {
      tables.push(block.join("\n"));
    }
  }

  return tables;
}

