"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
  Copy, Trash2, FolderInput, X, Check, Loader2, Plus, 
  FileText, ArrowLeft, CheckCircle2, Pencil, Eye, PenLine, 
  Search, RotateCcw, Pin, Image as ImageIcon, Globe, Maximize2, Minimize2, MoreVertical, WifiOff, Wifi, History, Table, Rows, Columns, AlignLeft
} from "lucide-react"; 
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { createNoteVersion, getNoteVersions, type NoteVersion } from "@/lib/version-history";
import { isOnline, onNetworkStatusChange, savePendingSyncNote, syncPendingNotes } from "@/lib/offline-storage";
import NoteStats from "@/components/NoteStats";
import FindReplaceDialog from "@/components/FindReplaceDialog";
import TableEditor from "@/components/TableEditor";
import SegmentedEditor from "@/components/SegmentedEditor";
import { type Match, findAllMatches } from "@/lib/search-utils";
import { detectTableAtCursor, addTableRow, addTableColumn, formatTable } from "@/lib/table-utils";

import { DndContext, DragOverlay, useDraggable, useDroppable, TouchSensor, MouseSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

interface NoteManagerProps {
  userId: string;
  folderId: string;
  folderName: string;
  onBack: () => void;
}

type SaveStatus = 'saved' | 'saving' | 'error' | 'unsaved';

// --- 拖拽卡片组件 ---
function DraggableNoteCard({ note, isSelected, isSelectionMode, onClick, onTouchStart, onTouchEnd, onTouchMove, onMouseDown, onMouseUp }: any) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: note.id,
        data: note,
        // 始终允许拖拽，具体操作依赖于 selectedIds 和 Dock
        disabled: false,
    });
    const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0 : 1 };
    
    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}
            className={cn(
                // 允许纵向滚动手势（避免滑动时被当作点击/选中）
                "relative h-36 p-4 rounded-xl border flex flex-col justify-between transition-all select-none cursor-pointer touch-pan-y", 
                isSelected ? "bg-accent border-blue-500 shadow-[0_0_0_1px_#3b82f6]" : "bg-card border-border active:scale-95",
                note.is_deleted && "opacity-70 grayscale border-dashed",
                note.is_pinned && !note.is_deleted && "border-l-4 border-l-yellow-500 bg-yellow-500/5"
            )}
            onTouchStart={onTouchStart} 
            onTouchEnd={onTouchEnd} 
            onTouchMove={onTouchMove}
            onMouseDown={onMouseDown} 
            onMouseUp={onMouseUp} 
            onClick={onClick}
        >
            <div>
                <h3 className={cn("font-bold text-sm mb-1 truncate flex items-center gap-1", !note.title && "text-muted-foreground italic")}>
                    {note.is_pinned && <Pin className="w-3 h-3 text-yellow-600 fill-yellow-600 rotate-45" />}
                    {note.title || "无标题"}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {note.content || "点击编辑内容..."}
                </p>
                {/* 标签预览 */}
                {((note as any).tags as string | null | undefined) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {((note as any).tags as string)
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
                <span className="text-[10px] text-muted-foreground">{new Date(note.updated_at).toLocaleDateString()}</span>
                {isSelectionMode ? (
                    <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", isSelected ? "bg-blue-500" : "border-2 border-zinc-400")}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                ) : (
                    <div className="flex gap-1">
                        {note.is_published && <Globe className="w-3 h-3 text-blue-400" />}
                        {note.is_deleted ? <Trash2 className="w-3 h-3 text-red-400/50" /> : <FileText className="w-3 h-3 text-muted-foreground/30" />}
                    </div>
                )}
            </div>
        </div>
    );
}

// --- 底部 Dock 栏组件 ---
function DroppableDockItem({ id, icon: Icon, label, disabled, onClick, variant = "default", isActive = false }: any) {
    const { setNodeRef, isOver } = useDroppable({ id });
    const isDestructive = variant === "destructive";
    const isPinnedStyle = variant === "pinned"; // 🔥 特殊样式

    return (
        <div ref={setNodeRef} className={cn("flex flex-col items-center gap-1 transition-all", disabled ? "opacity-30 grayscale cursor-not-allowed" : "cursor-pointer", isOver ? "scale-125 -translate-y-2" : "hover:scale-110")} onClick={onClick}>
            <div className={cn(
                "p-2 rounded-lg transition-colors", 
                isOver 
                    ? (isDestructive ? "bg-red-500 text-white shadow-lg shadow-red-500/50" : "bg-blue-500 text-white shadow-lg shadow-blue-500/50") 
                    : (isDestructive ? "bg-red-500/10 text-red-500" : (isPinnedStyle && isActive ? "bg-yellow-100 text-yellow-600" : "bg-accent text-foreground"))
            )}>
                <Icon className={cn("w-5 h-5", isActive && isPinnedStyle && "fill-current rotate-45")} />
            </div>
            <span className={cn("text-[10px]", isOver ? "font-bold" : "text-muted-foreground")}>{label}</span>
        </div>
    );
}

