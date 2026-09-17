import { describe, it, expect } from "vitest";
import { isNotePubliclyReadable } from "@/lib/note-service";

describe("isNotePubliclyReadable (issue005)", () => {
  it("已发布且未删除 → 可读", () => {
    expect(
      isNotePubliclyReadable({ is_published: true, is_deleted: false })
    ).toBe(true);
    expect(
      isNotePubliclyReadable({ is_published: true, is_deleted: null })
    ).toBe(true);
  });

  it("未发布 → 不可读", () => {
    expect(
      isNotePubliclyReadable({ is_published: false, is_deleted: false })
    ).toBe(false);
    expect(
      isNotePubliclyReadable({ is_published: null, is_deleted: false })
    ).toBe(false);
  });

  it("已删除 → 不可读", () => {
    expect(
      isNotePubliclyReadable({ is_published: true, is_deleted: true })
    ).toBe(false);
  });

  it("空值 → 不可读", () => {
    expect(isNotePubliclyReadable(null)).toBe(false);
    expect(isNotePubliclyReadable(undefined)).toBe(false);
  });
});
