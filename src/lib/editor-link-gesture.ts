/**
 * 编辑态链接手势（issue008 / ADR）：
 * - 预览态：单击打开（由 MarkdownRenderer 负责）
 * - 编辑态桌面：Cmd/Ctrl + 点击才确认打开
 * - 编辑态移动：单击不打开；长按/contextmenu 或显式「打开」
 */

/** 光标处是否落在 wiki 链接 [[...]] 内，若是则返回整段 token */
export function extractWikiLinkAtCursor(
  text: string,
  cursor: number
): string | null {
  const wikiRe = /\[\[[^\]]+\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = wikiRe.exec(text)) !== null) {
    if (cursor >= m.index && cursor <= m.index + m[0].length) {
      return m[0];
    }
  }
  return null;
}

/**
 * 从正文光标处提取「词元」（URL / 普通片段）。
 * 优先识别 [[wiki]]，否则按空白与标点分界。
 */
export function extractTokenAtCursor(text: string, cursor: number): string {
  if (!text) return "";
  const wiki = extractWikiLinkAtCursor(text, cursor);
  if (wiki) return wiki;

  const isBoundary = (ch: string) =>
    /\s/.test(ch) ||
    ch === "(" ||
    ch === ")" ||
    ch === "[" ||
    ch === "]" ||
    ch === "{" ||
    ch === "}" ||
    ch === '"' ||
    ch === "'" ||
    ch === "<" ||
    ch === ">" ||
    ch === "," ||
    ch === "，" ||
    ch === "。" ||
    ch === "！" ||
    ch === "？" ||
    ch === "；" ||
    ch === "：" ||
    ch === "、";

  let l = cursor;
  let r = cursor;
  while (l > 0 && !isBoundary(text[l - 1])) l--;
  while (r < text.length && !isBoundary(text[r])) r++;
  return text.slice(l, r);
}

/** 是否为可智能打开的链接 token（http(s) 或 [[wiki]]） */
export function isSmartLinkToken(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  if (/^https?:\/\/\S+$/i.test(t)) return true;
  if (/^\[\[([^\]|]+)(\|[^\]]+)?\]\]$/.test(t)) return true;
  return false;
}

/**
 * 编辑态「单击」是否应弹出打开确认。
 * 触摸指针永不因单击打开；鼠标需 Cmd/Ctrl。
 */
export function shouldOpenLinkConfirmOnEditClick(opts: {
  metaKey: boolean;
  ctrlKey: boolean;
  /** PointerEvent.pointerType；缺省按鼠标处理 */
  pointerType?: string;
}): boolean {
  if (opts.pointerType === "touch") return false;
  return !!(opts.metaKey || opts.ctrlKey);
}
