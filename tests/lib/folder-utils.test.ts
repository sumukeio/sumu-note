import { describe, it, expect } from "vitest";
import type { FolderItem } from "@/types/note";
import {
  expandFolderIdsWithDescendants,
  getFolderDescendantIds,
  orderFolderIdsLeafFirst,
  resolveFolderIdsForDelete,
  wouldCreateFolderCycle,
} from "@/lib/folder-utils";

function folder(
  id: string,
  parent_id: string | null = null,
  name = id
): FolderItem {
  return { id, name, parent_id, user_id: "u1" };
}

describe("folder-utils delete planning (issue010)", () => {
  const tree: FolderItem[] = [
    folder("root"),
    folder("a", "root"),
    folder("a1", "a"),
    folder("a2", "a"),
    folder("b", "root"),
    folder("orphan"),
  ];

  it("getFolderDescendantIds 返回全部子孙", () => {
    expect([...getFolderDescendantIds(tree, "a")].sort()).toEqual(["a1", "a2"]);
    expect([...getFolderDescendantIds(tree, "root")].sort()).toEqual([
      "a",
      "a1",
      "a2",
      "b",
    ]);
  });

  it("expandFolderIdsWithDescendants 含选中项与后代", () => {
    const set = expandFolderIdsWithDescendants(tree, ["a"]);
    expect([...set].sort()).toEqual(["a", "a1", "a2"]);
  });

  it("orderFolderIdsLeafFirst：子先于父（回归 folders_parent_id_fkey）", () => {
    const ordered = orderFolderIdsLeafFirst(
      tree,
      new Set(["a", "a1", "a2"])
    );
    expect(ordered.indexOf("a1")).toBeLessThan(ordered.indexOf("a"));
    expect(ordered.indexOf("a2")).toBeLessThan(ordered.indexOf("a"));
    expect(ordered[ordered.length - 1]).toBe("a");
  });

  it("resolveFolderIdsForDelete：删 root 时整棵子树叶子优先", () => {
    const ordered = resolveFolderIdsForDelete(tree, ["root"]);
    expect(ordered).toContain("root");
    expect(ordered).toContain("a1");
    expect(ordered.indexOf("a1")).toBeLessThan(ordered.indexOf("a"));
    expect(ordered.indexOf("a")).toBeLessThan(ordered.indexOf("root"));
    expect(ordered.indexOf("b")).toBeLessThan(ordered.indexOf("root"));
    expect(ordered[ordered.length - 1]).toBe("root");
  });

  it("无子文件夹时保持单 id", () => {
    expect(resolveFolderIdsForDelete(tree, ["orphan"])).toEqual(["orphan"]);
  });
});

describe("wouldCreateFolderCycle (task002)", () => {
  const tree: FolderItem[] = [
    folder("root"),
    folder("a", "root"),
    folder("a1", "a"),
    folder("b", "root"),
  ];

  it("拖到自身 → true", () => {
    expect(wouldCreateFolderCycle(tree, "a", "a")).toBe(true);
  });

  it("拖到自己的后代 → true", () => {
    expect(wouldCreateFolderCycle(tree, "a", "a1")).toBe(true);
  });

  it("拖到兄弟 → false", () => {
    expect(wouldCreateFolderCycle(tree, "a", "b")).toBe(false);
  });

  it("拖到祖先 → false（变成子树上移）", () => {
    expect(wouldCreateFolderCycle(tree, "a1", "root")).toBe(false);
  });
});
