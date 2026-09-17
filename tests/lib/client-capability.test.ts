import { describe, it, expect } from "vitest";
import { shouldUseLightFolderNotes } from "@/lib/client-capability";

describe("shouldUseLightFolderNotes (issue002 task018)", () => {
  it("iPhone → true", () => {
    expect(
      shouldUseLightFolderNotes(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3_1 like Mac OS X) AppleWebKit/605.1.15"
      )
    ).toBe(true);
  });

  it("iPod → true", () => {
    expect(
      shouldUseLightFolderNotes(
        "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)"
      )
    ).toBe(true);
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
