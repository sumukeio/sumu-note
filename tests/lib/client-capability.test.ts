import { describe, it, expect } from "vitest";
import {
  parseIOSMajorVersion,
  shouldUseLightFolderNotes,
} from "@/lib/client-capability";

describe("parseIOSMajorVersion", () => {
  it("解析 iPhone OS 16_3_1", () => {
    expect(
      parseIOSMajorVersion(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3_1 like Mac OS X) AppleWebKit/605.1.15"
      )
    ).toBe(16);
  });

  it("解析 iPhone OS 18_0", () => {
    expect(
      parseIOSMajorVersion(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15"
      )
    ).toBe(18);
  });

  it("无法解析 → null", () => {
    expect(parseIOSMajorVersion("Mozilla/5.0 (compatible)")).toBe(null);
  });
});

describe("shouldUseLightFolderNotes (task001 收窄)", () => {
  it("iPhone iOS 16.3.1 → 轻量 true", () => {
    expect(
      shouldUseLightFolderNotes(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3_1 like Mac OS X) AppleWebKit/605.1.15"
      )
    ).toBe(true);
  });

  it("iPhone iOS 18 → 完整 false", () => {
    expect(
      shouldUseLightFolderNotes(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe(false);
  });

  it("iPhone iOS 17 → 完整 false", () => {
    expect(
      shouldUseLightFolderNotes(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
      )
    ).toBe(false);
  });

  it("iPod iOS 15 → 轻量 true", () => {
    expect(
      shouldUseLightFolderNotes(
        "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)"
      )
    ).toBe(true);
  });

  it("iPhone 但无法解析版本 → 保守轻量 true", () => {
    expect(shouldUseLightFolderNotes("Mozilla/5.0 (iPhone; like Mac OS X)")).toBe(
      true
    );
  });

  it("iPad → false（走完整 NoteManager）", () => {
    expect(
      shouldUseLightFolderNotes(
        "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
      )
    ).toBe(false);
  });

  it("Android → false", () => {
    expect(
      shouldUseLightFolderNotes(
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36"
      )
    ).toBe(false);
  });

  it("桌面 Chrome → false", () => {
    expect(
      shouldUseLightFolderNotes(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120"
      )
    ).toBe(false);
  });

  it("空 UA → false", () => {
    expect(shouldUseLightFolderNotes("")).toBe(false);
  });
});
