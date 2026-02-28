"use client";

import {
  Copy,
  Trash2,
  FolderInput,
  X,
  Check,
  Plus,
  FileText,
  ArrowLeft,
  Pencil,
  Pin,
  Folder,
  RotateCcw,
  Search,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { Note, FolderItem } from "@/types/note";

export type { FolderItem };

interface DraggableNoteCardProps {
  note: Note;
  isSelected: boolean;
  isSelectionMode: boolean;
  onClick: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: () => void;
}

function DraggableNoteCard({
  note,
  isSelected,
  isSelectionMode,
  onClick,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onMouseDown,
  onMouseUp,
  onMouseMove,
}: DraggableNoteCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: note.id,
      data: note,
      disabled: false,
    });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isSelectionMode
        ? {}
        : {
            ...attributes,
            onMouseDown: (e: React.MouseEvent) => {
              onMouseDown?.(e);
              (listeners as { onMouseDown?: (e: React.MouseEvent) => void })
                ?.onMouseDown?.(e);
            },
            onMouseMove: (e: React.MouseEvent) => {
              onMouseMove?.(e);
              (listeners as { onMouseMove?: (e: React.MouseEvent) => void })
                ?.onMouseMove?.(e);
            },
            onMouseUp: (e: React.MouseEvent) => {
              onMouseUp?.();
              (listeners as { onMouseUp?: (e: React.MouseEvent) => void })
                ?.onMouseUp?.(e);
            },
          })}
      data-note-card
      className={cn(
        "relative h-36 p-4 rounded-xl border flex flex-col justify-between transition-all select-none cursor-pointer touch-pan-y",
        isSelected
          ? "bg-accent border-blue-500 shadow-[0_0_0_1px_#3b82f6]"
          : "bg-card border-border active:scale-95",
        note.is_deleted && "opacity-70 grayscale border-dashed",
        note.is_pinned && !note.is_deleted && "border-l-4 border-l-yellow-500 bg-yellow-500/5"
      )}
      onTouchStart={(e: React.TouchEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onTouchStart?.(e);
      }}
      onTouchEnd={(e: React.TouchEvent) => {
        e.stopPropagation();
        onTouchEnd?.(e);
      }}
      onTouchMove={(e: React.TouchEvent) => {
        e.stopPropagation();
        onTouchMove?.(e);
      }}
      onClick={onClick}
    >
      <div>
        <h3
          className={cn(
            "font-bold text-sm mb-1 truncate flex items-center gap-1",
            !note.title && "text-muted-foreground italic"
          )}
        >
          {note.is_pinned && (
            <Pin className="w-3 h-3 text-yellow-600 fill-yellow-600 rotate-45" />
          )}
          {note.title || "无标题"}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
          {note.content || "点击编辑内容..."}
        </p>
        {note.tags && (
          <div className="mt-1 flex flex-wrap gap-1">
            {note.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
              .map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 rounded-full bg-accent/60 text-[10px] text-accent-foreground"
                >
                  #{t}
                </span>
              ))}
          </div>
        )}
      </div>
      <div className="flex justify-between items-center mt-2">
        <span className="text-[10px] text-muted-foreground">
          {new Date(note.updated_at ?? "").toLocaleDateString()}
        </span>
        {isSelectionMode ? (
          <div
            className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center",
              isSelected ? "bg-blue-500" : "border-2 border-zinc-400"
            )}
          >
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </div>
        ) : (
          <div className="flex gap-1">
            {note.is_published && (
              <Globe className="w-3 h-3 text-blue-400" />
            )}
            {note.is_deleted ? (
              <Trash2 className="w-3 h-3 text-red-400/50" />
            ) : (
              <FileText className="w-3 h-3 text-muted-foreground/30" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface DroppableDockItemProps {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  variant?: "default" | "destructive" | "pinned";
  isActive?: boolean;
}

function DroppableDockItem({
  id,
  icon: Icon,
  label,
  disabled,
  onClick,
  variant = "default",
  isActive = false,
}: DroppableDockItemProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const isDestructive = variant === "destructive";
  const isPinnedStyle = variant === "pinned";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col items-center gap-1 transition-all",
        disabled ? "opacity-30 grayscale cursor-not-allowed" : "cursor-pointer",
        isOver ? "scale-125 -translate-y-2" : "hover:scale-110"
      )}
      onClick={disabled ? undefined : onClick}
    >
      <div
        className={cn(
          "p-2 rounded-lg transition-colors",
          isOver
            ? isDestructive
              ? "bg-red-500 text-white shadow-lg shadow-red-500/50"
              : "bg-blue-500 text-white shadow-lg shadow-blue-500/50"
            : isDestructive
              ? "bg-red-500/10 text-red-500"
              : isPinnedStyle && isActive
                ? "bg-yellow-100 text-yellow-600"
                : "bg-accent text-foreground"
        )}
      >
        <Icon className={cn("w-5 h-5", isActive && isPinnedStyle && "fill-current rotate-45")} />
      </div>
      <span
        className={cn("text-[10px]", isOver ? "font-bold" : "text-muted-foreground")}
      >
        {label}
      </span>
    </div>
  );
}

