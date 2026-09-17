import { describe, it, expect } from "vitest";
import {
  computeNoteWordStats,
  WORDS_PER_MINUTE,
} from "@/lib/note-word-stats";

describe("computeNoteWordStats (issue007)", () => {
  it("空内容 / 仅空白 → 全 0", () => {
    expect(computeNoteWordStats("")).toEqual({
      words: 0,
      paragraphs: 0,
      readingTime: 0,
    });
    expect(computeNoteWordStats("   \n\n  ")).toEqual({
      words: 0,
      paragraphs: 0,
      readingTime: 0,
    });
  });

  it("非空白字符均计入（中英数字标点）", () => {
    expect(computeNoteWordStats("你好").words).toBe(2);
    expect(computeNoteWordStats("abc").words).toBe(3);
    expect(computeNoteWordStats("123").words).toBe(3);
    expect(computeNoteWordStats("你好 world!").words).toBe(2 + 5 + 1); // 空格不计
    expect(computeNoteWordStats("a b\tc").words).toBe(3);
  });

  it("非空行计为段落", () => {
    expect(computeNoteWordStats("一段\n\n二段\n三段").paragraphs).toBe(3);
  });

  it("阅读时间按 WORDS_PER_MINUTE 向上取整", () => {
    expect(WORDS_PER_MINUTE).toBe(200);
    expect(computeNoteWordStats("字").readingTime).toBe(1);
    expect(computeNoteWordStats("x".repeat(200)).readingTime).toBe(1);
    expect(computeNoteWordStats("x".repeat(201)).readingTime).toBe(2);
  });
});
