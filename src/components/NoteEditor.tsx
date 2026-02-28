"use client";

/**
 * 编辑态 UI：标题、标签、SegmentedEditor、预览/禅模式、工具栏、链接/标签补全、版本历史入口、撤回、底部栏。
 * 状态与保存/Realtime 由 NoteManager 通过 props 传入并协调。
 */
import { useRef } from "react";
import { createPortal } from "react-dom";
import {
  Trash2,
  ArrowLeft,
  CheckCircle2,
  Pencil,
  Eye,
  PenLine,
  Loader2,
  X,
  Pin,
  Image as ImageIcon,
  Globe,
  Maximize2,
  Minimize2,
  MoreVertical,
  WifiOff,
  RotateCcw,
  History,
  Table,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import NoteStats from "@/components/NoteStats";
import FindReplaceDialog from "@/components/FindReplaceDialog";
import SegmentedEditor from "@/components/SegmentedEditor";
import { cn } from "@/lib/utils";
import type { Note } from "@/types/note";
import type { Match } from "@/lib/search-utils";

export type SaveStatus = "saved" | "saving" | "error" | "unsaved";

export interface NoteEditorProps {
  title: string;
  content: string;
  tags: string[];
  tagInput: string;
  zenMode: boolean;
  previewMode: boolean;
  saveStatus: SaveStatus;
  isPinned: boolean;
  isPublished: boolean;
  isOnlineState: boolean;
  wordStats: { words: number; paragraphs: number; readingTime: number };
  moreMenuOpen: boolean;
  menuPosition: { top: number; right: number };
  isFindReplaceOpen: boolean;
  findReplaceMode: "find" | "replace";
  matches: Match[];
  currentMatchIndex: number;
  linkMenuOpen: boolean;
  linkQuery: string;
  linkInsertStart: number | null;
  linkCursorPos: number | null;
  linkActiveIndex: number;
  linkCandidates: Note[];
  tagMenuOpen: boolean;
  tagQuery: string;
  tagInsertStart: number | null;
  tagCursorPos: number | null;
  tagActiveIndex: number;
  tagCandidates: string[];
  isMobileWritingMode: boolean;
  currentNote: Note | null;
  canRevert: boolean;
  setTitle: (v: string) => void;
  setContent: (v: string) => void;
  setTags: (v: string[] | ((prev: string[]) => string[])) => void;
  setTagInput: (v: string) => void;
  setZenMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  setPreviewMode: (v: boolean) => void;
  setMoreMenuOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setMenuPosition: (v: { top: number; right: number }) => void;
  setIsFindReplaceOpen: (v: boolean) => void;
  setFindReplaceMode: (v: "find" | "replace") => void;
  /** 链接补全由 useLinkComplete 管理时可省略 */
  setLinkMenuOpen?: (v: boolean) => void;
  setLinkQuery?: (v: string) => void;
  setLinkInsertStart?: (v: number | null) => void;
  setLinkCursorPos?: (v: number | null) => void;
  setLinkActiveIndex?: (v: number) => void;
  /** 标签补全由 useTagComplete 管理时可省略 */
  setTagMenuOpen?: (v: boolean) => void;
  setTagQuery?: (v: string) => void;
  setTagInsertStart?: (v: number | null) => void;
  setTagCursorPos?: (v: number | null) => void;
  setTagActiveIndex?: (v: number) => void;
  onBack: () => void;
  saveNote: (
    title: string,
    content: string,
    pinned: boolean,
    published: boolean,
    tags: string[],
    showToast?: boolean
  ) => Promise<void>;
  onContentChange: (newTitle: string, newContent: string) => void;
  onSegmentedEditorChange: (newContent: string) => void;
  onInsertTable: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  togglePin: () => void;
  togglePublish: () => void;
  onDeleteCurrentNote: () => void;
  onRevertToLastSaved: () => void;
  onOpenVersionHistory: () => void;
  onFind: (newMatches: Match[], newIndex: number) => void;
  onReplace: (newText: string, nextMatchIndex: number) => void;
  onReplaceAll: (newText: string) => void;
  onInsertLink: (noteToLink: Note) => void;
  onInsertTag: (tag: string) => void;
  onTagsChangeWithSave: (newTags: string[]) => void;
  /** 移动端点击「完成」时调用（保存并退出写作模式） */
  onExitMobileWritingMode?: () => void;
  /** 由 NoteManager 传入，用于保存/恢复滚动位置 */
  editorScrollContainerRef: React.RefObject<HTMLDivElement | null>;
  savedScrollTopRef: React.MutableRefObject<number>;
  /** 由 NoteManager 传入，用于点击外部关闭更多菜单 */
  moreMenuRef?: React.RefObject<HTMLDivElement | null>;
  moreButtonRef?: React.RefObject<HTMLButtonElement | null>;
  moreMenuPortalRef?: React.RefObject<HTMLDivElement | null>;
  /** 由 NoteManager 传入，用于快捷键触发图片上传 */
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function NoteEditor(props: NoteEditorProps) {
  const {
    title,
    content,
    tags,
    tagInput,
    zenMode,
    previewMode,
    saveStatus,
    isPinned,
    isPublished,
    isOnlineState,
    wordStats,
    moreMenuOpen,
    menuPosition,
    isFindReplaceOpen,
    findReplaceMode,
    matches,
    currentMatchIndex,
    linkMenuOpen,
    linkCandidates,
    linkActiveIndex,
    tagMenuOpen,
    tagCandidates,
    tagActiveIndex,
    isMobileWritingMode,
    currentNote,
    canRevert,
    setTitle,
    setTags,
    setTagInput,
    setZenMode,
    setPreviewMode,
    setMoreMenuOpen,
    setMenuPosition,
    setIsFindReplaceOpen,
    setFindReplaceMode,
    setLinkMenuOpen,
    setLinkQuery,
    setLinkInsertStart,
    setLinkCursorPos,
    setLinkActiveIndex,
    setTagMenuOpen,
    setTagQuery,
    setTagInsertStart,
    setTagCursorPos,
    setTagActiveIndex,
    onBack,
    saveNote,
    onContentChange,
    onSegmentedEditorChange,
    onInsertTable,
    onImageUpload,
    togglePin,
    togglePublish,
    onDeleteCurrentNote,
    onRevertToLastSaved,
    onOpenVersionHistory,
    onFind,
    onReplace,
    onReplaceAll,
  onInsertLink,
  onInsertTag,
  onTagsChangeWithSave,
  onExitMobileWritingMode,
  editorScrollContainerRef,
  savedScrollTopRef,
  moreMenuRef: moreMenuRefProp,
  moreButtonRef: moreButtonRefProp,
  moreMenuPortalRef: moreMenuPortalRefProp,
  fileInputRef: fileInputRefProp,
  } = props;

  const localFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = fileInputRefProp ?? localFileInputRef;
  const localMoreMenuRef = useRef<HTMLDivElement>(null);
  const localMoreButtonRef = useRef<HTMLButtonElement>(null);
  const localMoreMenuPortalRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = moreMenuRefProp ?? localMoreMenuRef;
  const moreButtonRef = moreButtonRefProp ?? localMoreButtonRef;
  const moreMenuPortalRef = moreMenuPortalRefProp ?? localMoreMenuPortalRef;

  return (
    <>
      <div
        className={cn(
          "fixed left-0 right-0 top-0 bg-background z-50 flex flex-col",
          "animate-in fade-in-0 slide-in-from-bottom-4 duration-300 ease-out",
          zenMode && "bg-background"
        )}
        style={{
          height: "var(--vvh, 100dvh)",
          transform: "translateY(var(--vv-offset-top, 0px))",
        }}
      >
        <header
          className={cn(
            "px-2 sm:px-4 h-14 flex items-center justify-between border-b border-border/50 bg-background/50 backdrop-blur shrink-0",
            zenMode && "bg-background border-b border-border/40"
          )}
        >
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (saveStatus === "unsaved") {
                  saveNote(title, content, isPinned, isPublished, tags);
                }
                setTimeout(() => onBack(), 100);
              }}
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-1" />
              <span className="hidden sm:inline">返回</span>
            </Button>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide flex-1 justify-end min-w-0">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={onImageUpload}
            />
            {!zenMode && (
              <>
                <div className="hidden sm:flex items-center gap-1 px-1.5 py-1 rounded-md bg-accent/30 border border-border/50">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 hover:bg-accent/80 transition-all"
                    title="插入表格"
                    onClick={onInsertTable}
                  >
                    <Table className="w-4 h-4 text-foreground/70 hover:text-foreground transition-colors" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 hover:bg-accent/80 transition-all"
                    title="插入图片"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="w-4 h-4 text-foreground/70 hover:text-foreground transition-colors" />
                  </Button>
                </div>
                <div className="hidden sm:flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 hover:bg-accent transition-all"
                    onClick={togglePin}
                    title={isPinned ? "取消置顶" : "置顶笔记"}
                  >
                    <Pin
                      className={cn(
                        "w-4 h-4 transition-all",
                        isPinned
                          ? "fill-yellow-500 text-yellow-500 rotate-45"
                          : "text-foreground/60 hover:text-foreground"
                      )}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 hover:bg-accent transition-all"
                    onClick={togglePublish}
                    title={isPublished ? "已发布" : "发布到 Web"}
                  >
                    <Globe
                      className={cn(
                        "w-4 h-4 transition-all",
                        isPublished
                          ? "text-blue-500"
                          : "text-foreground/60 hover:text-foreground"
                      )}
                    />
                  </Button>
                </div>
                <div className="w-[1px] h-6 bg-border/60 mx-1 shrink-0 hidden sm:block" />
                <div className="hidden sm:flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 shrink-0 flex items-center gap-1.5 hover:bg-accent transition-all"
                    disabled={!canRevert}
                    onClick={onRevertToLastSaved}
                    title={!canRevert ? "无可撤回操作" : "撤回到上一步"}
                  >
                    <RotateCcw
                      className={cn(
                        "w-4 h-4 transition-colors",
                        canRevert ? "text-foreground/70" : "text-muted-foreground/50"
                      )}
                    />
                    <span className="text-xs font-medium">撤回</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 hover:bg-accent transition-all"
                    title="版本历史"
                    onClick={onOpenVersionHistory}
                  >
                    <History className="w-4 h-4 text-foreground/60 hover:text-foreground transition-colors" />
                  </Button>
                </div>
                <div className="w-[1px] h-6 bg-border/60 mx-1 shrink-0 hidden sm:block" />
                <div className="hidden sm:flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-all"
                    title="删除笔记"
                    onClick={onDeleteCurrentNote}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
            <div className="w-[1px] h-6 bg-border/60 mx-1 shrink-0 hidden sm:block" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 hidden sm:flex hover:bg-accent transition-all"
              title={zenMode ? "退出专注模式" : "进入专注模式"}
              onClick={() => setZenMode((v) => !v)}
            >
              {zenMode ? (
                <Minimize2 className="w-4 h-4 text-foreground/70 hover:text-foreground transition-colors" />
              ) : (
                <Maximize2 className="w-4 h-4 text-foreground/60 hover:text-foreground transition-colors" />
              )}
            </Button>
            <div className="relative sm:hidden" ref={moreMenuRef}>
              <button
                ref={moreButtonRef}
                type="button"
                className={cn(
                  "shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-full text-sm font-medium transition-all duration-150 ease-out bg-transparent hover:bg-accent/50 active:bg-accent active:scale-95 touch-manipulation min-w-[36px] min-h-[36px]",
                  moreMenuOpen && "bg-accent/60"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (moreButtonRef.current) {
                    const rect = moreButtonRef.current.getBoundingClientRect();
                    setMenuPosition({
                      top: rect.bottom + 8,
                      right: window.innerWidth - rect.right,
                    });
                  }
                  setMoreMenuOpen((prev) => !prev);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (moreButtonRef.current) {
                    const rect = moreButtonRef.current.getBoundingClientRect();
                    setMenuPosition({
                      top: rect.bottom + 8,
                      right: window.innerWidth - rect.right,
                    });
                  }
                  setMoreMenuOpen((prev) => !prev);
                }}
              >
                <MoreVertical
                  className={cn(
                    "w-5 h-5 transition-colors duration-150 text-foreground/80",
                    moreMenuOpen && "text-foreground"
                  )}
                />
              </button>
            </div>
            {moreMenuOpen &&
              typeof document !== "undefined" &&
              createPortal(
                <NoteEditorMoreMenu
                  zenMode={zenMode}
                  canRevert={canRevert}
                  isPinned={isPinned}
                  isPublished={isPublished}
                  moreMenuPortalRef={moreMenuPortalRef}
                  menuPosition={menuPosition}
                  setMoreMenuOpen={setMoreMenuOpen}
                  fileInputRef={fileInputRef}
                  onInsertTable={onInsertTable}
                  togglePin={togglePin}
                  togglePublish={togglePublish}
                  setFindReplaceMode={setFindReplaceMode}
                  setIsFindReplaceOpen={setIsFindReplaceOpen}
                  onRevertToLastSaved={onRevertToLastSaved}
                  onOpenVersionHistory={onOpenVersionHistory}
                  onDeleteCurrentNote={onDeleteCurrentNote}
                  setZenMode={setZenMode}
                />,
                document.body
              )}
            <div className="flex items-center gap-2 sm:gap-1.5 shrink-0">
              {!zenMode && (
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="shrink-0 flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/80 transition touch-manipulation"
                >
                  {previewMode ? (
                    <>
                      <PenLine size={12} className="sm:w-3.5 sm:h-3.5" />
                      <span className="hidden sm:inline">编辑</span>
                    </>
                  ) : (
                    <>
                      <Eye size={12} className="sm:w-3.5 sm:h-3.5" />
                      <span className="hidden sm:inline">预览</span>
                    </>
                  )}
                </button>
              )}
              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden sm:flex items-center gap-1.5">
                  {!isOnlineState ? (
                    <div
                      className="flex items-center gap-1.5 text-xs text-red-500 animate-in fade-in-0 duration-200"
                      title="离线模式 - 更改将保存到本地"
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <WifiOff className="w-3 h-3" />
                      <span>离线</span>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-1.5 text-xs text-green-500"
                      title="在线 - 更改将同步到云端"
                    >
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>在线</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs shrink-0">
                    {saveStatus === "saving" ? (
                      <div className="flex items-center gap-1.5 text-blue-500 animate-in fade-in-0 duration-200">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>保存中...</span>
                      </div>
                    ) : saveStatus === "error" ? (
                      <div className="flex items-center gap-1.5 text-red-500 animate-in fade-in-0 duration-200">
                        <X className="w-3.5 h-3.5 animate-in zoom-in-50 duration-200" />
                        <span>保存失败</span>
                      </div>
                    ) : saveStatus === "unsaved" ? (
                      <div className="flex items-center gap-1.5 text-yellow-500 animate-in fade-in-0 duration-200">
                        <Pencil className="w-3.5 h-3.5 animate-pulse" />
                        <span>未保存</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-green-500 animate-in fade-in-0 duration-200">
                        <CheckCircle2 className="w-3.5 h-3.5 animate-in zoom-in-50 duration-200" />
                        <span>已保存</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:hidden">
                  {!isOnlineState && (
                    <div
                      className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"
                      title="离线模式 - 更改将保存到本地"
                    />
                  )}
                  {saveStatus === "saving" ? (
                    <div title="保存中...">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
                    </div>
                  ) : saveStatus === "error" ? (
                    <div title="保存失败">
                      <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    </div>
                  ) : saveStatus === "unsaved" ? (
                    <div title="未保存">
                      <Pencil className="w-3.5 h-3.5 animate-pulse text-yellow-500 shrink-0" />
                    </div>
                  ) : null}
                </div>
              </div>
              {!zenMode && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                  <span className="hidden sm:inline">{wordStats.words} 字</span>
                  <span className="hidden md:inline">· {wordStats.paragraphs} 段</span>
                  <span className="hidden lg:inline">· 约 {wordStats.readingTime} 分钟</span>
                </div>
              )}
            </div>
          </div>
        </header>
        <div
          className={cn(
            "flex-1 mx-auto w-full flex flex-col overflow-y-auto min-h-0 pb-20 sm:pb-0",
            zenMode
              ? "max-w-4xl px-8 py-12"
              : "max-w-full sm:max-w-3xl md:max-w-4xl p-3 sm:p-4 md:p-8"
          )}
        >
          {isFindReplaceOpen && (
            <FindReplaceDialog
              isOpen={isFindReplaceOpen}
              onClose={() => setIsFindReplaceOpen(false)}
              text={content}
              cursorPosition={0}
              onFind={onFind}
              onReplace={onReplace}
              onReplaceAll={onReplaceAll}
              mode={findReplaceMode}
            />
          )}
          <div className="relative group">
            <Input
              value={title}
              onChange={(e) => {
                const newTitle = e.target.value;
                onContentChange(newTitle, content);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  requestAnimationFrame(() => {
                    const firstTextarea = editorScrollContainerRef.current?.querySelector("textarea");
                    if (firstTextarea) {
                      (firstTextarea as HTMLTextAreaElement).focus();
                    }
                  });
                }
              }}
              placeholder="无标题"
              className={cn(
                "border-none shadow-none px-0 focus-visible:ring-0 bg-transparent h-auto transition-all duration-200 relative",
                zenMode ? "text-4xl md:text-5xl font-bold py-6" : "text-3xl md:text-4xl font-bold py-4",
                previewMode && "opacity-80 pointer-events-none",
                title.startsWith("# ") && "text-2xl md:text-3xl",
                title.startsWith("## ") && "text-xl md:text-2xl",
                title.startsWith("### ") && "text-lg md:text-xl"
              )}
            />
            <div
              className={cn(
                "absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-200 w-0 opacity-0 group-focus-within:w-full group-focus-within:opacity-100"
              )}
            />
          </div>
          {!zenMode && !isMobileWritingMode && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="flex items-center gap-1 rounded-full bg-accent text-accent-foreground px-2 py-0.5 text-xs hover:bg-accent/80"
                  onClick={() => {
                    const arr = tags.filter((t) => t !== tag);
                    onTagsChangeWithSave(arr);
                  }}
                >
                  <span>#{tag}</span>
                  <X className="w-3 h-3" />
                </button>
              ))}
              <input
                className="min-w-[80px] flex-1 bg-transparent border-none outline-none text-xs text-muted-foreground placeholder:text-muted-foreground/70"
                placeholder={tags.length === 0 ? "添加标签，回车确认（例如：#项目 / #想法）" : "继续添加标签..."}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const raw = tagInput.trim();
                    if (!raw) return;
                    const parts = raw.split(/[，,]/).map((p) => p.trim());
                    const next = Array.from(new Set([...tags, ...parts.filter(Boolean)]));
                    onTagsChangeWithSave(next);
                    setTagInput("");
                  }
                }}
              />
            </div>
          )}
          {previewMode ? (
            <div className="flex-1 mt-4 animate-in fade-in duration-200">
              <MarkdownRenderer content={content} />
              <div className="h-20" />
            </div>
          ) : (
            <div
              className={cn(
                "relative mt-4 flex flex-col",
                typeof window !== "undefined" && window.innerWidth < 768
                  ? "h-[calc(100dvh-14rem)]"
                  : "flex-1 min-h-0"
              )}
            >
              <div
                ref={editorScrollContainerRef}
                className={cn(
                  "overflow-y-auto",
                  typeof window !== "undefined" && window.innerWidth < 768 ? "h-full" : "flex-1 min-h-0"
                )}
                style={
                  {
                    scrollPaddingBottom:
                      "calc(120px + env(safe-area-inset-bottom, 0px) + var(--vv-bottom-inset, 0px))",
                    WebkitOverflowScrolling: "touch",
                  } as React.CSSProperties
                }
                onScroll={(e) => {
                  if (e.currentTarget) savedScrollTopRef.current = e.currentTarget.scrollTop;
                }}
                onBlur={(e) => {
                  const next = e.relatedTarget as Node | null;
                  if (next && e.currentTarget.contains(next)) return;
                  if (editorScrollContainerRef.current)
                    savedScrollTopRef.current = editorScrollContainerRef.current.scrollTop;
                }}
              >
                <SegmentedEditor
                  content={content}
                  onChange={onSegmentedEditorChange}
                  placeholder="开始输入内容 (支持 Markdown，输入 [[ 以引用其他笔记)..."
                  className={cn(
                    "w-full min-h-[200px]",
                    zenMode
                      ? "text-lg leading-[1.75] tracking-[0.01em]"
                      : "text-base sm:text-lg leading-[1.75] tracking-[0.01em]"
                  )}
                  onInsertTable={onInsertTable}
                />
              </div>
              {linkMenuOpen && linkCandidates.length > 0 && (
                <div className="absolute left-0 top-full mt-2 w-full max-w-xs rounded-lg border border-border bg-popover shadow-lg z-10">
                  <div className="px-3 py-2 border-b border-border/60 text-xs text-muted-foreground">
                    选择要引用的笔记（↑↓ 选择，Enter 确认）
                  </div>
                  <ul className="max-h-64 overflow-y-auto text-sm">
                    {linkCandidates.map((n, idx) => (
                      <li
                        key={n.id}
                        className={cn(
                          "px-3 py-2 cursor-pointer hover:bg-accent",
                          idx === linkActiveIndex && "bg-accent"
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onInsertLink(n);
                        }}
                      >
                        <div className="font-medium truncate">{n.title || "未命名笔记"}</div>
                        {n.content && (
                          <div className="text-xs text-muted-foreground line-clamp-1">{n.content}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tagMenuOpen && tagCandidates.length > 0 && (
                <div className="absolute left-0 top-full mt-2 w-full max-w-xs rounded-lg border border-border bg-popover shadow-lg z-10">
                  <div className="px-3 py-2 border-b border-border/60 text-xs text-muted-foreground">
                    选择标签（↑↓ 选择，Enter 确认）
                  </div>
                  <ul className="max-h-64 overflow-y-auto text-sm">
                    {tagCandidates.map((tag, idx) => (
                      <li
                        key={tag}
                        className={cn(
                          "px-3 py-2 cursor-pointer hover:bg-accent",
                          idx === tagActiveIndex && "bg-accent"
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onInsertTag(tag);
                        }}
                      >
                        <div className="font-medium truncate">#{tag}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {currentNote && !isMobileWritingMode && (
                <NoteStats
                  content={content}
                  createdAt={currentNote.created_at ?? undefined}
                  updatedAt={currentNote.updated_at ?? undefined}
                />
              )}
            </div>
          )}
        </div>
      </div>
      {/* 移动端底部工具栏 */}
      {isMobileWritingMode ? (
        <button
          onClick={() => {
            if (saveStatus === "unsaved") {
              saveNote(title, content, isPinned, isPublished, tags);
            }
            onExitMobileWritingMode?.();
          }}
          className={cn(
            "fixed bottom-4 right-4 z-50 sm:hidden rounded-full shadow-lg touch-manipulation px-4 py-3 flex items-center gap-2 text-sm font-medium",
            saveStatus === "unsaved"
              ? "bg-primary text-primary-foreground"
              : "bg-accent/90 text-accent-foreground"
          )}
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {saveStatus === "saving" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveStatus === "saved" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Pencil className="w-4 h-4" />
          )}
          <span>{saveStatus === "unsaved" ? "完成并保存" : "完成"}</span>
        </button>
      ) : (
        <div
          className="fixed bottom-0 left-0 right-0 sm:hidden z-50 bg-background/95 backdrop-blur-md border-t border-border shadow-lg safe-area-inset-bottom"
          style={{ bottom: "calc(0px + var(--vv-bottom-inset, 0px))" }}
        >
          <div
            className="flex items-center justify-around px-2 py-2 gap-1"
            style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <button
              onClick={() => {
                if (saveStatus === "unsaved") {
                  saveNote(title, content, isPinned, isPublished, tags);
                }
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all touch-manipulation min-w-[44px] min-h-[44px]",
                saveStatus === "unsaved" ? "bg-primary text-primary-foreground" : "bg-accent/50 text-accent-foreground"
              )}
              title="保存"
            >
              {saveStatus === "saving" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : saveStatus === "saved" ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Pencil className="w-5 h-5" />
              )}
              <span className="text-[10px] font-medium">保存</span>
            </button>
            {!zenMode && (
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all touch-manipulation min-w-[44px] min-h-[44px]",
                  previewMode ? "bg-primary text-primary-foreground" : "bg-accent/50 text-accent-foreground"
                )}
                title={previewMode ? "编辑" : "预览"}
              >
                {previewMode ? (
                  <PenLine className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
                <span className="text-[10px] font-medium">{previewMode ? "编辑" : "预览"}</span>
              </button>
            )}
            <button
              onClick={() => setZenMode(!zenMode)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all touch-manipulation min-w-[44px] min-h-[44px]",
                zenMode ? "bg-primary text-primary-foreground" : "bg-accent/50 text-accent-foreground"
              )}
              title={zenMode ? "退出专注" : "专注模式"}
            >
              {zenMode ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
              <span className="text-[10px] font-medium">专注</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (moreButtonRef.current) {
                  const rect = moreButtonRef.current.getBoundingClientRect();
                  setMenuPosition({
                    top: rect.top - 200,
                    right: window.innerWidth - rect.right,
                  });
                }
                setMoreMenuOpen((prev) => !prev);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all touch-manipulation min-w-[44px] min-h-[44px]",
                moreMenuOpen ? "bg-primary text-primary-foreground" : "bg-accent/50 text-accent-foreground"
              )}
              title="更多"
            >
              <MoreVertical className="w-5 h-5" />
              <span className="text-[10px] font-medium">更多</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** 移动端更多菜单弹出层 */
function NoteEditorMoreMenu({
  zenMode,
  canRevert,
  isPinned,
  isPublished,
  moreMenuPortalRef,
  menuPosition,
  setMoreMenuOpen,
  fileInputRef,
  onInsertTable,
  togglePin,
  togglePublish,
  setFindReplaceMode,
  setIsFindReplaceOpen,
  onRevertToLastSaved,
  onOpenVersionHistory,
  onDeleteCurrentNote,
  setZenMode,
}: {
  zenMode: boolean;
  canRevert: boolean;
  isPinned: boolean;
  isPublished: boolean;
  moreMenuPortalRef: React.RefObject<HTMLDivElement | null>;
  menuPosition: { top: number; right: number };
  setMoreMenuOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onInsertTable: () => void;
  togglePin: () => void;
  togglePublish: () => void;
  setFindReplaceMode: (v: "find" | "replace") => void;
  setIsFindReplaceOpen: (v: boolean) => void;
  onRevertToLastSaved: () => void;
  onOpenVersionHistory: () => void;
  onDeleteCurrentNote: () => void;
  setZenMode: (v: boolean | ((p: boolean) => boolean)) => void;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-[99998] bg-black/20 backdrop-blur-sm"
        onClick={() => setMoreMenuOpen(false)}
        onTouchEnd={() => setMoreMenuOpen(false)}
        aria-hidden
      />
      <div
        ref={moreMenuPortalRef}
        className={cn(
          "fixed z-[99999] py-2 w-56 rounded-2xl bg-popover/95 backdrop-blur-xl border border-border/40 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        )}
        style={{
          top: `${menuPosition.top}px`,
          right: `${Math.max(12, menuPosition.right)}px`,
          maxWidth: "calc(100vw - 24px)",
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {!zenMode && (
          <>
            <button
              className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 touch-manipulation transition-colors duration-150"
              onClick={() => {
                fileInputRef.current?.click();
                setMoreMenuOpen(false);
              }}
            >
              <ImageIcon className="w-4 h-4" />
              <span>插入图片</span>
            </button>
            <button
              className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 touch-manipulation transition-colors duration-150"
              onClick={() => {
                onInsertTable();
                setMoreMenuOpen(false);
              }}
            >
              <Table className="w-4 h-4" />
              <span>插入表格</span>
            </button>
            <button
              className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 touch-manipulation transition-colors duration-150"
              onClick={() => {
                togglePin();
                setMoreMenuOpen(false);
              }}
            >
              <Pin className={cn("w-4 h-4", isPinned ? "fill-yellow-500 text-yellow-500 rotate-45" : "")} />
              <span>{isPinned ? "取消置顶" : "置顶笔记"}</span>
            </button>
            <button
              className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 touch-manipulation transition-colors duration-150"
              onClick={() => {
                togglePublish();
                setMoreMenuOpen(false);
              }}
            >
              <Globe className={cn("w-4 h-4", isPublished ? "text-blue-500" : "")} />
              <span>{isPublished ? "取消发布" : "发布到 Web"}</span>
            </button>
            <div className="h-px bg-border/50 my-1.5 mx-2" />
            <button
              className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 touch-manipulation transition-colors duration-150"
              onClick={() => {
                setFindReplaceMode("find");
                setIsFindReplaceOpen(true);
                setMoreMenuOpen(false);
              }}
            >
              <Search className="w-4 h-4" />
              <span>查找与替换</span>
            </button>
            <div className="h-px bg-border/50 my-1.5 mx-2" />
          </>
        )}
        <button
          className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation transition-colors duration-150"
          disabled={!canRevert}
          onClick={() => {
            if (canRevert) onRevertToLastSaved();
            setMoreMenuOpen(false);
          }}
        >
          <RotateCcw className="w-4 h-4" />
          <span>撤回</span>
        </button>
        <button
          className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 touch-manipulation transition-colors duration-150"
          onClick={() => {
            onOpenVersionHistory();
            setMoreMenuOpen(false);
          }}
        >
          <History className="w-4 h-4" />
          <span>版本历史</span>
        </button>
        <div className="h-px bg-border/50 my-1.5 mx-2" />
        <button
          className="w-full px-4 py-3 text-left text-sm hover:bg-red-500/10 active:bg-red-500/20 text-red-500 flex items-center gap-3 touch-manipulation transition-colors duration-150"
          onClick={() => {
            onDeleteCurrentNote();
            setMoreMenuOpen(false);
          }}
        >
          <Trash2 className="w-4 h-4" />
          <span>删除笔记</span>
        </button>
        <button
          className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 touch-manipulation transition-colors duration-150"
          onClick={() => {
            setZenMode((v) => !v);
            setMoreMenuOpen(false);
          }}
        >
          {zenMode ? (
            <>
              <Minimize2 className="w-4 h-4" />
              <span>退出专注模式</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-4 h-4" />
              <span>进入专注模式</span>
            </>
          )}
        </button>
      </div>
    </>
  );
}
