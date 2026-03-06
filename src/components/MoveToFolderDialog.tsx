"use client";

import { useState, useMemo } from "react";
import { Folder, ChevronRight, ChevronDown, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FolderItem } from "@/types/note";

/** 表示“根目录”的 lastMoveTargetId 存储值 */
export const MOVE_TARGET_ROOT = "__root__";

export interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 可选目标文件夹列表（已排除不可选的后代等） */
  targets: FolderItem[];
  /** 上次移动目标 id，MOVE_TARGET_ROOT 表示根目录 */
  lastMoveTargetId: string | null;
  onSelect: (targetFolderId: string | null) => void;
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  targets,
  lastMoveTargetId,
  onSelect,
}: MoveToFolderDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());

  // 构建 parent -> children 映射，并排序
  const byParent = useMemo(() => {
    const map = new Map<string | null, FolderItem[]>();
    for (const f of targets) {
      const key = f.parent_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "zh-CN")
      );
    }
    return map;
  }, [targets]);

  // 根据搜索过滤：匹配的节点 + 其所有祖先（用于展示路径）
  const filteredTreeRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      const rows: { folder: FolderItem; depth: number }[] = [];
      const walk = (parentId: string | null, depth: number) => {
        const children = byParent.get(parentId) || [];
        for (const c of children) {
          rows.push({ folder: c, depth });
          walk(c.id, depth + 1);
        }
      };
      walk(null, 0);
      return rows;
    }
    const match = (name: string | null) =>
      (name || "").toLowerCase().includes(q);
    const matchedIds = new Set<string>();
    for (const f of targets) {
      if (match(f.name)) matchedIds.add(f.id);
    }
    if (matchedIds.size === 0) return [];

    const ancestorIds = new Set<string>();
    for (const id of matchedIds) {
      let cur: FolderItem | undefined = targets.find((x) => x.id === id);
      while (cur?.parent_id) {
        ancestorIds.add(cur.parent_id);
        cur = targets.find((x) => x.id === cur!.parent_id!);
      }
    }
    const showIds = new Set([...matchedIds, ...ancestorIds]);
    const rows: { folder: FolderItem; depth: number }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      const children = byParent.get(parentId) || [];
      for (const c of children) {
        if (!showIds.has(c.id)) continue;
        rows.push({ folder: c, depth });
        walk(c.id, depth + 1);
      }
    };
    walk(null, 0);
    return rows;
  }, [targets, byParent, searchQuery]);

  const visibleTreeRows = useMemo(() => {
    if (searchQuery.trim()) return filteredTreeRows;
    const rows: { folder: FolderItem; depth: number }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      const children = byParent.get(parentId) || [];
      for (const c of children) {
        rows.push({ folder: c, depth });
        if (!collapsedIds.has(c.id)) walk(c.id, depth + 1);
      }
    };
    walk(null, 0);
    return rows;
  }, [searchQuery, collapsedIds, byParent, filteredTreeRows]);

  const toggleExpanded = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasChildren = (folderId: string) =>
    (byParent.get(folderId)?.length ?? 0) > 0;

  const handleSelectRoot = () => {
    onSelect(null);
    onOpenChange(false);
  };

  const handleSelectFolder = (id: string) => {
    onSelect(id);
    onOpenChange(false);
  };

  const showLastMove =
    lastMoveTargetId &&
    (lastMoveTargetId === MOVE_TARGET_ROOT ||
      targets.some((f) => f.id === lastMoveTargetId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>移动到...</DialogTitle>
          <DialogDescription>
            选择目标文件夹，或选择「根目录」移到顶层。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Input
            type="search"
            placeholder="搜索文件夹名称"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
            aria-label="搜索文件夹"
          />

          {showLastMove && (
            <div className="border border-dashed border-border rounded-md p-2 space-y-1">
              <div className="text-[11px] text-muted-foreground">上次移动到</div>
              <Button
                variant="outline"
                className="justify-start h-auto py-2 text-sm w-full"
                onClick={() =>
                  lastMoveTargetId === MOVE_TARGET_ROOT
                    ? handleSelectRoot()
                    : handleSelectFolder(lastMoveTargetId!)
                }
              >
                {lastMoveTargetId === MOVE_TARGET_ROOT ? (
                  <>
                    <Home className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span>根目录</span>
                  </>
                ) : (
                  (() => {
                    const f = targets.find(
                      (x) => x.id === lastMoveTargetId
                    );
                    return (
                      <>
                        <Folder className="w-4 h-4 mr-2 text-yellow-500" />
                        <span className="truncate">
                          {f?.name || "未命名文件夹"}
                        </span>
                      </>
                    );
                  })()
                )}
              </Button>
            </div>
          )}

          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            <div className="text-[11px] text-muted-foreground px-1 sticky top-0 bg-background py-1">
              选择目标
            </div>
            <Button
              variant="outline"
              className="justify-start h-auto py-2 text-sm w-full"
              onClick={handleSelectRoot}
            >
              <Home className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>根目录</span>
            </Button>

            {visibleTreeRows.length === 0 && targets.length > 0 && searchQuery.trim() ? (
              <p className="text-xs text-muted-foreground px-1 py-2">
                未找到匹配的文件夹
              </p>
            ) : (
              visibleTreeRows.map(({ folder, depth }) => {
                const hasKids = hasChildren(folder.id);
                const isExpanded = !collapsedIds.has(folder.id);
                return (
                  <div key={folder.id} className="flex items-center gap-0">
                    <div
                      style={{ paddingLeft: 12 + depth * 16 }}
                      className="flex items-center min-w-0 flex-1"
                    >
                      <button
                        type="button"
                        aria-label={isExpanded ? "收起" : "展开"}
                        className="p-0.5 mr-1 shrink-0 rounded hover:bg-accent"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasKids) toggleExpanded(folder.id);
                        }}
                      >
                        {hasKids ? (
                          isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )
                        ) : (
                          <span className="w-4 inline-block" />
                        )}
                      </button>
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-2 text-sm flex-1 min-w-0"
                        style={{ paddingLeft: 8 }}
                        onClick={() => handleSelectFolder(folder.id)}
                      >
                        <Folder className="w-4 h-4 mr-2 shrink-0 text-yellow-500" />
                        <span className="truncate">
                          {folder.name || "未命名文件夹"}
                        </span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
            {targets.length === 0 && !searchQuery.trim() && (
              <p className="text-xs text-muted-foreground px-1 py-2">
                暂无可用的目标文件夹，可选择上方「根目录」。
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
