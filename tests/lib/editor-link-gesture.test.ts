import { describe, it, expect } from "vitest";
import {
  extractTokenAtCursor,
  extractWikiLinkAtCursor,
  isSmartLinkToken,
  shouldOpenLinkConfirmOnEditClick,
} from "@/lib/editor-link-gesture";

describe("editor-link-gesture (issue008)", () => {
  describe("isSmartLinkToken", () => {
    it("识别 http(s) 与 wiki", () => {
      expect(isSmartLinkToken("https://example.com/a")).toBe(true);
      expect(isSmartLinkToken("http://a.cn")).toBe(true);
      expect(isSmartLinkToken("[[note-id]]")).toBe(true);
      expect(isSmartLinkToken("[[id|显示名]]")).toBe(true);
    });

    it("拒绝普通文本", () => {
      expect(isSmartLinkToken("普通标题")).toBe(false);
      expect(isSmartLinkToken("")).toBe(false);
      expect(isSmartLinkToken("[markdown](url)")).toBe(false);
    });
  });

  describe("extractTokenAtCursor", () => {
    it("提取 URL", () => {
      const t = "见 https://ex.com/x 结尾";
      const at = t.indexOf("h") + 3;
      expect(extractTokenAtCursor(t, at)).toBe("https://ex.com/x");
    });

    it("提取完整 wiki（含方括号）", () => {
      const t = "前 [[abc|名]] 后";
      const at = t.indexOf("a");
      expect(extractWikiLinkAtCursor(t, at)).toBe("[[abc|名]]");
      expect(extractTokenAtCursor(t, at)).toBe("[[abc|名]]");
    });
  });

  describe("shouldOpenLinkConfirmOnEditClick", () => {
    it("触摸单击 → 否", () => {
      expect(
        shouldOpenLinkConfirmOnEditClick({
          metaKey: false,
          ctrlKey: false,
          pointerType: "touch",
        })
      ).toBe(false);
      expect(
        shouldOpenLinkConfirmOnEditClick({
          metaKey: true,
          ctrlKey: false,
          pointerType: "touch",
        })
      ).toBe(false);
    });

    it("鼠标普通单击 → 否；Cmd/Ctrl → 是", () => {
      expect(
        shouldOpenLinkConfirmOnEditClick({
          metaKey: false,
          ctrlKey: false,
          pointerType: "mouse",
        })
      ).toBe(false);
      expect(
        shouldOpenLinkConfirmOnEditClick({
          metaKey: true,
          ctrlKey: false,
        })
      ).toBe(true);
      expect(
        shouldOpenLinkConfirmOnEditClick({
          metaKey: false,
          ctrlKey: true,
        })
      ).toBe(true);
    });
  });
});
