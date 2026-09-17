import { describe, it, expect } from "vitest";
import {
  buildDashboardStats,
  computeFolderDistribution,
  computeHeatmap,
  computeRecentNotes,
  computeUserStats,
  stripMarkdown,
  type NoteRow,
  type FolderRow,
} from "@/lib/stats";

const folders: FolderRow[] = [
  { id: "f1", name: "工作" },
  { id: "f2", name: "生活" },
];

function note(partial: Partial<NoteRow> & { id: string }): NoteRow {
  return {
    title: partial.title ?? "t",
    content: partial.content ?? "hello",
    folder_id: partial.folder_id ?? null,
    updated_at: partial.updated_at ?? "2026-09-17T08:00:00.000Z",
    id: partial.id,
  };
}

describe("stats compute (issue006)", () => {
  it("stripMarkdown 去掉常见标记", () => {
    expect(stripMarkdown("# Hi **x**")).toContain("Hi");
    expect(stripMarkdown("![a](u)")).not.toContain("u");
  });

  it("空笔记仍返回完整仪表盘结构（不抛错）", () => {
    const stats = buildDashboardStats([], folders, new Date("2026-09-17T12:00:00Z"));
    expect(stats.userStats.totalNotes).toBe(0);
    expect(stats.userStats.totalChars).toBe(0);
    expect(stats.heatmap.length).toBeGreaterThan(300);
    expect(stats.folderDistribution).toEqual([]);
    expect(stats.recentNotes).toEqual([]);
  });

  it("computeUserStats 统计字数与本周", () => {
    const notes = [
      note({
        id: "1",
        content: "abcd",
        updated_at: "2026-09-17T10:00:00.000Z",
        folder_id: "f1",
      }),
      note({
        id: "2",
        content: "xy",
        updated_at: "2026-01-01T10:00:00.000Z",
        folder_id: "f2",
      }),
    ];
    const s = computeUserStats(notes, new Date("2026-09-17T12:00:00Z"));
    expect(s.totalNotes).toBe(2);
    expect(s.totalChars).toBe(6);
    expect(s.notesThisWeek).toBe(1);
    expect(s.activeDays).toBe(2);
  });

  it("computeFolderDistribution 按文件夹计数", () => {
    const notes = [
      note({ id: "1", folder_id: "f1" }),
      note({ id: "2", folder_id: "f1" }),
      note({ id: "3", folder_id: null }),
    ];
    const dist = computeFolderDistribution(notes, folders);
    expect(dist[0]).toMatchObject({ folderId: "f1", folderName: "工作", count: 2 });
    expect(dist.find((d) => d.folderId === null)?.folderName).toBe("未分组");
  });

  it("computeHeatmap 零字日 intensity 为 0", () => {
    const heat = computeHeatmap(
      [note({ id: "1", content: "abc", updated_at: "2026-09-17T10:00:00.000Z" })],
      new Date("2026-09-17T12:00:00Z")
    );
    const empty = heat.find((d) => d.date === "2026-09-16");
    const today = heat.find((d) => d.date === "2026-09-17");
    expect(empty?.intensity).toBe(0);
    expect(today?.count).toBeGreaterThan(0);
    expect(today?.intensity).toBeGreaterThan(0);
  });

  it("computeRecentNotes 按更新时间倒序截断", () => {
    const recent = computeRecentNotes(
      [
        note({ id: "old", updated_at: "2026-01-01T00:00:00.000Z", title: "旧" }),
        note({ id: "new", updated_at: "2026-09-17T00:00:00.000Z", title: "新" }),
      ],
      folders,
      1
    );
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe("new");
  });
});
