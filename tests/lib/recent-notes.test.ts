import { describe, it, expect } from "vitest";
import {
  mergeRecentEntries,
  normalizeRecentEntries,
  upsertRecentEntry,
  type RecentNoteEntry,
} from "@/lib/recent-notes";

describe("recent-notes merge (issue003)", () => {
  const a: RecentNoteEntry = {
    noteId: "n1",
    folderId: "f1",
    title: "A",
    lastOpenedAt: 100,
  };
  const b: RecentNoteEntry = {
    noteId: "n1",
    folderId: "f2",
    title: "A2",
    lastOpenedAt: 200,
  };
  const c: RecentNoteEntry = {
    noteId: "n2",
    folderId: null,
    title: "B",
    lastOpenedAt: 150,
  };

  it("normalizeRecentEntries 过滤非法项并排序", () => {
    const out = normalizeRecentEntries([
      c,
      { noteId: "", lastOpenedAt: 1 },
      a,
      null,
    ]);
    expect(out.map((x) => x.noteId)).toEqual(["n2", "n1"]);
  });

  it("mergeRecentEntries 同 id 取较新", () => {
    const merged = mergeRecentEntries([a, c], [b]);
    expect(merged[0].noteId).toBe("n1");
    expect(merged[0].lastOpenedAt).toBe(200);
    expect(merged[0].folderId).toBe("f2");
    expect(merged).toHaveLength(2);
  });

  it("upsertRecentEntry 置顶并去重", () => {
    const next = upsertRecentEntry([a, c], {
      noteId: "n2",
      folderId: "fx",
      title: "B-new",
      lastOpenedAt: 999,
    });
    expect(next[0]).toMatchObject({
      noteId: "n2",
      title: "B-new",
      lastOpenedAt: 999,
    });
    expect(next.filter((x) => x.noteId === "n2")).toHaveLength(1);
  });
});
