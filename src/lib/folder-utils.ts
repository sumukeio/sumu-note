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
