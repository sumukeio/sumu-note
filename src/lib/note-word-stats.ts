/** 阅读速度：字/分钟（按非空白字符数） */
export const WORDS_PER_MINUTE = 200;

export interface NoteWordStats {
  /** 非空白字符数（中英数字标点均计，空白不计） */
  words: number;
  paragraphs: number;
  /** 预估阅读分钟数；有字时至少为 1 */
  readingTime: number;
}

/**
 * 计算笔记字数 / 段落 / 阅读时间（issue007）。
 * 字数 = 非空白字符数；段落 = 非空行数。
 */
export function computeNoteWordStats(content: string): NoteWordStats {
  const text = content || "";
  const words = (text.match(/\S/g) || []).length;
  const paragraphs = text.split("\n").filter((line) => line.trim().length > 0).length;
  const readingTime = words === 0 ? 0 : Math.ceil(words / WORDS_PER_MINUTE);
  return { words, paragraphs, readingTime };
}
