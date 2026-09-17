import type { FolderItem } from "@/types/note";

/**
 * 获取某文件夹的所有后代 id（子、孙、…），用于移动时排除，防止循环引用
 */
export function getFolderDescendantIds(
  folders: FolderItem[],
  folderId: string
): Set<string> {
  const byParent = new Map<string | null, FolderItem[]>();
  for (const f of folders) {
    const key = f.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(f);
  }
  const result = new Set<string>();
  const stack: string[] = [folderId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const children = byParent.get(id) ?? [];
    for (const c of children) {
      result.add(c.id);
      stack.push(c.id);
    }
  }
  return result;
}

/**
 * 删除文件夹时：选中项 ∪ 其全部后代（避免 parent_id 外键阻塞）
 */
export function expandFolderIdsWithDescendants(
  folders: FolderItem[],
  selectedIds: Iterable<string>
): Set<string> {
  const result = new Set<string>();
  for (const id of selectedIds) {
    if (!id) continue;
    result.add(id);
    for (const d of getFolderDescendantIds(folders, id)) {
      result.add(d);
    }
  }
  return result;
}

/**
 * 叶子优先排序：先删子再删父，满足 folders.parent_id 自引用外键。
 * 同一层内顺序稳定（按 id 排序），便于测试。
 */
export function orderFolderIdsLeafFirst(
  folders: FolderItem[],
  idsToDelete: Iterable<string>
): string[] {
  const remaining = new Set(
    [...idsToDelete].filter((id) => typeof id === "string" && id.length > 0)
  );
  if (remaining.size === 0) return [];

  const byParent = new Map<string | null, string[]>();
  for (const f of folders) {
    if (!remaining.has(f.id)) continue;
    const key = f.parent_id ?? null;
    // 仅当父也在待删集合内时，才视为“待删树内的父子”
    const effectiveParent =
      key && remaining.has(key) ? key : null;
    if (!byParent.has(effectiveParent)) byParent.set(effectiveParent, []);
    byParent.get(effectiveParent)!.push(f.id);
  }

  const ordered: string[] = [];
  while (remaining.size > 0) {
    const leaves = [...remaining]
      .filter((id) => {
        const kids = byParent.get(id) ?? [];
        return kids.every((k) => !remaining.has(k));
      })
      .sort();
    if (leaves.length === 0) {
      // 理论上不应出现环；兜底按 id 排空，避免死循环
      ordered.push(...[...remaining].sort());
      break;
    }
    for (const id of leaves) {
      ordered.push(id);
      remaining.delete(id);
    }
  }
  return ordered;
}

/**
 * 一次性得到「应删除的文件夹 id 列表」（含后代，叶子优先）
 */
export function resolveFolderIdsForDelete(
  folders: FolderItem[],
  selectedIds: Iterable<string>
): string[] {
  return orderFolderIdsLeafFirst(
    folders,
    expandFolderIdsWithDescendants(folders, selectedIds)
  );
}