export interface NoteListProps {
  folderName: string;
  showTrash: boolean;
  setShowTrash: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  notes: Note[];
  subFolders: FolderItem[];
  filteredNotes: Note[];
  filteredSubFolders: FolderItem[];
  selectedIds: Set<string>;
  isSelectionMode: boolean;
  activeId: string | null;
  allSelectedPinned: boolean;
  onBack: () => void;
  onAddFolder: () => void;
  onAddNote: () => void;
  onFolderClick: (folder: FolderItem) => void;
  onNoteClick: (note: Note) => void;
  onTouchStart: (id: string, e?: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onMouseDown: (id: string, e?: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  exitSelectionMode: () => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onRestore: () => void;
  onDelete: () => void;
  onRename: () => void;
  onMoveSubfoldersClick: () => void;
  onPin: () => void;
  onCopy: () => void;
  sensors: ReturnType<typeof useSensors>;
}

export function NoteList({
  folderName,
  showTrash,
  setShowTrash,
  searchQuery,
  setSearchQuery,
  notes,
  subFolders,
  filteredNotes,
  filteredSubFolders,
  selectedIds,
  isSelectionMode,
  activeId,
  allSelectedPinned,
  onBack,
  onAddFolder,
  onAddNote,
  onFolderClick,
  onNoteClick,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  exitSelectionMode,
  onDragStart,
  onDragEnd,
  onRestore,
  onDelete,
  onRename,
  onMoveSubfoldersClick,
  onPin,
  onCopy,
  sensors,
}: NoteListProps) {
  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div
        className="flex flex-col h-[calc(100dvh-6rem)] max-h-[calc(100dvh-6rem)] min-h-0"
        onClick={(e) => {
          if (e.target === e.currentTarget && isSelectionMode) exitSelectionMode();
        }}
      >
        <header className="shrink-0 bg-background/80 backdrop-blur z-10 border-b border-border/40">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="-ml-2 min-w-10 min-h-10 touch-manipulation shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-base sm:text-lg font-bold truncate flex-1 min-w-0">
                {showTrash ? "回收站" : folderName}
              </h1>
              {!showTrash && (
                <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full shrink-0 hidden sm:inline">
                  {subFolders.length > 0 && `${subFolders.length} 文件夹 `}
                  {notes.length} 笔记
                </span>
              )}
              {showTrash && (
                <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full shrink-0 hidden sm:inline">
                  {notes.length}
                </span>
              )}
            </div>
            <div className="flex gap-2 items-center shrink-0">
              <Button
                variant={showTrash ? "destructive" : "ghost"}
                size="sm"
                onClick={() => {
                  setShowTrash(!showTrash);
                }}
                className="sm:inline hidden"
              >
                {showTrash ? (
                  <ArrowLeft size={14} />
                ) : (
                  <Trash2 size={18} className="text-muted-foreground hover:text-red-500 transition" />
                )}
                {showTrash && (
                  <span className="sm:inline hidden ml-1">返回笔记</span>
                )}
              </Button>
              <Button
                variant={showTrash ? "destructive" : "ghost"}
                size="icon"
                onClick={() => setShowTrash(!showTrash)}
                className="sm:hidden"
              >
                {showTrash ? (
                  <ArrowLeft size={18} />
                ) : (
                  <Trash2 size={18} className="text-muted-foreground hover:text-red-500 transition" />
                )}
              </Button>
              {!showTrash && !isSelectionMode && (
                <>
                  <Button
                    size="sm"
                    onClick={onAddFolder}
                    variant="outline"
                    className="sm:inline hidden"
                  >
                    <Folder className="w-4 h-4 sm:mr-1" />
                    <span className="sm:inline hidden">新文件夹</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={onAddNote}
                    variant="outline"
                    className="sm:inline hidden"
                  >
                    <Plus className="w-4 h-4 sm:mr-1" />
                    <span className="sm:inline hidden">新笔记</span>
                  </Button>
                  <Button
                    size="icon"
                    onClick={onAddFolder}
                    variant="outline"
                    className="sm:hidden"
                  >
                    <Folder className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={onAddNote}
                    variant="outline"
                    className="sm:hidden"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={showTrash ? "搜索回收站..." : "搜索笔记..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-accent/50 border-none h-9"
              />
            </div>
          </div>
        </header>

        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pb-32"
          style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          onClick={(e) => {
            if (!isSelectionMode) return;
            const target = e.target as HTMLElement;
            if (
              target.closest("[data-note-card]") ||
              target.closest("[data-subfolder-card]")
            ) {
              return;
            }
            exitSelectionMode();
          }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-3 p-3 sm:p-4">
            {!showTrash &&
              filteredSubFolders.map((folder) => {
                const isSelected = selectedIds.has(folder.id);
                return (
                  <div
                    key={folder.id}
                    data-subfolder-card
                    className={cn(
                      "relative h-36 p-4 rounded-xl border flex flex-col justify-between transition-all select-none cursor-pointer touch-pan-y",
                      isSelected
                        ? "bg-accent border-blue-500 shadow-[0_0_0_1px_#3b82f6]"
                        : "bg-card border-border hover:bg-accent/50 active:scale-95"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFolderClick(folder);
                    }}
                    onTouchStart={(e: React.TouchEvent) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onTouchStart(folder.id, e);
                    }}
                    onTouchMove={(e: React.TouchEvent) => {
                      e.stopPropagation();
                      onTouchMove(e);
                    }}
                    onTouchEnd={(e: React.TouchEvent) => {
                      e.stopPropagation();
                      onTouchEnd();
                    }}
                    onMouseDown={(e: React.MouseEvent) => {
                      if (!isSelectionMode) {
                        e.stopPropagation();
                        onTouchStart(folder.id);
                      }
                    }}
                    onMouseUp={() => onTouchEnd()}
                    onMouseLeave={() => {}}
                  >
                    <div>
                      <h3 className="font-bold text-sm mb-1 truncate flex items-center gap-1">
                        <Folder
                          className={cn(
                            "w-4 h-4",
                            isSelected
                              ? "text-blue-500 fill-blue-500/20"
                              : "text-yellow-500 fill-yellow-500/20"
                          )}
                        />
                        {folder.name || "无名称"}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        文件夹
                      </p>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-muted-foreground">
                        {folder.created_at
                          ? new Date(folder.created_at).toLocaleDateString()
                          : ""}
                      </span>
                      {isSelectionMode ? (
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center",
                            isSelected ? "bg-blue-500" : "border-2 border-zinc-400"
                          )}
                        >
                          {isSelected && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                      ) : (
                        <Folder className="w-3 h-3 text-muted-foreground/30" />
                      )}
                    </div>
                  </div>
                );
              })}

            {filteredNotes.length === 0 &&
              filteredSubFolders.length === 0 &&
              !showTrash && (
                <div className="col-span-2 text-center py-10 text-muted-foreground border-2 border-dashed border-border rounded-xl flex flex-col items-center gap-2">
                  {searchQuery ? <p>未找到相关内容</p> : <p>这里空空如也</p>}
                </div>
              )}
            {filteredNotes.length === 0 &&
              filteredSubFolders.length === 0 &&
              showTrash && (
                <div className="col-span-2 text-center py-10 text-muted-foreground border-2 border-dashed border-border rounded-xl flex flex-col items-center gap-2">
                  <p>回收站是空的</p>
                </div>
              )}
            {filteredNotes.map((note) => (
              <DraggableNoteCard
                key={note.id}
                note={note}
                isSelected={selectedIds.has(note.id)}
                isSelectionMode={isSelectionMode}
                onClick={() => onNoteClick(note)}
                onTouchStart={(e: React.TouchEvent) => onTouchStart(note.id, e)}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onMouseDown={(e: React.MouseEvent) => onMouseDown(note.id, e)}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
              />
            ))}
          </div>
          {!showTrash && (
            <div className="shrink-0 px-4 py-2 text-center border-t border-border/40 sm:hidden">
              <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full">
                {subFolders.length > 0 && `${subFolders.length} 文件夹 `}
                {notes.length} 笔记
              </span>
            </div>
          )}
          {showTrash && (
            <div className="shrink-0 px-4 py-2 text-center border-t border-border/40 sm:hidden">
              <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full">
                {notes.length}
              </span>
            </div>
          )}
        </div>

        <div
          className={cn(
            "fixed left-0 right-0 flex justify-center z-50 transition-all duration-300",
            "bottom-[calc(2rem+env(safe-area-inset-bottom,0px)+var(--vv-bottom-inset,0px))]",
            isSelectionMode
              ? "translate-y-0 opacity-100"
              : "translate-y-20 opacity-0 pointer-events-none"
          )}
        >
          <div className="relative bg-background/90 backdrop-blur-md border border-border px-4 sm:px-8 py-3 rounded-2xl shadow-2xl flex items-center gap-4 sm:gap-8">
            <button
              onClick={(e) => {
                e.stopPropagation();
                exitSelectionMode();
              }}
              className="absolute -top-3 -right-3 w-6 h-6 bg-muted rounded-full flex items-center justify-center border border-border shadow-md"
            >
              <X className="w-3 h-3" />
            </button>

            {showTrash ? (
              <>
                <DroppableDockItem
                  id="dock-restore"
                  icon={RotateCcw}
                  label="还原"
                  onClick={onRestore}
                />
                <DroppableDockItem
                  id="dock-delete"
                  icon={Trash2}
                  label="彻底删除"
                  variant="destructive"
                  onClick={onDelete}
                />
              </>
            ) : (
              <>
                <div
                  className={cn(
                    "flex flex-col items-center gap-1 transition-all",
                    selectedIds.size === 1
                      ? "cursor-pointer hover:scale-110"
                      : "opacity-30 grayscale cursor-not-allowed"
                  )}
                  onClick={onRename}
                >
                  <div className="p-2 bg-accent rounded-lg">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <span className="text-[10px]">重命名</span>
                </div>

                <DroppableDockItem
                  id="dock-move-subfolder"
                  icon={FolderInput}
                  label="移动"
                  disabled={selectedIds.size === 0}
                  onClick={onMoveSubfoldersClick}
                />
                <DroppableDockItem
                  id="dock-pin"
                  icon={Pin}
                  label={allSelectedPinned ? "取消置顶" : "置顶"}
                  variant="pinned"
                  isActive={allSelectedPinned}
                  onClick={onPin}
                />
                <DroppableDockItem
                  id="dock-copy"
                  icon={Copy}
                  label="复制"
                  disabled={selectedIds.size > 1}
                  onClick={onCopy}
                />
                <DroppableDockItem
                  id="dock-delete"
                  icon={Trash2}
                  label="删除"
                  variant="destructive"
                  onClick={onDelete}
                />
              </>
            )}
          </div>
        </div>
        <DragOverlay>
          {activeId ? (
            <div className="w-40 h-24 bg-accent/90 backdrop-blur border border-blue-500 rounded-xl shadow-2xl p-4 flex flex-col justify-center items-center rotate-3">
              <FileText className="w-8 h-8 text-blue-500 mb-2" />
              <span className="text-xs font-bold">
                {selectedIds.size > 1
                  ? `已选择 ${selectedIds.size} 项`
                  : "移动中..."}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
