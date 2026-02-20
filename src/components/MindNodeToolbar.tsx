"use client";

import { ArrowRight, ArrowLeft, Edit, Trash2, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MindNodeToolbarProps {
  isVisible: boolean;
  onEdit: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onDelete: () => void;
  onAddChild?: () => void;
  onAddSibling?: () => void;
  canOutdent?: boolean;
}

export default function MindNodeToolbar({
  isVisible,
  onEdit,
  onIndent,
  onOutdent,
  onDelete,
  onAddChild,
  onAddSibling,
  canOutdent = false,
}: MindNodeToolbarProps) {
  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-50 transition-all duration-300 ease-in-out",
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0 pointer-events-none"
      )}
      style={{ bottom: 'calc(0px + var(--vv-bottom-inset, 0px))' }}
    >
      <div className="bg-background/95 backdrop-blur-md border-t border-border shadow-2xl" data-toolbar>
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-around gap-2">
            {/* 编辑按钮 */}
            <button
              onClick={onEdit}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-accent transition-colors touch-manipulation min-w-[60px]"
            >
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                <Edit className="w-4 h-4" />
              </div>
              <span className="text-[10px] text-muted-foreground">编辑</span>
            </button>

            {/* 添加子节点 */}
            {onAddChild && (
              <button
                onClick={onAddChild}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-accent transition-colors touch-manipulation min-w-[60px]"
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-green-500/10 text-green-500">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-[10px] text-muted-foreground">子节点</span>
              </button>
            )}

            {/* 添加同级节点 */}
            {onAddSibling && (
              <button
                onClick={onAddSibling}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-accent transition-colors touch-manipulation min-w-[60px]"
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-purple-500/10 text-purple-500">
                  <ChevronRight className="w-4 h-4" />
                </div>
                <span className="text-[10px] text-muted-foreground">同级</span>
              </button>
            )}

            {/* 缩进按钮（→） */}
            <button
              onClick={onIndent}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-accent transition-colors touch-manipulation min-w-[60px]"
            >
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                <ArrowRight className="w-4 h-4" />
              </div>
              <span className="text-[10px] text-muted-foreground">缩进</span>
            </button>

            {/* 升级按钮（←） */}
            <button
              onClick={onOutdent}
              disabled={!canOutdent}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors touch-manipulation min-w-[60px]",
                canOutdent
                  ? "hover:bg-accent"
                  : "opacity-30 cursor-not-allowed"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-full",
                  canOutdent
                    ? "bg-yellow-500/10 text-yellow-500"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="text-[10px] text-muted-foreground">升级</span>
            </button>

            {/* 删除按钮 */}
            <button
              onClick={onDelete}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors touch-manipulation min-w-[60px]"
            >
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500/10 text-red-500">
                <Trash2 className="w-4 h-4" />
              </div>
              <span className="text-[10px] text-muted-foreground">删除</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

