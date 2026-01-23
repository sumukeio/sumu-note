/**
 * 查找与替换工具函数
 * 提供文本查找、匹配项定位、高亮和替换功能
 */

export interface Match {
  start: number;
  end: number;
  text: string;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 查找所有匹配项
 * @param text 要搜索的文本
 * @param query 搜索关键词
 * @param caseSensitive 是否大小写敏感，默认 false
 * @returns 匹配项数组，包含位置信息
 */
export function findAllMatches(
  text: string,
  query: string,
  caseSensitive: boolean = false
): Match[] {
  if (!query.trim()) {
    return [];
  }

  const escapedQuery = escapeRegex(query);
  const flags = caseSensitive ? "g" : "gi";
  const regex = new RegExp(escapedQuery, flags);
  const matches: Match[] = [];

  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
    });
  }

  return matches;
}

/**
 * 根据光标位置获取当前匹配项索引
 * @param matches 所有匹配项数组
 * @param cursorPosition 光标位置
 * @returns 匹配项索引，如果未找到返回 -1
 */
export function getMatchIndex(
  matches: Match[],
  cursorPosition: number
): number {
  if (matches.length === 0) {
    return -1;
  }

  // 找到光标位置之后或包含光标位置的第一个匹配项
  for (let i = 0; i < matches.length; i++) {
    if (cursorPosition <= matches[i].end) {
      return i;
    }
  }

  // 如果光标在所有匹配项之后，返回最后一个匹配项
  return matches.length - 1;
}

/**
 * 获取下一个匹配项索引
 * @param currentIndex 当前匹配项索引
 * @param matches 所有匹配项数组
 * @returns 下一个匹配项索引，如果已经是最后一个则返回第一个（循环）
 */
export function getNextMatchIndex(
  currentIndex: number,
  matches: Match[]
): number {
  if (matches.length === 0) {
    return -1;
  }

  if (currentIndex < 0 || currentIndex >= matches.length) {
    return 0;
  }

  // 循环到第一个
  return (currentIndex + 1) % matches.length;
}

/**
 * 获取上一个匹配项索引
 * @param currentIndex 当前匹配项索引
 * @param matches 所有匹配项数组
 * @returns 上一个匹配项索引，如果已经是第一个则返回最后一个（循环）
 */
export function getPreviousMatchIndex(
  currentIndex: number,
  matches: Match[]
): number {
  if (matches.length === 0) {
    return -1;
  }

  if (currentIndex < 0 || currentIndex >= matches.length) {
    return matches.length - 1;
  }

  // 循环到最后一个
  return currentIndex === 0 ? matches.length - 1 : currentIndex - 1;
}

/**
 * 高亮匹配项（返回带标记的文本）
 * 注意：这个函数主要用于预览或显示，不适用于 Textarea
 * @param text 原始文本
 * @param query 搜索关键词
 * @param caseSensitive 是否大小写敏感，默认 false
 * @returns 高亮后的 HTML 字符串（使用 <mark> 标签）
 */
export function highlightMatches(
  text: string,
  query: string,
  caseSensitive: boolean = false
): string {
  if (!query.trim()) {
    return text;
  }

  const matches = findAllMatches(text, query, caseSensitive);
  if (matches.length === 0) {
    return text;
  }

  // 从后往前替换，避免位置偏移
  let result = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const before = result.substring(0, match.start);
    const matched = result.substring(match.start, match.end);
    const after = result.substring(match.end);
    result = before + `<mark>${matched}</mark>` + after;
  }

  return result;
}

/**
 * 替换单个匹配项
 * @param text 原始文本
 * @param query 搜索关键词（用于验证）
 * @param replacement 替换文本
 * @param matchIndex 要替换的匹配项索引
 * @param caseSensitive 是否大小写敏感，默认 false
 * @returns 替换后的文本和新文本中匹配项的位置信息
 */
export function replaceMatch(
  text: string,
  query: string,
  replacement: string,
  matchIndex: number,
  caseSensitive: boolean = false
): { newText: string; newMatchIndex: number } {
  const matches = findAllMatches(text, query, caseSensitive);

  if (matchIndex < 0 || matchIndex >= matches.length) {
    return { newText: text, newMatchIndex: -1 };
  }

  const match = matches[matchIndex];
  const before = text.substring(0, match.start);
  const after = text.substring(match.end);
  const newText = before + replacement + after;

  // 计算新文本中匹配项的位置（考虑替换文本长度变化）
  const lengthDiff = replacement.length - (match.end - match.start);
  const newMatches = findAllMatches(newText, query, caseSensitive);

  // 找到替换位置之后的第一个匹配项索引
  let newMatchIndex = -1;
  const replaceEnd = match.start + replacement.length;
  for (let i = 0; i < newMatches.length; i++) {
    if (newMatches[i].start >= replaceEnd) {
      newMatchIndex = i;
      break;
    }
  }

  // 如果替换位置之后没有匹配项，返回第一个匹配项（循环）
  if (newMatchIndex === -1 && newMatches.length > 0) {
    newMatchIndex = 0;
  }

  return { newText, newMatchIndex };
}

/**
 * 替换所有匹配项
 * @param text 原始文本
 * @param query 搜索关键词
 * @param replacement 替换文本
 * @param caseSensitive 是否大小写敏感，默认 false
 * @returns 替换后的文本
 */
export function replaceAllMatches(
  text: string,
  query: string,
  replacement: string,
  caseSensitive: boolean = false
): string {
  if (!query.trim()) {
    return text;
  }

  const escapedQuery = escapeRegex(query);
  const flags = caseSensitive ? "g" : "gi";
  const regex = new RegExp(escapedQuery, flags);

  return text.replace(regex, replacement);
}
