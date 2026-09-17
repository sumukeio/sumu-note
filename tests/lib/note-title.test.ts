import { describe, it, expect } from "vitest";
import {
  AUTO_TITLE_MAX_LENGTH,
  deriveAutoTitleFromContent,
} from "@/lib/note-title";

describe("deriveAutoTitleFromContent (issue004)", () => {
  it("常量上限为 10", () => {
    expect(AUTO_TITLE_MAX_LENGTH).toBe(10);
  });

  it("空正文 → 空标题", () => {
    expect(deriveAutoTitleFromContent("")).toBe("");
    expect(deriveAutoTitleFromContent("\n第二行")).toBe("");
  });

  it("取首行并去掉 Markdown 标记", () => {
    expect(deriveAutoTitleFromContent("# 你好世界\n正文")).toBe("你好世界");
    expect(deriveAutoTitleFromContent("**加粗标题**")).toBe("加粗标题");
    expect(deriveAutoTitleFromContent("`代码标题`")).toBe("代码标题");
  });

  it("超过 10 字截断", () => {
    const long = "一二三四五六七八九十十一";
    expect(deriveAutoTitleFromContent(long)).toBe("一二三四五六七八九十");
    expect(deriveAutoTitleFromContent(long).length).toBe(10);
  });

  it("恰好 10 字不截断", () => {
    expect(deriveAutoTitleFromContent("一二三四五六七八九十")).toBe(
      "一二三四五六七八九十"
    );
  });

  it("可自定义上限", () => {
    expect(deriveAutoTitleFromContent("abcdefghijklmn", 5)).toBe("abcde");
  });
});