// --- 主组件 ---
export default function NoteManager({ userId, folderId, folderName, onBack }: NoteManagerProps) {
  const { toast } = useToast();
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 编辑器状态
  const [currentNote, setCurrentNote] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  // 撤回栈：记录之前的编辑状态（多步撤回）
  const [undoStack, setUndoStack] = useState<{ title: string; content: string }[]>([]);
  const lastChangeTimeRef = useRef<number | null>(null);
  const [zenMode, setZenMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [isPinned, setIsPinned] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isOnlineState, setIsOnlineState] = useState(true); // 网络状态
  
  // 实时同步相关状态
  const [cloudUpdateDialogOpen, setCloudUpdateDialogOpen] = useState(false);
  const [cloudUpdateNote, setCloudUpdateNote] = useState<any>(null);
  const [refreshConfirmDialogOpen, setRefreshConfirmDialogOpen] = useState(false); // 刷新确认对话框
  const [deleteNoteDialogOpen, setDeleteNoteDialogOpen] = useState(false); // 删除笔记确认对话框
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false); // 批量删除确认对话框
  const [renameDialogOpen, setRenameDialogOpen] = useState(false); // 重命名对话框
  const [renameNoteId, setRenameNoteId] = useState<string | null>(null); // 待重命名的笔记ID
  const [renameInput, setRenameInput] = useState(""); // 重命名输入框
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null); // 待删除的笔记ID
  const lastSavedTimestampRef = useRef<string | null>(null); // 记录最后一次保存的时间戳（服务器返回）
  const realtimeChannelRef = useRef<any>(null); // Realtime 订阅通道
  const isSavingRef = useRef<boolean>(false); // 标记是否正在保存（用于忽略自己的更新事件）
  const lastSaveTimeRef = useRef<number>(0); // 记录最后一次保存的时间（毫秒时间戳）
  const pendingSelfUpdateRef = useRef<string | null>(null); // 记录一次自更新的 updated_at，用于首次实时事件直接忽略
  // 记录最近一次“自己保存”的内容指纹，帮助彻底过滤单设备误报
  const pendingSelfFingerprintRef = useRef<string | null>(null);
  // 记录最近若干次自己保存（key: updated_at, value: fingerprint）
  const recentSelfUpdatesRef = useRef<Map<string, string>>(new Map());

  const buildNoteFingerprint = useCallback((data: {
    title?: string | null;
    content?: string | null;
    tags?: string | null;
    is_pinned?: boolean | null;
    is_published?: boolean | null;
  }) => {
    const t = (data.title ?? "").trim();
    const c = data.content ?? "";
    const tagsStr = (data.tags ?? "").trim();
    const pinned = data.is_pinned ? "1" : "0";
    const published = data.is_published ? "1" : "0";
    // 直接用拼接字符串做“指纹”（无需加密哈希，足够用于本地等值判断）
    return `${t}\n<<<TAGS>>>\n${tagsStr}\n<<<FLAGS>>>\n${pinned}${published}\n<<<CONTENT>>>\n${c}`;
  }, []);
  
  // 版本历史相关状态
  const [versionHistoryDialogOpen, setVersionHistoryDialogOpen] = useState(false);
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null);
  
  // 移动端更多菜单
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuPortalRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

  // 查找替换相关状态
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [findReplaceMode, setFindReplaceMode] = useState<"find" | "replace">("find");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [matches, setMatches] = useState<Match[]>([]);

  // 表格编辑器相关状态
  // SegmentedEditor 已内置表格编辑功能，不再需要 TableEditor 对话框状态

  // 多选与拖拽
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedIds.size > 0;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const ignoreClickRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const ignoreTapOnceRef = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 10 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showTrash, setShowTrash] = useState(false);

  // 右侧边缘左滑返回（移动端）
  useEffect(() => {
    if (typeof window === "undefined") return;

    const EDGE_WIDTH = 24; // 右侧边缘判定宽度
    const TRIGGER_DX = 70; // 触发返回的水平滑动距离
    const MAX_DY = 40; // 允许的最大竖向偏移，避免与上下滚动冲突

    let tracking = false;
    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      // 仅在“右侧边缘”开始的左滑手势才处理
      if (t.clientX < window.innerWidth - EDGE_WIDTH) return;
      tracking = true;
      startX = t.clientX;
      startY = t.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startX; // 左滑为负
      const dy = t.clientY - startY;
      // 竖向滚动为主则不触发
      if (Math.abs(dy) > MAX_DY) {
        tracking = false;
        return;
      }
      // 右侧边缘左滑达到阈值：触发返回
      if (dx < -TRIGGER_DX) {
        tracking = false;
        // editor -> list；list -> folder list
        if (view === "editor") {
          setView("list");
          fetchNotes();
        } else {
          onBack();
        }
      }
    };

    const onTouchEnd = () => {
      tracking = false;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart as any);
      window.removeEventListener("touchmove", onTouchMove as any);
      window.removeEventListener("touchend", onTouchEnd as any);
      window.removeEventListener("touchcancel", onTouchEnd as any);
    };
  }, [view, folderId, userId]);

  // --- [[ 自动补全 ---
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const editorScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const savedScrollTopRef = useRef<number>(0);
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkInsertStart, setLinkInsertStart] = useState<number | null>(null);
  const [linkCursorPos, setLinkCursorPos] = useState<number | null>(null);
  const [linkActiveIndex, setLinkActiveIndex] = useState(0);

  // --- 获取数据 ---
  const fetchNotes = async () => { 
      let query = supabase.from('notes')
          .select('*')
          .eq('user_id', userId)
          .eq('folder_id', folderId)
          .order('is_pinned', { ascending: false }) 
          .order('updated_at', { ascending: false });

      if (showTrash) {
          query = query.eq('is_deleted', true);
      } else {
          query = query.or('is_deleted.eq.false,is_deleted.is.null');
      }

      const { data } = await query;
      if (data) setNotes(data); 
      setLoading(false); 
      setSelectedIds(new Set());
  };

  useEffect(() => { if (userId && folderId && view === 'list') fetchNotes(); }, [userId, folderId, view, showTrash]);

  const filteredNotes = notes.filter(note => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const noteTags = ((note as any).tags as string | null | undefined)
        ?.split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean) || [];
      return (
        (note.title?.toLowerCase() || "").includes(q) ||
        (note.content?.toLowerCase() || "").includes(q) ||
        noteTags.some((t) => t.includes(q))
      );
  });
  
  // --- 编辑器操作 ---
  const enterEditor = (note: any) => { 
      setCurrentNote(note); 
      setTitle(note.title || ""); 
      setContent(note.content || ""); 
      // 解析 tags 字段（假设为以逗号分隔的字符串）
      const rawTags = (note as any).tags as string | null | undefined;
      if (rawTags) {
        setTags(
          rawTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        );
      } else {
        setTags([]);
      }
      // 初始化撤回栈：清空历史
      setUndoStack([]);
      setIsPinned(note.is_pinned || false); 
      setIsPublished(note.is_published || false);
      setSaveStatus('saved'); 
      setPreviewMode(false); 
      setView('editor');
      // 记录初始时间戳
      lastSavedTimestampRef.current = note.updated_at || new Date().toISOString();
  };

  const handleAddNote = async () => { const { data } = await supabase.from('notes').insert({ user_id: userId, folder_id: folderId, title: "", content: "" }).select().single(); if (data) enterEditor(data); };
  
  const saveNote = useCallback(async (currentTitle: string, currentContent: string, pinned: boolean, published: boolean, currentTags: string[]) => { 
      if (!currentNote) return; 
      setSaveStatus('saving'); 
      const now = new Date(); 
      const nowTimestamp = now.getTime();
      
      // 标记正在保存，忽略接下来的实时订阅事件（2秒内）
      isSavingRef.current = true;
      lastSaveTimeRef.current = nowTimestamp;
      
      let finalTitle = currentTitle;
      if (!finalTitle.trim()) {
          finalTitle = currentContent.split('\n')[0]?.replace(/[#*`]/g, '').trim().slice(0, 30) || "";
          setTitle(finalTitle); 
      }

      // 记录本次保存的预期“自更新指纹”，用于过滤 Realtime 回调中的同内容更新
      pendingSelfFingerprintRef.current = buildNoteFingerprint({
        title: finalTitle,
        content: currentContent,
        tags: currentTags.join(","),
        is_pinned: pinned,
        is_published: published,
      });

      const online = isOnline();
      let isNetworkError = false;

      // 如果在线，尝试直接保存到 Supabase
      if (online) {
        // 首次尝试：包含 tags 字段
        let { data: updatedRow, error } = await supabase
          .from("notes")
          .update({
            title: finalTitle,
            content: currentContent,
            is_pinned: pinned,
            is_published: published,
            // 标签作为逗号分隔字符串持久化到 tags 字段（需要在数据库中添加该列）
            tags: currentTags.join(","),
            updated_at: now.toISOString(),
          })
          .eq("id", currentNote.id)
          .select("updated_at")
          .single();

        // 检查是否是网络错误
        let retryData: { updated_at?: string } | null = null;
        if (error) {
          const errorMessage = error.message || String(error);
          isNetworkError = errorMessage.includes("Failed to fetch") || 
                          errorMessage.includes("ERR_INTERNET_DISCONNECTED") ||
                          errorMessage.includes("NetworkError") ||
                          errorMessage.includes("network");
        }

        // 如果后端还没有 tags 字段，降级为不更新 tags，避免整条更新失败
        if (error && !isNetworkError && typeof error.message === "string" && error.message.includes("column") && error.message.includes("tags")) {
          console.warn("[NoteManager] notes.tags 列不存在，将在无标签模式下保存笔记。");
          const retry = await supabase
            .from("notes")
            .update({
            title: finalTitle, 
            content: currentContent, 
            is_pinned: pinned,
            is_published: published,
              updated_at: now.toISOString(),
            })
            .eq("id", currentNote.id)
            .select("updated_at")
            .single();
          error = retry.error;
          retryData = retry.data as any;
          
          // 再次检查是否是网络错误
          if (error) {
            const errorMessage = error.message || String(error);
            isNetworkError = errorMessage.includes("Failed to fetch") || 
                            errorMessage.includes("ERR_INTERNET_DISCONNECTED") ||
                            errorMessage.includes("NetworkError") ||
                            errorMessage.includes("network");
          }
        }

        if (!error) {
          setSaveStatus("saved");
          // 记录保存时间戳，用于检测云端更新
          const latestUpdatedAt =
            (retryData?.updated_at as string | undefined) ||
            (updatedRow?.updated_at as string | undefined) ||
            now.toISOString();
          lastSavedTimestampRef.current = latestUpdatedAt;
          pendingSelfUpdateRef.current = latestUpdatedAt;
          // 存储该次保存的指纹（最多保留 20 条）
          if (pendingSelfFingerprintRef.current) {
            recentSelfUpdatesRef.current.set(latestUpdatedAt, pendingSelfFingerprintRef.current);
            if (recentSelfUpdatesRef.current.size > 20) {
              const firstKey = recentSelfUpdatesRef.current.keys().next().value as string | undefined;
              if (firstKey) recentSelfUpdatesRef.current.delete(firstKey);
            }
          }
          lastSaveTimeRef.current = new Date(latestUpdatedAt).getTime();
          
          // 延迟清除保存标记，确保实时订阅事件能够被正确过滤（3秒后，给实时事件更多时间）
          setTimeout(() => {
            isSavingRef.current = false;
            // 清除 pendingSelfUpdateRef，避免后续误判
            pendingSelfUpdateRef.current = null;
            // 清除一次性指纹
            pendingSelfFingerprintRef.current = null;
          }, 3000);
          
          // 创建版本历史（异步，不阻塞保存流程）
          createNoteVersion(currentNote.id, userId, finalTitle, currentContent, currentTags).catch(err => {
            console.warn("Failed to create note version:", err);
          });
        } else if (isNetworkError) {
          // 网络错误：保存到离线存储
          console.warn("[NoteManager] 网络错误，切换到离线模式保存");
          try {
            await savePendingSyncNote({
              note_id: currentNote.id,
              user_id: userId,
              title: finalTitle,
              content: currentContent,
              tags: currentTags.join(","),
              is_pinned: pinned,
              is_published: published,
              operation: "update",
            });
            setSaveStatus("saved"); // 显示为已保存，但实际是离线保存
            // 离线保存也记录时间戳，但不需要延迟清除（因为不会触发实时订阅）
            lastSavedTimestampRef.current = now.toISOString();
            lastSaveTimeRef.current = nowTimestamp;
            isSavingRef.current = false;
            console.log("[NoteManager] 笔记已保存到本地（离线模式）");
          } catch (err) {
            console.error("[NoteManager] 离线保存失败：", err);
            setSaveStatus("error");
            isSavingRef.current = false;
          }
        } else {
          console.error("[NoteManager] 保存笔记失败：", error.message || error);
          setSaveStatus("error");
          isSavingRef.current = false;
        }
      } else {
        // 离线模式：保存到 IndexedDB
        try {
          await savePendingSyncNote({
            note_id: currentNote.id,
            user_id: userId,
            title: finalTitle,
            content: currentContent,
            tags: currentTags.join(","),
            is_pinned: pinned,
            is_published: published,
            operation: "update",
          });
          setSaveStatus("saved"); // 显示为已保存，但实际是离线保存
          // 离线保存也记录时间戳
          lastSavedTimestampRef.current = now.toISOString();
          lastSaveTimeRef.current = nowTimestamp;
          isSavingRef.current = false;
          console.log("[NoteManager] 笔记已保存到本地（离线模式）");
        } catch (err) {
          console.error("[NoteManager] 离线保存失败：", err);
          setSaveStatus("error");
          isSavingRef.current = false;
        }
      }
  }, [currentNote, userId]);

  // SegmentedEditor 已经自动处理表格显示，不再需要 isInTable 状态

  const handleContentChange = (newTitle: string, newContent: string) => { 
      const now = Date.now();
      const prevTitle = title;
      const prevContent = content;

      // 如果距离上一次变更超过一定时间（例如 800ms），认为是一次新的“编辑操作”，
      // 将变更前的状态推入撤回栈，这样撤回会回到本次编辑前的版本。
      const timeSinceLast =
        lastChangeTimeRef.current != null ? now - lastChangeTimeRef.current : Infinity;

      if (timeSinceLast > 800) {
        setUndoStack((prev) => {
          const snapshot = { title: prevTitle, content: prevContent };
          const last = prev[prev.length - 1];
          // 避免重复快照
          if (last && last.title === snapshot.title && last.content === snapshot.content) {
            return prev;
          }
          // 限制最多保留 50 步撤回
          const next = [...prev, snapshot];
          return next.slice(-50);
        });
      }

      lastChangeTimeRef.current = now;

      setTitle(newTitle); 
      setContent(newContent); 
      setSaveStatus('unsaved'); 

      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); 
      autoSaveTimerRef.current = setTimeout(() => { saveNote(newTitle, newContent, isPinned, isPublished, tags); }, 1500); 
  };

  // SegmentedEditor 的内容变化处理
  const handleSegmentedEditorChange = useCallback((newContent: string) => {
    // 编辑前保存滚动位置，避免移动端编辑后页面回到顶部
    if (editorScrollContainerRef.current) {
      savedScrollTopRef.current = editorScrollContainerRef.current.scrollTop;
    }
    handleContentChange(title, newContent);
    
    // 检测 [[ 触发链接菜单（简化处理：只在内容变化时检测最后一个 [[）
    // 注意：SegmentedEditor 使用多个 Textarea，无法精确获取光标位置
    // 这里简化处理，只在内容末尾检测
    const lastOpenBracket = newContent.lastIndexOf("[[");
    const lastCloseBracket = newContent.lastIndexOf("]]");
    
    if (lastOpenBracket !== -1 && (lastCloseBracket === -1 || lastCloseBracket < lastOpenBracket)) {
      const rawQuery = newContent.slice(lastOpenBracket + 2).trim();
      setLinkMenuOpen(true);
      setLinkQuery(rawQuery);
      setLinkInsertStart(lastOpenBracket);
      setLinkCursorPos(newContent.length);
      setLinkActiveIndex(0);
    } else {
      setLinkMenuOpen(false);
      setLinkQuery("");
      setLinkInsertStart(null);
      setLinkCursorPos(null);
    }
  }, [title, handleContentChange]);

  // 编辑后恢复滚动位置（解决手机端编辑后自动回到顶部）
  useEffect(() => {
    if (view !== "editor" || !content) return;
    const container = editorScrollContainerRef.current;
    if (!container) return;
    const restore = () => {
      container.scrollTop = savedScrollTopRef.current;
    };
    restore();
    requestAnimationFrame(restore);
  }, [content, view]);

  // 基于当前文件夹里的 notes 做候选（MVP）
  const linkCandidates = notes
      .filter(n => !n.is_deleted)
      .filter(n => {
          if (!linkQuery) return true;
          const q = linkQuery.toLowerCase();
          return (n.title || "").toLowerCase().includes(q) || (n.content || "").toLowerCase().includes(q);
      })
      .slice(0, 20);

  const handleInsertLink = (noteToLink: any) => {
      if (linkInsertStart == null || linkCursorPos == null) return;
      const current = content;
      const before = current.slice(0, linkInsertStart);
      const after = current.slice(linkCursorPos);
      const label = noteToLink.title || "未命名笔记";
      const insertText = `[[${noteToLink.id}|${label}]]`;
      const nextContent = before + insertText + after;
      setContent(nextContent);
      handleContentChange(title, nextContent);
      setLinkMenuOpen(false);
      setLinkQuery("");
      setLinkInsertStart(null);
      setLinkCursorPos(null);
      // SegmentedEditor 会自动处理光标位置，不需要手动设置
  };

  // 插入表格功能 - 直接创建可视化表格段
  const handleInsertTable = () => {
    // 通过全局方法调用 SegmentedEditor 的插入表格功能
    if ((window as any).__segmentedEditorInsertTable) {
      (window as any).__segmentedEditorInsertTable();
    } else {
      // 降级方案：插入 Markdown 表格语法
      const tableText = `|  |  |
|--|--|
|  |  |
`;
      const nextContent = content + (content ? "\n\n" : "") + tableText;
      setContent(nextContent);
      handleContentChange(title, nextContent);
    }
  };

  // SegmentedEditor 已内置表格编辑功能（添加/删除行列），不再需要这些辅助函数

  // SegmentedEditor 已经自动处理表格，不再需要检测光标位置

  // 键盘事件处理（用于链接菜单导航）
  // 注意：SegmentedEditor 内部处理键盘事件，这里主要用于全局快捷键
  useEffect(() => {
    if (!linkMenuOpen || linkCandidates.length === 0) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setLinkActiveIndex((prev) => (prev + 1) % linkCandidates.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setLinkActiveIndex((prev) => (prev - 1 + linkCandidates.length) % linkCandidates.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = linkCandidates[linkActiveIndex];
        if (target) handleInsertLink(target);
      } else if (e.key === "Escape") {
        setLinkMenuOpen(false);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [linkMenuOpen, linkCandidates, linkActiveIndex]);
  
  const handleDeleteCurrentNote = async () => {
    if (!currentNote) return;
    setDeleteNoteId(currentNote.id);
    setDeleteNoteDialogOpen(true);
  };

  const confirmDeleteCurrentNote = async () => {
    if (!currentNote || !deleteNoteId) return;
    
    // 先保存当前更改（如果有）
    if (saveStatus === "unsaved") {
      await saveNote(title, content, isPinned, isPublished, tags);
    }
    
    // 标记为已删除
    const { error } = await supabase
      .from('notes')
      .update({ is_deleted: true })
      .eq('id', deleteNoteId);
    
    if (!error) {
      toast({
        title: "已移入回收站",
        description: "笔记已移入回收站",
        variant: "default",
      });
      // 返回列表视图并刷新
      setView("list");
      fetchNotes();
    } else {
      toast({
        title: "删除失败",
        description: error.message || "删除笔记时出错",
        variant: "destructive",
      });
    }
    setDeleteNoteDialogOpen(false);
    setDeleteNoteId(null);
  };

  const togglePin = async () => {
      const newStatus = !isPinned;
      setIsPinned(newStatus);
      await saveNote(title, content, newStatus, isPublished, tags);
  };

  const togglePublish = async () => {
      const newStatus = !isPublished;
      setIsPublished(newStatus);
      await saveNote(title, content, isPinned, newStatus, tags);
      if (newStatus) {
          const url = `${window.location.origin}/p/${currentNote.id}`;
          navigator.clipboard.writeText(url);
          toast({
            title: "已发布",
            description: `公开链接已复制：${url}`,
            variant: "success",
          });
      } else {
          toast({
            title: "已取消发布",
            description: "链接已失效",
            variant: "default",
          });
      }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      setSaveStatus('saving');
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${userId}/${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('images').upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);
          const markdownImage = `\n![image](${publicUrl})\n`;
          setContent(prev => prev + markdownImage);
          handleContentChange(title, content + markdownImage);
          toast({
            title: "上传成功",
            description: "图片已插入到笔记中",
            variant: "success",
          });
      } catch (error: any) {
          toast({
            title: "上传失败",
            description: error.message || "图片上传时出错",
            variant: "destructive",
          });
          setSaveStatus('error');
      } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  useEffect(() => { const handleKeyDown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (view === 'editor') saveNote(title, content, isPinned, isPublished, tags); } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [view, title, content, isPinned, isPublished, tags, saveNote]);

  // 网络状态监听和自动同步
  useEffect(() => {
    // 初始化网络状态
    setIsOnlineState(isOnline());

    const unsubscribe = onNetworkStatusChange((online) => {
      setIsOnlineState(online);
      if (online) {
        // 网络恢复时自动同步
        syncPendingNotes().then(({ success, failed }) => {
          if (success > 0) {
            console.log(`[NoteManager] 已同步 ${success} 条离线更改`);
            // 如果有同步成功的笔记，刷新笔记列表
            if (view === 'list') {
              fetchNotes();
            }
          }
          if (failed > 0) {
            console.warn(`[NoteManager] ${failed} 条离线更改同步失败`);
          }
        });
      }
    });

    // 组件挂载时检查是否有待同步的笔记
    if (isOnline()) {
      syncPendingNotes().then(({ success }) => {
        if (success > 0) {
          console.log(`[NoteManager] 启动时同步了 ${success} 条离线更改`);
          if (view === 'list') {
            fetchNotes();
          }
        }
      });
    }

    return unsubscribe;
  }, [view]);

  // 实时同步：订阅当前笔记的变化
  useEffect(() => {
    if (view !== "editor" || !currentNote) {
      // 清理之前的订阅
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      return;
    }

    // 创建 Realtime 订阅通道
    const channel = supabase
      .channel(`note:${currentNote.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notes",
          filter: `id=eq.${currentNote.id}`,
        },
        (payload) => {
          const updatedNote = payload.new as any;
          const updatedAt = updatedNote.updated_at;
          const updatedAtTimestamp = new Date(updatedAt).getTime();
          const currentTime = Date.now();

          // 更强的“自更新过滤”：如果 payload 的内容指纹与我们最近保存的一致，直接忽略（解决单设备误报）
          const payloadFingerprint = buildNoteFingerprint({
            title: updatedNote.title,
            content: updatedNote.content,
            tags: (updatedNote as any).tags ?? null,
            is_pinned: updatedNote.is_pinned,
            is_published: updatedNote.is_published,
          });
          // 1) 优先按 updated_at 精确命中
          const knownSelfFp = updatedAt ? recentSelfUpdatesRef.current.get(updatedAt) : undefined;
          if (knownSelfFp && knownSelfFp === payloadFingerprint) {
            recentSelfUpdatesRef.current.delete(updatedAt);
            pendingSelfUpdateRef.current = null;
            return;
          }
          // 2) 次选：在“正在保存/刚保存”窗口内，指纹相同也视为自更新
          if (
            (isSavingRef.current || (currentTime - lastSaveTimeRef.current < 8000)) &&
            pendingSelfFingerprintRef.current &&
            payloadFingerprint === pendingSelfFingerprintRef.current
          ) {
            pendingSelfUpdateRef.current = null;
            return;
          }
          
          // 如果是刚刚自己保存的同一条 updated_at，直接忽略一次
          if (pendingSelfUpdateRef.current && updatedAt === pendingSelfUpdateRef.current) {
            pendingSelfUpdateRef.current = null;
            return;
          }
          
          // 如果正在保存，忽略这个事件（可能是自己触发的）
          if (isSavingRef.current) {
            const timeSinceLastSave = updatedAtTimestamp - lastSaveTimeRef.current;
            // 如果时间差在 3 秒内，很可能是自己的保存操作
            if (timeSinceLastSave >= 0 && timeSinceLastSave < 3000) {
              return;
            }
          }
          
          // 如果这次更新不是我们自己保存的（时间戳不同），则提示用户
          if (
            lastSavedTimestampRef.current &&
            updatedAt !== lastSavedTimestampRef.current
          ) {
            const lastSavedTimestamp = new Date(lastSavedTimestampRef.current).getTime();
            const timeDiff = updatedAtTimestamp - lastSavedTimestamp;
            
            // 更严格的检查：只有时间差大于 3 秒，且确实是更新的时间戳，才认为是云端更新
            // 这样可以避免自己的保存操作被误判
            if (timeDiff > 3000 && updatedAtTimestamp > lastSavedTimestamp) {
              // 额外检查：如果距离上次保存时间很短（5秒内），且我们正在保存，忽略
              const timeSinceLastSave = currentTime - lastSaveTimeRef.current;
              if (timeSinceLastSave < 5000 && isSavingRef.current) {
                return;
              }
              
              // 最后检查：如果 pendingSelfUpdateRef 还存在，说明可能是自己的更新还没处理完
              if (pendingSelfUpdateRef.current) {
                return;
              }
              
              setCloudUpdateNote(updatedNote);
              setCloudUpdateDialogOpen(true);
            }
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [view, currentNote]);

  // 查找替换快捷键监听
  useEffect(() => {
    if (view !== "editor") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F 或 Cmd+F：打开查找
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setFindReplaceMode("find");
        setIsFindReplaceOpen(true);
        return;
      }

      // Ctrl+H 或 Cmd+H：打开替换
      if ((e.ctrlKey || e.metaKey) && e.key === "h") {
        e.preventDefault();
        setFindReplaceMode("replace");
        setIsFindReplaceOpen(true);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view]);

  // 处理查找匹配项
  const handleFind = useCallback((newMatches: Match[], newIndex: number) => {
    setMatches(newMatches);
    setCurrentMatchIndex(newIndex);
    
    // 定位到匹配项
    if (newIndex >= 0 && newIndex < newMatches.length && editorRef.current) {
      const match = newMatches[newIndex];
      editorRef.current.focus();
      editorRef.current.setSelectionRange(match.start, match.end);
      // 滚动到匹配项位置
      editorRef.current.scrollTop = editorRef.current.scrollHeight;
    }
  }, []);

  // 处理替换
  const handleReplace = useCallback((newText: string, nextMatchIndex: number) => {
    setContent(newText);
    setCurrentMatchIndex(nextMatchIndex);
    // SegmentedEditor 会自动处理焦点，不需要手动聚焦
  }, []);

  // 处理全部替换
  const handleReplaceAll = useCallback((newText: string) => {
    setContent(newText);
    setMatches([]);
    setCurrentMatchIndex(-1);
  }, []);

  // 处理云端更新：刷新并放弃本地更改
  const handleRefreshFromCloud = async (saveLocalFirst: boolean = false) => {
    if (!cloudUpdateNote) return;
    
    // 如果需要先保存本地更改
    if (saveLocalFirst && currentNote) {
      // 先保存当前本地内容（创建版本历史）
      try {
        await createNoteVersion(currentNote.id, userId, title, content, tags);
        console.log("[NoteManager] 已保存本地更改到版本历史");
      } catch (err) {
        console.warn("[NoteManager] 保存版本历史失败:", err);
      }
    }
    
    // 刷新笔记数据
    setTitle(cloudUpdateNote.title || "");
    setContent(cloudUpdateNote.content || "");
    
    // 解析 tags
    const rawTags = (cloudUpdateNote as any).tags as string | null | undefined;
    if (rawTags) {
      setTags(
        rawTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      );
    } else {
      setTags([]);
    }
    
    setIsPinned(cloudUpdateNote.is_pinned || false);
    setIsPublished(cloudUpdateNote.is_published || false);
    setCurrentNote(cloudUpdateNote);
    const cloudUpdatedAt = cloudUpdateNote.updated_at || new Date().toISOString();
    lastSavedTimestampRef.current = cloudUpdatedAt;
    lastSaveTimeRef.current = new Date(cloudUpdatedAt).getTime();
    setSaveStatus('saved');
    setCloudUpdateDialogOpen(false);
    setCloudUpdateNote(null);
  };

  // 处理云端更新：保留本地更改（覆盖云端）
  const handleKeepLocalChanges = async () => {
    if (!currentNote) return;
    
    // 关闭对话框
    setCloudUpdateDialogOpen(false);
    setCloudUpdateNote(null);
    
    // 使用当前本地内容覆盖云端
    await saveNote(title, content, isPinned, isPublished, tags);
  };

  // 点击外部关闭更多菜单
  useEffect(() => {
    if (!moreMenuOpen) return;
    
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      // 检查点击是否在按钮或菜单内
      const isClickInButton = moreButtonRef.current?.contains(target);
      const isClickInMenu = moreMenuPortalRef.current?.contains(target);
      
      if (!isClickInButton && !isClickInMenu) {
        setMoreMenuOpen(false);
      }
    };
    
    // 延迟添加监听器，确保 React onClick 事件先处理
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('touchstart', handleClickOutside, true);
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [moreMenuOpen]);

  // 手机端返回手势（后退）先关闭编辑器，再返回到登录页
  useEffect(() => {
    if (view !== "editor") return;

    const handlePopState = () => {
      // 仅关闭编辑器，保持在 dashboard（文件夹页）
      setView("list");
      fetchNotes();
    };

    // 在编辑器打开时插入一个新的历史记录条目
    if (typeof window !== "undefined") {
      window.history.pushState({ noteEditor: true }, "", window.location.href);
      window.addEventListener("popstate", handlePopState);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("popstate", handlePopState);
      }
    };
  }, [view]);

  // 撤回到上次保存版本
  const canRevert = view === "editor" && undoStack.length > 0;

  const handleRevertToLastSaved = async () => {
    if (!canRevert) return;
    setUndoStack((prev) => {
      const next = [...prev];
      const snapshot = next.pop();
      if (snapshot) {
        setTitle(snapshot.title);
        setContent(snapshot.content);
        // 撤回后也触发一次保存，保证与服务端一致
        saveNote(snapshot.title, snapshot.content, isPinned, isPublished, tags);
      }
      return next;
    });
  };

  // 版本历史相关函数
  const loadVersions = async () => {
    if (!currentNote) return;
    setVersionsLoading(true);
    try {
      const versionList = await getNoteVersions(currentNote.id);
      setVersions(versionList);
    } catch (error) {
      console.error("获取版本历史失败:", error);
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleOpenVersionHistory = async () => {
    setVersionHistoryDialogOpen(true);
    await loadVersions();
  };

  const handleRestoreVersion = async (version: NoteVersion) => {
    if (!currentNote) return;
    
    // 恢复版本内容
    setTitle(version.title || "");
    setContent(version.content || "");
    if (version.tags) {
      setTags(version.tags.split(",").map(t => t.trim()).filter(Boolean));
    } else {
      setTags([]);
    }
    
    // 保存恢复的版本
    const versionTags = version.tags ? version.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    await saveNote(version.title || "", version.content || "", isPinned, isPublished, versionTags);
    
    // 关闭对话框
    setVersionHistoryDialogOpen(false);
    setSelectedVersion(null);
  };

  // --- 交互逻辑 ---
  const toggleSelection = (id: string) => { const newSet = new Set(selectedIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedIds(newSet); };
  const handleTouchStart = (id: string, e?: React.TouchEvent) => {
    if (isSelectionMode) return;
    ignoreClickRef.current = false;
    ignoreTapOnceRef.current = false;
    if (e?.touches?.[0]) {
      touchStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
      touchStartPosRef.current = null;
    }
    timerRef.current = setTimeout(() => {
      const newSet = new Set(selectedIds);
      newSet.add(id);
      setSelectedIds(newSet);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
      ignoreClickRef.current = true;
    }, 500);
  };

  const handleTouchMove = (e?: React.TouchEvent) => {
    // 只有当移动超过阈值时才取消长按选择，并且忽略本次点击（避免滑动误触）
    const start = touchStartPosRef.current;
    const t = e?.touches?.[0];
    if (start && t) {
      const dx = Math.abs(t.clientX - start.x);
      const dy = Math.abs(t.clientY - start.y);
      if (dx > 10 || dy > 10) {
        ignoreTapOnceRef.current = true;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
      return;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    touchStartPosRef.current = null;
  };
  const exitSelectionMode = () => setSelectedIds(new Set());
  const handleListClick = (note: any) => {
    // 滑动后的 click/tap 直接忽略一次（移动端防误触）
    if (ignoreTapOnceRef.current) {
      ignoreTapOnceRef.current = false;
      return;
    }
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }
    if (isSelectionMode) {
      toggleSelection(note.id);
    } else {
      enterEditor(note);
    }
  };
  const handleDelete = async () => {
    const ids = Array.from(selectedIds);
    if (showTrash) {
      // 回收站：永久删除，需要确认
      setBatchDeleteDialogOpen(true);
    } else {
      // 普通删除：移入回收站，直接执行
      const { error } = await supabase.from('notes').update({ is_deleted: true }).in('id', ids);
      if (!error) {
        setNotes(prev => prev.filter(n => !selectedIds.has(n.id)));
        exitSelectionMode();
        toast({
          title: "已移入回收站",
          description: `${ids.length} 个笔记已移入回收站`,
          variant: "default",
        });
      } else {
        toast({
          title: "删除失败",
          description: error.message || "删除笔记时出错",
          variant: "destructive",
        });
      }
    }
  };

  const confirmBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('notes').delete().in('id', ids);
    if (!error) {
      setNotes(prev => prev.filter(n => !selectedIds.has(n.id)));
      exitSelectionMode();
      toast({
        title: "已永久删除",
        description: `${ids.length} 个笔记已被永久删除，无法找回`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "删除失败",
        description: error.message || "删除笔记时出错",
        variant: "destructive",
      });
    }
    setBatchDeleteDialogOpen(false);
  };

  const handleRestore = async () => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('notes').update({ is_deleted: false }).in('id', ids);
    if (!error) {
      setNotes(prev => prev.filter(n => !selectedIds.has(n.id)));
      exitSelectionMode();
      toast({
        title: "已还原",
        description: `${ids.length} 个笔记已还原`,
        variant: "success",
      });
    } else {
      toast({
        title: "还原失败",
        description: error.message || "还原笔记时出错",
        variant: "destructive",
      });
    }
  };

  const handleCopy = () => {
    if (selectedIds.size > 1) return;
    const note = notes.find(n => n.id === Array.from(selectedIds)[0]);
    if (note) {
      navigator.clipboard.writeText(note.content || "");
      toast({
        title: "已复制",
        description: "笔记内容已复制到剪贴板",
        variant: "success",
      });
      exitSelectionMode();
    }
  };
  const handleRename = () => {
    if (selectedIds.size !== 1) return;
    const id = Array.from(selectedIds)[0];
    const note = notes.find(n => n.id === id);
    if (!note) return;
    setRenameNoteId(id);
    setRenameInput(note.title || "");
    setRenameDialogOpen(true);
  };

  const confirmRename = async () => {
    if (!renameNoteId || !renameInput.trim()) {
      setRenameDialogOpen(false);
      return;
    }
    const note = notes.find(n => n.id === renameNoteId);
    if (!note || renameInput.trim() === note.title) {
      setRenameDialogOpen(false);
      return;
    }
    const { error } = await supabase.from('notes').update({ title: renameInput.trim() }).eq('id', renameNoteId);
    if (!error) {
      toast({
        title: "重命名成功",
        description: "笔记标题已更新",
        variant: "success",
      });
      fetchNotes();
      exitSelectionMode();
    } else {
      toast({
        title: "重命名失败",
        description: error.message || "更新笔记标题时出错",
        variant: "destructive",
      });
    }
    setRenameDialogOpen(false);
    setRenameNoteId(null);
    setRenameInput("");
  };
  
  // 🔥 批量置顶逻辑
  const handlePin = async () => {
      const ids = Array.from(selectedIds);
      // 智能判断：如果选中的全都是已置顶，则全部取消；否则全部置顶
      const allPinned = notes.filter(n => selectedIds.has(n.id)).every(n => n.is_pinned);
      const newStatus = !allPinned;

      const { error } = await supabase.from('notes').update({ is_pinned: newStatus }).in('id', ids);
      if (!error) {
          fetchNotes(); // 刷新数据以更新排序
          exitSelectionMode();
      }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { over } = event;
    if (!over) return;
    if (over.id === 'dock-delete') handleDelete();
    else if (over.id === 'dock-copy') handleCopy();
    else if (over.id === 'dock-restore') handleRestore();
    else if (over.id === 'dock-pin') handlePin(); // 🔥 拖拽置顶
  };
  const handleDragStart = (event: any) => { setActiveId(event.active.id); if (!selectedIds.has(event.active.id)) { const newSet = new Set(selectedIds); newSet.add(event.active.id); setSelectedIds(newSet); } };

  // 辅助变量：判断当前选中是否全是置顶（用于 UI 显示）
  const allSelectedPinned = selectedIds.size > 0 && notes.filter(n => selectedIds.has(n.id)).every(n => n.is_pinned);

  if (loading && view === 'list') return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground"/></div>;

  if (view === 'editor') {
      return (
        <>
          <div className={cn("fixed inset-0 bg-background z-50 flex flex-col h-[100dvh] animate-in slide-in-from-bottom-4 duration-300", zenMode && "bg-background")}>
              <header className={cn(
                "px-2 sm:px-4 h-14 flex items-center justify-between border-b border-border/50 bg-background/50 backdrop-blur shrink-0",
                zenMode && "bg-background border-b border-border/40"
              )}>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        if (saveStatus === "unsaved") {
                          saveNote(title, content, isPinned, isPublished, tags);
                        }
                        setView("list");
                        fetchNotes();
                      }}
                    >
                      <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-1" />
                      <span className="hidden sm:inline">返回</span>
                    </Button>
                  </div>
                  <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide flex-1 justify-end min-w-0">
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                      
                      {/* 桌面端：显示所有按钮 */}
                      {!zenMode && (
                        <>
                          <Button variant="ghost" size="icon" className="shrink-0 hidden sm:flex" title="插入表格" onClick={handleInsertTable}><Table className="w-4 h-4 text-muted-foreground" /></Button>
                          {/* SegmentedEditor 已内置表格编辑功能，不再需要额外的表格编辑按钮 */}
                          <Button variant="ghost" size="icon" className="shrink-0 hidden sm:flex" title="插入图片" onClick={() => fileInputRef.current?.click()}><ImageIcon className="w-4 h-4 text-muted-foreground" /></Button>
                          <Button variant="ghost" size="icon" className="shrink-0 hidden sm:flex" onClick={togglePin} title={isPinned ? "取消置顶" : "置顶笔记"}><Pin className={cn("w-4 h-4 transition-all", isPinned ? "fill-yellow-500 text-yellow-500 rotate-45" : "text-muted-foreground")} /></Button>
                          <Button variant="ghost" size="icon" className="shrink-0 hidden sm:flex" onClick={togglePublish} title={isPublished ? "已发布" : "发布到 Web"}><Globe className={cn("w-4 h-4 transition-all", isPublished ? "text-blue-500" : "text-muted-foreground")} /></Button>
                          <div className="w-[1px] h-4 bg-border mx-0.5 sm:mx-1 shrink-0 hidden sm:block"></div>
                        </>
                      )}
                      {!zenMode && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 px-1.5 sm:px-2 text-xs flex items-center gap-0.5 sm:gap-1 hidden sm:flex"
                            disabled={!canRevert}
                            onClick={handleRevertToLastSaved}
                            title={!canRevert ? "无可撤回操作" : "撤回到上一步"}
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span className="hidden sm:inline">撤回</span>
                          </Button>
                          <div className="w-[1px] h-4 bg-border mx-0.5 sm:mx-1 shrink-0 hidden sm:block"></div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 hidden sm:flex"
                            title="版本历史"
                            onClick={handleOpenVersionHistory}
                          >
                            <History className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 hidden sm:flex text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            title="删除笔记"
                            onClick={handleDeleteCurrentNote}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 hidden sm:flex"
                        title={zenMode ? "退出专注模式" : "进入专注模式"}
                        onClick={() => setZenMode((v) => !v)}
                      >
                        {zenMode ? (
                          <Minimize2 className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Maximize2 className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                      
                      {/* 移动端：更多菜单按钮 */}
                      <div className="relative sm:hidden" ref={moreMenuRef}>
                        <button
                          ref={moreButtonRef}
                          type="button"
                          className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-md text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 touch-manipulation"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (moreButtonRef.current) {
                              const rect = moreButtonRef.current.getBoundingClientRect();
                              setMenuPosition({
                                top: rect.bottom + 4,
                                right: window.innerWidth - rect.right
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
                                top: rect.bottom + 4,
                                right: window.innerWidth - rect.right
                              });
                            }
                            setMoreMenuOpen((prev) => !prev);
                          }}
                        >
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                      
                      {/* 更多菜单弹出层 - 使用 Portal 渲染到 body */}
                      {moreMenuOpen && typeof document !== 'undefined' && createPortal(
                        <div
                          ref={moreMenuPortalRef}
                          className="fixed w-48 rounded-lg border border-border bg-popover shadow-lg z-[99999] py-1"
                          style={{ 
                            top: `${menuPosition.top}px`,
                            right: `${Math.max(8, menuPosition.right)}px`,
                            maxWidth: `calc(100vw - 16px)`
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => e.stopPropagation()}
                        >
                            {!zenMode && (
                              <>
                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 touch-manipulation"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                    setMoreMenuOpen(false);
                                  }}
                                  onTouchEnd={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                    setMoreMenuOpen(false);
                                  }}
                                >
                                  <ImageIcon className="w-4 h-4" />
                                  <span>插入图片</span>
                                </button>
                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 touch-manipulation"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleInsertTable();
                                    setMoreMenuOpen(false);
                                  }}
                                  onTouchEnd={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleInsertTable();
                                    setMoreMenuOpen(false);
                                  }}
                                >
                                  <Table className="w-4 h-4" />
                                  <span>插入表格</span>
                                </button>
                                {/* SegmentedEditor 已内置表格编辑功能，不再需要额外的表格编辑按钮 */}
                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 touch-manipulation"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    togglePin();
                                    setMoreMenuOpen(false);
                                  }}
                                  onTouchEnd={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    togglePin();
                                    setMoreMenuOpen(false);
                                  }}
                                >
                                  <Pin className={cn("w-4 h-4", isPinned ? "fill-yellow-500 text-yellow-500 rotate-45" : "")} />
                                  <span>{isPinned ? "取消置顶" : "置顶笔记"}</span>
                                </button>
                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 touch-manipulation"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    togglePublish();
                                    setMoreMenuOpen(false);
                                  }}
                                  onTouchEnd={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    togglePublish();
                                    setMoreMenuOpen(false);
                                  }}
                                >
                                  <Globe className={cn("w-4 h-4", isPublished ? "text-blue-500" : "")} />
                                  <span>{isPublished ? "取消发布" : "发布到 Web"}</span>
                                </button>
                                <div className="h-[1px] bg-border my-1"></div>
                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 touch-manipulation"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setFindReplaceMode("find");
                                    setIsFindReplaceOpen(true);
                                    setMoreMenuOpen(false);
                                  }}
                                  onTouchEnd={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setFindReplaceMode("find");
                                    setIsFindReplaceOpen(true);
                                    setMoreMenuOpen(false);
                                  }}
                                >
                                  <Search className="w-4 h-4" />
                                  <span>查找与替换</span>
                                </button>
                                <div className="h-[1px] bg-border my-1"></div>
                              </>
                            )}
                            <button
                              className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                              disabled={!canRevert}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (canRevert) {
                                handleRevertToLastSaved();
                                }
                                setMoreMenuOpen(false);
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (canRevert) {
                                  handleRevertToLastSaved();
                                }
                                setMoreMenuOpen(false);
                              }}
                            >
                              <RotateCcw className="w-4 h-4" />
                              <span>撤回</span>
                            </button>
                            <button
                              className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 touch-manipulation"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleOpenVersionHistory();
                                setMoreMenuOpen(false);
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleOpenVersionHistory();
                                setMoreMenuOpen(false);
                              }}
                            >
                              <History className="w-4 h-4" />
                              <span>版本历史</span>
                            </button>
                            <div className="h-[1px] bg-border my-1"></div>
                            <button
                              className="w-full px-4 py-2 text-left text-sm hover:bg-red-500/10 text-red-500 flex items-center gap-2 touch-manipulation"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteCurrentNote();
                                setMoreMenuOpen(false);
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteCurrentNote();
                                setMoreMenuOpen(false);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>删除笔记</span>
                            </button>
                            <button
                              className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 touch-manipulation"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setZenMode((v) => !v);
                                setMoreMenuOpen(false);
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
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
                        , document.body
                      )}
                      
                      {/* 编辑/预览切换（专注模式下隐藏） */}
                      {!zenMode && (
                        <button onClick={() => setPreviewMode(!previewMode)} className="shrink-0 flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/80 transition">{previewMode ? <><PenLine size={12} className="sm:w-3.5 sm:h-3.5"/><span className="hidden sm:inline">编辑</span></> : <><Eye size={12} className="sm:w-3.5 sm:h-3.5"/><span className="hidden sm:inline">预览</span></>}</button>
                      )}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isOnlineState && (
                          <div className="flex items-center gap-1 text-xs text-amber-600" title="离线模式 - 更改将保存到本地">
                            <WifiOff className="w-3 h-3" />
                            <span className="hidden sm:inline">离线</span>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground w-8 sm:w-12 text-right shrink-0">{saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin ml-auto text-blue-500"/> : <CheckCircle2 className="w-3 h-3 ml-auto text-green-600"/>}</div>
                      </div>
                  </div>
              </header>
              <div className={cn(
                "flex-1 mx-auto w-full flex flex-col overflow-y-auto min-h-0",
                zenMode ? "max-w-4xl px-8 py-12" : "max-w-3xl p-3 sm:p-4 md:p-8"
              )}>
                  {/* 查找替换面板 */}
                  {isFindReplaceOpen && (
                    <FindReplaceDialog
                      isOpen={isFindReplaceOpen}
                      onClose={() => setIsFindReplaceOpen(false)}
                      text={content}
                      cursorPosition={0}
                      onFind={handleFind}
                      onReplace={handleReplace}
                      onReplaceAll={handleReplaceAll}
                      mode={findReplaceMode}
                    />
                  )}
                  <Input
                    value={title}
                    onChange={(e) => handleContentChange(e.target.value, content)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        // 标题栏回车后光标进入正文区域
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
                      "border-none shadow-none px-0 focus-visible:ring-0 bg-transparent h-auto",
                      zenMode 
                        ? "text-4xl md:text-5xl font-bold py-6" 
                        : "text-3xl md:text-4xl font-bold py-4",
                      previewMode && "opacity-80 pointer-events-none"
                    )}
                  />
                  {/* 标签编辑区域（专注模式下隐藏） */}
                  {!zenMode && (
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="flex items-center gap-1 rounded-full bg-accent text-accent-foreground px-2 py-0.5 text-xs hover:bg-accent/80"
                        onClick={() => {
                          setTags((prev) => {
                            const arr = prev.filter((t) => t !== tag);
                            if (autoSaveTimerRef.current)
                              clearTimeout(autoSaveTimerRef.current);
                            autoSaveTimerRef.current = setTimeout(() => {
                              saveNote(title, content, isPinned, isPublished, arr);
                            }, 1500);
                            return arr;
                          });
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
                          setTags((prev) => {
                            const next = new Set(prev);
                            parts.forEach((p) => p && next.add(p));
                            const arr = Array.from(next);
                            // 标签变动后也触发一次保存（复用自动保存 debounce）
                            if (autoSaveTimerRef.current)
                              clearTimeout(autoSaveTimerRef.current);
                            autoSaveTimerRef.current = setTimeout(() => {
                              saveNote(title, content, isPinned, isPublished, arr);
                            }, 1500);
                            return arr;
                          });
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
                    <div className="relative flex-1 mt-4 min-h-0 flex flex-col">
                      {/* SegmentedEditor 已内置表格编辑功能，不再需要 TableEditor 对话框 */}
                      
                      {/* 使用 SegmentedEditor：自动将表格显示为可视化表格 */}
                      <div
                        ref={editorScrollContainerRef}
                        className="flex-1 min-h-0 overflow-y-auto"
                      >
                        <SegmentedEditor
                          content={content}
                          onChange={handleSegmentedEditorChange}
                          placeholder="开始输入内容 (支持 Markdown，输入 [[ 以引用其他笔记)..."
                          className={cn(
                            "w-full min-h-[200px]",
                            zenMode ? "text-lg leading-relaxed" : "text-base sm:text-lg leading-relaxed"
                          )}
                          onInsertTable={handleInsertTable}
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
                                  handleInsertLink(n);
                                }}
                              >
                                <div className="font-medium truncate">
                                  {n.title || "未命名笔记"}
                                </div>
                                {n.content && (
                                  <div className="text-xs text-muted-foreground line-clamp-1">
                                    {n.content}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* 笔记统计信息 - 放在编辑器容器内，确保在内容下方 */}
                      {currentNote && (
                        <NoteStats
                          content={content}
                          createdAt={currentNote.created_at}
                          updatedAt={currentNote.updated_at}
                        />
                      )}
                    </div>
                  )}
              </div>
          </div>
          
          {/* 云端更新提示 Dialog */}
          <Dialog open={cloudUpdateDialogOpen} onOpenChange={setCloudUpdateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>云端有更新</DialogTitle>
                <DialogDescription>
                  检测到其他设备更新了这篇笔记。你可以选择查看最新内容，或保留当前编辑的内容。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={handleKeepLocalChanges}
                >
                  保留我的更改
                </Button>
                <Button
                  onClick={() => {
                    // 检查是否有未保存的更改
                    if (saveStatus === 'unsaved' || title !== (currentNote?.title || '') || content !== (currentNote?.content || '')) {
                      // 有未保存的更改，显示确认对话框
                      setCloudUpdateDialogOpen(false);
                      setRefreshConfirmDialogOpen(true);
                    } else {
                      // 没有未保存的更改，直接刷新
                      handleRefreshFromCloud(false);
                    }
                  }}
                >
                  查看最新内容
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 版本历史对话框 */}
          <Dialog open={versionHistoryDialogOpen} onOpenChange={setVersionHistoryDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>版本历史</DialogTitle>
                <DialogDescription>
                  查看和恢复笔记的历史版本
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto min-h-0">
                {versionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : versions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    暂无版本历史
                  </div>
                ) : (
                  <div className="space-y-2">
                    {versions.map((version, index) => (
                      <div
                        key={version.id}
                        className={cn(
                          "p-4 rounded-lg border cursor-pointer transition-all hover:bg-accent",
                          selectedVersion?.id === version.id && "bg-accent border-blue-500"
                        )}
                        onClick={() => setSelectedVersion(version)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium">
                                {index === 0 ? "当前版本" : `版本 ${versions.length - index}`}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(version.created_at).toLocaleString("zh-CN", {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground line-clamp-2">
                              {version.title || "无标题"}
                            </div>
                            {version.content && (
                              <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {version.content.substring(0, 100)}
                                {version.content.length > 100 ? "..." : ""}
                              </div>
                            )}
                            {version.tags && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {version.tags
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
                          {selectedVersion?.id === version.id && index !== 0 && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestoreVersion(version);
                              }}
                              className="ml-4 shrink-0"
                            >
                              恢复此版本
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setVersionHistoryDialogOpen(false)}>
                  关闭
                </Button>
                {selectedVersion && selectedVersion.id !== versions[0]?.id && (
                  <Button
                    onClick={() => {
                      if (selectedVersion) {
                        handleRestoreVersion(selectedVersion);
                      }
                    }}
                  >
                    恢复选中版本
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 刷新确认对话框：询问是否先保存本地更改 */}
          <Dialog open={refreshConfirmDialogOpen} onOpenChange={setRefreshConfirmDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认刷新</DialogTitle>
                <DialogDescription>
                  刷新将使用云端版本，当前未保存的更改将丢失。
                  <br />
                  是否先保存当前更改到版本历史？保存后仍可恢复。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRefreshConfirmDialogOpen(false);
                    setCloudUpdateDialogOpen(true);
                  }}
                >
                  取消
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    // 不保存，直接刷新
                    handleRefreshFromCloud(false);
                    setRefreshConfirmDialogOpen(false);
                  }}
                >
                  不保存，直接刷新
                </Button>
                <Button
                  onClick={() => {
                    // 先保存到版本历史，再刷新
                    handleRefreshFromCloud(true);
                    setRefreshConfirmDialogOpen(false);
                  }}
                >
                  保存后刷新
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 删除笔记确认对话框 */}
          <Dialog open={deleteNoteDialogOpen} onOpenChange={setDeleteNoteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>移入回收站</DialogTitle>
                <DialogDescription>
                  确定要将这篇笔记移入回收站吗？移入回收站后仍可恢复。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteNoteDialogOpen(false);
                    setDeleteNoteId(null);
                  }}
                >
                  取消
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteCurrentNote}
                >
                  移入回收站
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      );
  }

  // --- 列表视图 ---
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="min-h-[80vh] pb-32" onClick={(e) => { if (e.target === e.currentTarget && isSelectionMode) exitSelectionMode(); }}>
        <header className="sticky top-0 bg-background/80 backdrop-blur z-10 border-b border-border/40">
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2"><ArrowLeft className="w-5 h-5" /></Button>
                    <h1 className="text-lg font-bold truncate max-w-[120px]">{showTrash ? "回收站" : folderName}</h1>
                    <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full">{notes.length}</span>
                </div>
                <div className="flex gap-2 items-center">
                    <Button variant={showTrash ? "destructive" : "ghost"} size="sm" onClick={() => { setShowTrash(!showTrash); setView('list'); }}>{showTrash ? <span className="flex items-center gap-1"><ArrowLeft size={14}/> 返回笔记</span> : <Trash2 size={18} className="text-muted-foreground hover:text-red-500 transition"/>}</Button>
                    {!showTrash && !isSelectionMode && (<Button size="sm" onClick={handleAddNote} variant="outline"><Plus className="w-4 h-4 mr-1"/> 新笔记</Button>)}
                </div>
            </div>
            <div className="px-4 pb-3"><div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><Input placeholder={showTrash ? "搜索回收站..." : "搜索笔记..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-accent/50 border-none h-9"/></div></div>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-3 p-3 sm:p-4">
            {filteredNotes.length === 0 && (<div className="col-span-2 text-center py-10 text-muted-foreground border-2 border-dashed border-border rounded-xl flex flex-col items-center gap-2">{searchQuery ? <p>未找到相关笔记</p> : (showTrash ? <p>回收站是空的</p> : <p>这里空空如也</p>)}</div>)}
            {filteredNotes.map((note) => (
              <DraggableNoteCard
                key={note.id}
                note={note}
                isSelected={selectedIds.has(note.id)}
                isSelectionMode={isSelectionMode}
                onClick={() => handleListClick(note)}
                onTouchStart={(e: React.TouchEvent) => handleTouchStart(note.id, e)}
                onTouchMove={(e: React.TouchEvent) => handleTouchMove(e)}
                onTouchEnd={handleTouchEnd}
                // 桌面端不使用“长按选择”（避免影响普通点击体验）
                onMouseDown={undefined}
                onMouseUp={undefined}
              />
            ))}
        </div>

        <div className={cn("fixed left-0 right-0 flex justify-center z-50 transition-all duration-300", "bottom-[calc(2rem+env(safe-area-inset-bottom,0px))]", isSelectionMode ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none")}>
            <div className="relative bg-background/90 backdrop-blur-md border border-border px-4 sm:px-8 py-3 rounded-2xl shadow-2xl flex items-center gap-4 sm:gap-8">
                <button onClick={(e) => { e.stopPropagation(); exitSelectionMode(); }} className="absolute -top-3 -right-3 w-6 h-6 bg-muted rounded-full flex items-center justify-center border border-border shadow-md"><X className="w-3 h-3" /></button>
                
                {showTrash ? (
                    <>
                         <DroppableDockItem id="dock-restore" icon={RotateCcw} label="还原" onClick={handleRestore} />
                         <DroppableDockItem id="dock-delete" icon={Trash2} label="彻底删除" variant="destructive" onClick={handleDelete} />
                    </>
                ) : (
                    <>
                        <div className={cn("flex flex-col items-center gap-1 transition-all", selectedIds.size === 1 ? "cursor-pointer hover:scale-110" : "opacity-30 grayscale cursor-not-allowed")} onClick={handleRename}>
                            <div className="p-2 bg-accent rounded-lg"><Pencil className="w-5 h-5" /></div>
                            <span className="text-[10px]">重命名</span>
                        </div>
                        
                        {/* 🔥 新增 Dock 置顶按钮 */}
                        <DroppableDockItem 
                            id="dock-pin" 
                            icon={Pin} 
                            label={allSelectedPinned ? "取消置顶" : "置顶"} 
                            variant="pinned" 
                            isActive={allSelectedPinned}
                            onClick={handlePin} 
                        />
                        
                        <DroppableDockItem id="dock-copy" icon={Copy} label="复制" disabled={selectedIds.size > 1} onClick={handleCopy} />
                        <DroppableDockItem id="dock-delete" icon={Trash2} label="删除" variant="destructive" onClick={handleDelete} />
                    </>
                )}
            </div>
        </div>
        <DragOverlay>{activeId ? (<div className="w-40 h-24 bg-accent/90 backdrop-blur border border-blue-500 rounded-xl shadow-2xl p-4 flex flex-col justify-center items-center rotate-3"><FileText className="w-8 h-8 text-blue-500 mb-2" /><span className="text-xs font-bold">{selectedIds.size > 1 ? `已选择 ${selectedIds.size} 项` : "移动中..."}</span></div>) : null}</DragOverlay>

        {/* 批量删除确认对话框（回收站） */}
        <Dialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>⚠️ 危险操作</DialogTitle>
              <DialogDescription>
                这些笔记将被永久删除，无法找回！
                <br />
                确认继续吗？
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setBatchDeleteDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={confirmBatchDelete}
              >
                确认删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 重命名对话框 */}
        <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>重命名笔记</DialogTitle>
              <DialogDescription>
                输入新的笔记标题
              </DialogDescription>
            </DialogHeader>
            <Input
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="笔记标题"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  confirmRename();
                } else if (e.key === "Escape") {
                  setRenameDialogOpen(false);
                }
              }}
              autoFocus
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setRenameDialogOpen(false);
                  setRenameNoteId(null);
                  setRenameInput("");
                }}
              >
                取消
              </Button>
              <Button
                onClick={confirmRename}
                disabled={!renameInput.trim()}
              >
                确定
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
    </DndContext>
  );
}