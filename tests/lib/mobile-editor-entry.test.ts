import { describe, it, expect } from "vitest";
import { shouldStartInMobileReadingMode } from "@/lib/mobile-editor-entry";

describe("shouldStartInMobileReadingMode (issue001)", () => {
  it("空白新建 → 直接编辑（false）", () => {
    expect(shouldStartInMobileReadingMode({ title: "", content: "" })).toBe(
      false
    );
    expect(shouldStartInMobileReadingMode({ title: null, content: null })).toBe(
      false
    );
    expect(shouldStartInMobileReadingMode({ title: "  ", content: "\n" })).toBe(
      false
    );
  });

  it("已有标题或正文 → 先阅读（true）", () => {
    expect(
      shouldStartInMobileReadingMode({ title: "周报", content: "" })
    ).toBe(true);
    expect(
      shouldStartInMobileReadingMode({ title: "", content: "正文" })
    ).toBe(true);
  });
});
