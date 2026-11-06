import { describe, expect, it } from "vitest";
import {
  buildSegmentRanges,
  computeScrollDeltaToCenter,
  locateMatchInContent,
} from "@/lib/segmented-editor-search";
import { findAllMatches } from "@/lib/search-utils";

describe("buildSegmentRanges", () => {
  it("纯文本得到单段，trim 后偏移正确", () => {
    const content = "hello world";
    const ranges = buildSegmentRanges(content);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].type).toBe("text");
    expect(ranges[0].textContent).toBe("hello world");
    expect(ranges[0].textStartInContent).toBe(0);
  });

  it("前导空白被 trim 时，textStartInContent 指向可见文本", () => {
    const content = "\n\nfoo bar";
    const ranges = buildSegmentRanges(content);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].textContent).toBe("foo bar");
    expect(content.slice(ranges[0].textStartInContent)).toMatch(/^foo bar/);
  });

  it("文本 + 表格 + 文本 分段索引与类型对齐", () => {
    const content = ["前言关键词", "| a | b |", "|---|---|", "| 1 | 2 |", "后记关键词"].join(
      "\n"
    );
    const ranges = buildSegmentRanges(content);
    expect(ranges.map((r) => r.type)).toEqual(["text", "table", "text"]);
    expect(ranges[0].textContent).toContain("前言关键词");
    expect(ranges[2].textContent).toContain("后记关键词");
  });
});

describe("locateMatchInContent", () => {
  it("定位文本段内匹配到本地选区", () => {
    const content = "alpha beta gamma";
    const matches = findAllMatches(content, "beta");
    expect(matches).toHaveLength(1);
    const loc = locateMatchInContent(content, matches[0]);
    expect(loc).toEqual({
      kind: "text",
      segmentIndex: 0,
      localStart: 6,
      localEnd: 10,
    });
  });

  it("多命中时每个 match 映射到正确局部偏移", () => {
    const content = "xx test yy test zz";
    const matches = findAllMatches(content, "test");
    expect(matches).toHaveLength(2);
    const a = locateMatchInContent(content, matches[0]);
    const b = locateMatchInContent(content, matches[1]);
    expect(a).toMatchObject({ kind: "text", segmentIndex: 0, localStart: 3, localEnd: 7 });
    expect(b).toMatchObject({ kind: "text", segmentIndex: 0, localStart: 11, localEnd: 15 });
  });

  it("表格内匹配映射为 table 段", () => {
    const content = ["before", "| name |", "|------|", "| keyword |", "after"].join("\n");
    const matches = findAllMatches(content, "keyword");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const loc = locateMatchInContent(content, matches[0]);
    expect(loc).toEqual({ kind: "table", segmentIndex: 1 });
  });

  it("表格后文本段的匹配使用正确 segmentIndex", () => {
    const content = ["intro", "| a |", "|---|", "| b |", "tail FINDME end"].join("\n");
    const matches = findAllMatches(content, "FINDME");
    expect(matches).toHaveLength(1);
    const loc = locateMatchInContent(content, matches[0]);
    expect(loc?.kind).toBe("text");
    if (loc?.kind === "text") {
      expect(loc.segmentIndex).toBe(2);
      expect(loc.localEnd - loc.localStart).toBe(6);
    }
  });

  it("空内容走 plain", () => {
    const loc = locateMatchInContent("", { start: 0, end: 0 });
    // end===start 且长度为 0：按实现 start/end 合法但 local 空选 —— 空串 end>length 不成立
    // 使用空白内容
    const loc2 = locateMatchInContent("   ", { start: 0, end: 1 });
    expect(loc2).toEqual({ kind: "plain", localStart: 0, localEnd: 1 });
    expect(loc).toEqual({ kind: "plain", localStart: 0, localEnd: 0 });
  });

  it("非法区间返回 null", () => {
    expect(locateMatchInContent("abc", { start: 2, end: 1 })).toBeNull();
    expect(locateMatchInContent("abc", { start: -1, end: 1 })).toBeNull();
    expect(locateMatchInContent("abc", { start: 0, end: 9 })).toBeNull();
  });
});

describe("computeScrollDeltaToCenter", () => {
  it("选区在可见区下方时 delta 为正（需向下滚）", () => {
    const delta = computeScrollDeltaToCenter({
      caretViewportY: 800,
      containerTop: 100,
      containerHeight: 600,
      topInset: 0,
    });
    // 中线 = 100 + 300 = 400；delta = 800 - 400 = 400
    expect(delta).toBe(400);
  });

  it("扣除查找条 inset 后中线下移", () => {
    const delta = computeScrollDeltaToCenter({
      caretViewportY: 400,
      containerTop: 100,
      containerHeight: 600,
      topInset: 80,
    });
    // 可见顶 180，高 520，中线 180+260=440；delta = 400-440 = -40
    expect(delta).toBe(-40);
  });

  it("已在中线附近时 delta≈0", () => {
    const delta = computeScrollDeltaToCenter({
      caretViewportY: 400,
      containerTop: 100,
      containerHeight: 600,
      topInset: 0,
    });
    expect(delta).toBe(0);
  });
});
