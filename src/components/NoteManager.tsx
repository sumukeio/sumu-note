"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
  Copy, Trash2, FolderInput, X, Check, Loader2, Plus, 
  FileText, ArrowLeft, CheckCircle2, Pencil, Eye, PenLine, 
  Search, RotateCcw, Pin, Image as ImageIcon, Globe, Maximize2, Minimize2, MoreVertical, WifiOff, Wifi, History, Table, Rows, Columns, AlignLeft, Folder
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
  onEnterFolder?: (folderId: string, folderName: string) => void; // 进入子文件夹的回调
  initialNoteId?: string | null; // 初始要打开的笔记 ID（用于从搜索结果跳转）
}

type SaveStatus = 'saved' | 'saving' | 'error' | 'unsaved';

// --- 拖拽卡片组件 ---
function DraggableNoteCard({ note, isSelected, isSelectionMode, onClick, onTouchStart, onTouchEnd, onTouchMove, onMouseDown, onMouseUp, onMouseMove }: any) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: note.id,
        data: note,
        // 始终允许拖拽，具体操作依赖于 selectedIds 和 Dock
        disabled: false,
    });
    const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0 : 1 };
    
    return (
        <div 
            ref={setNodeRef} 
            style={style}
            // 完全禁用拖拽库的触摸事件，只保留鼠标事件用于桌面端拖拽
            {...(isSelectionMode ? {} : {
                ...attributes,
                // 只应用鼠标相关的拖拽事件，不应用触摸事件
                onMouseDown: (e: React.MouseEvent) => {
                  onMouseDown?.(e);
                  listeners?.onMouseDown?.(e as any);
                },
                onMouseMove: (e: React.MouseEvent) => {
                  onMouseMove?.(e);
                  listeners?.onMouseMove?.(e as any);
                },
                onMouseUp: (e: React.MouseEvent) => {
                  onMouseUp?.(e);
                  listeners?.onMouseUp?.(e as any);
                },
            })}
            className={cn(
                // 允许纵向滚动手势（避免滑动时被当作点击/选中）
                "relative h-36 p-4 rounded-xl border flex flex-col justify-between transition-all select-none cursor-pointer touch-pan-y", 
                isSelected ? "bg-accent border-blue-500 shadow-[0_0_0_1px_#3b82f6]" : "bg-card border-border active:scale-95",
                note.is_deleted && "opacity-70 grayscale border-dashed",
                note.is_pinned && !note.is_deleted && "border-l-4 border-l-yellow-500 bg-yellow-500/5"
            )}
            onTouchStart={(e: React.TouchEvent) => {
                e.stopPropagation();
                e.preventDefault(); // 完全阻止拖拽库的触摸事件
                // 触摸事件优先处理长按选择
                if (onTouchStart) {
                    onTouchStart(e);
                }
            }} 
            onTouchEnd={(e: React.TouchEvent) => {
                e.stopPropagation();
                if (onTouchEnd) {
                    onTouchEnd(e);
                }
            }} 
            onTouchMove={(e: React.TouchEvent) => {
                e.stopPropagation();
                if (onTouchMove) {
                    onTouchMove(e);
                }
            }}
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
export default function NoteManager({ userId, folderId, folderName, onBack, onEnterFolder, initialNoteId }: NoteManagerProps) {
  const { toast } = useToast();
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [notes, setNotes] = useState<any[]>([]);
  const [subFolders, setSubFolders] = useState<any[]>([]); // 子文件夹列表
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
  const [cloudUpdateNote, setCloudUpdateNote] = useState<any>(null);
  const [deleteNoteDialogOpen, setDeleteNoteDialogOpen] = useState(false); // 删除笔记确认对话框
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false); // 批量删除确认对话框
  const [renameDialogOpen, setRenameDialogOpen] = useState(false); // 重命名对话框
  const [renameNoteId, setRenameNoteId] = useState<string | null>(null); // 待重命名的笔记ID
  const [renameInput, setRenameInput] = useState(""); // 重命名输入框
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null); // 待删除的笔记ID
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false); // 新建文件夹对话框
  const [folderNameInput, setFolderNameInput] = useState(""); // 文件夹名称输入框
  const lastSavedTimestampRef = useRef<string | null>(null); // 记录最后一次保存的时间戳（服务器返回）
  const realtimeChannelRef = useRef<any>(null); // Realtime 订阅通道
  const isSavingRef = useRef<boolean>(false); // 标记是否正在保存（用于忽略自己的更新事件）
  const lastSaveTimeRef = useRef<number>(0); // 记录最后一次保存的时间（毫秒时间戳）
  const pendingSelfUpdateRef = useRef<string | null>(null); // 记录一次自更新的 updated_at，用于首次实时事件直接忽略
  // 记录最近一次"自己保存"的内容指纹，帮助彻底过滤单设备误报
  const pendingSelfFingerprintRef = useRef<string | null>(null);
  // 记录最近若干次自己保存（key: updated_at, value: fingerprint）
  const recentSelfUpdatesRef = useRef<Map<string, string>>(new Map());
  // 保存重试相关
  const saveRetryCountRef = useRef<number>(0); // 当前保存重试次数
  const saveRetryTimerRef = useRef<NodeJS.Timeout | null>(null); // 重试定时器
  // 字数统计相关
  const [wordStats, setWordStats] = useState({ words: 0, paragraphs: 0, readingTime: 0 }); // 字数统计

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
  const mouseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ignoreClickRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const mouseStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const ignoreTapOnceRef = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 拖拽传感器配置：延迟激活，给长按选择留出时间（500ms）
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }), 
    useSensor(TouchSensor, { activationConstraint: { delay: 600, tolerance: 8 } }) // 延迟600ms，确保长按选择（500ms）优先
  );
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
  // 内容辅助功能：标签补全相关状态
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [tagInsertStart, setTagInsertStart] = useState<number | null>(null);
  const [tagCursorPos, setTagCursorPos] = useState<number | null>(null);
  const [tagActiveIndex, setTagActiveIndex] = useState(0);
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

  // 获取子文件夹
  const fetchSubFolders = async () => {
    if (showTrash) {
      setSubFolders([]);
      return;
    }
    const { data } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .eq('parent_id', folderId)
      .order('created_at', { ascending: false });
    if (data) setSubFolders(data);
  };

  useEffect(() => { 
    if (userId && folderId && view === 'list') {
      Promise.all([fetchNotes(), fetchSubFolders()]);
    }
  }, [userId, folderId, view, showTrash]);

  // 跟踪是否已经处理过 initialNoteId，避免重复处理和无限循环
  const processedInitialNoteIdRef = useRef<string | null>(null);
  const isProcessingInitialNoteRef = useRef<boolean>(false);
  
  // 如果传入了 initialNoteId，自动打开该笔记的编辑模式
  useEffect(() => {
    if (!initialNoteId || !userId || !folderId) {
      processedInitialNoteIdRef.current = null;
      isProcessingInitialNoteRef.current = false;
      return;
    }
    
    // 如果已经处理过这个 initialNoteId，不再重复处理
    if (processedInitialNoteIdRef.current === initialNoteId) {
      return;
    }
    
    // 如果正在处理中，避免重复执行
    if (isProcessingInitialNoteRef.current) {
      return;
    }
    
    // 如果还在加载中，等待加载完成
    if (loading) return;
    
    // 如果当前不在列表视图，先切换到列表视图（但不标记为已处理，等待下次执行）
    if (view !== 'list') {
      setView('list');
      return;
    }
    
    // 标记为正在处理，避免重复执行
    isProcessingInitialNoteRef.current = true;
    processedInitialNoteIdRef.current = initialNoteId;
    
    // 如果笔记列表已加载
    if (notes.length > 0) {
      const note = notes.find(n => n.id === initialNoteId);
      if (note) {
        // 找到笔记，打开编辑模式
        enterEditor(note);
        // 延迟重置处理标志，确保 enterEditor 完成
        setTimeout(() => {
          isProcessingInitialNoteRef.current = false;
        }, 100);
        return;
      }
    }
    
    // 如果笔记不在当前列表中，尝试从数据库加载
    supabase
      .from('notes')
      .select('*')
      .eq('id', initialNoteId)
      .eq('user_id', userId)
      .eq('folder_id', folderId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          enterEditor(data);
          // 延迟重置处理标志，确保 enterEditor 完成
          setTimeout(() => {
            isProcessingInitialNoteRef.current = false;
          }, 100);
        } else {
          console.warn('Failed to load note:', error);
          // 失败时重置标志，允许重试
          processedInitialNoteIdRef.current = null;
          isProcessingInitialNoteRef.current = false;
        }
      });
    // 移除 view 依赖，避免 enterEditor 调用 setView('editor') 时触发循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNoteId, userId, folderId, notes.length, loading]);

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

  // 过滤子文件夹（根据搜索查询）
  const filteredSubFolders = subFolders.filter(folder => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (folder.name?.toLowerCase() || "").includes(q);
  });
  
  // --- 编辑器操作 ---
  const enterEditor = (note: any) => { 
      setCurrentNote(note); 
      setTitle(note.title || ""); 
      setContent(note.content || ""); 
      // 内容辅助功能：初始化字数统计
      const contentText = note.content || "";
      const chineseChars = (contentText.match(/[\u4e00-\u9fa5]/g) || []).length;
      const englishWords = (contentText.match(/[a-zA-Z]+/g) || []).length;
      const words = chineseChars + englishWords;
      const paragraphs = contentText.split('\n').filter((line: string) => line.trim().length > 0).length;
      const readingTime = Math.ceil(words / 200);
      setWordStats({ words, paragraphs, readingTime });
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
  
  const handleAddFolder = () => {
    setFolderNameInput("");
    setCreateFolderDialogOpen(true);
  };

  const handleCreateFolder = async () => {
    const name = folderNameInput.trim();
    if (!name) return;
    
    const { error } = await supabase
      .from("folders")
      .insert({ user_id: userId, name, parent_id: folderId });
    
    if (!error) {
      setCreateFolderDialogOpen(false);
      setFolderNameInput("");
      toast({
        title: "创建成功",
        description: "文件夹已创建",
        variant: "default",
      });
      // 刷新笔记列表和子文件夹列表
      fetchNotes();
      fetchSubFolders();
    } else {
      toast({
        title: "创建失败",
        description: error.message || "创建文件夹时出错",
        variant: "destructive",
      });
    }
  };
  
  const saveNote = useCallback(async (currentTitle: string, currentContent: string, pinned: boolean, published: boolean, currentTags: string[], showToast: boolean = false) => { 
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
          // 重置重试计数（保存成功）
          saveRetryCountRef.current = 0;
          if (saveRetryTimerRef.current) {
            clearTimeout(saveRetryTimerRef.current);
            saveRetryTimerRef.current = null;
          }
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
          
          // 优化：只在用户主动保存（Ctrl+S）时显示 Toast，自动保存只更新右上角状态图标
          if (showToast) {
            toast({
              title: "保存成功",
              description: "笔记已保存到云端",
              variant: "success",
              duration: 3000, // 3秒后自动消失
            });
          }
          
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
            // 过渡动画优化：内容更新 - 保存失败 Toast 提示（震动动画）
            toast({
              title: "保存失败",
              description: "无法保存到本地存储，请检查浏览器设置",
              variant: "destructive",
              duration: 5000, // 5秒后自动消失
            });
          }
        } else {
          console.error("[NoteManager] 保存笔记失败：", error.message || error);
          // 编辑体验优化：保存失败自动重试（最多3次）
          if (saveRetryCountRef.current < 3) {
            saveRetryCountRef.current += 1;
            // 延迟重试：第1次1秒后，第2次2秒后，第3次3秒后
            const retryDelay = saveRetryCountRef.current * 1000;
            if (saveRetryTimerRef.current) clearTimeout(saveRetryTimerRef.current);
            saveRetryTimerRef.current = setTimeout(() => {
              console.log(`[NoteManager] 自动重试保存（第 ${saveRetryCountRef.current} 次）`);
              saveNote(currentTitle, currentContent, pinned, published, currentTags);
            }, retryDelay);
            setSaveStatus("saving"); // 显示为保存中，表示正在重试
            toast({
              title: "保存失败，正在重试",
              description: `第 ${saveRetryCountRef.current}/3 次重试...`,
              variant: "default",
              duration: 2000,
            });
          } else {
            // 重试次数用完，显示最终错误
            setSaveStatus("error");
            isSavingRef.current = false;
            saveRetryCountRef.current = 0; // 重置重试计数
            // 过渡动画优化：内容更新 - 保存失败 Toast 提示（震动动画）
            toast({
              title: "保存失败",
              description: error.message || "保存时发生错误，已重试3次仍失败，请稍后手动保存",
              variant: "destructive",
              duration: 5000, // 5秒后自动消失
            });
          }
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
      autoSaveTimerRef.current = setTimeout(() => { saveNote(newTitle, newContent, isPinned, isPublished, tags); }, 1000); // 优化：从1.5秒改为1秒 
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
    
    // 恢复容器滚动位置（移动端键盘弹出可能导致滚动位置重置）
    // 注意：只在用户已经滚动过的情况下恢复，避免初始化时跳转
    const restoreScroll = () => {
      if (editorScrollContainerRef.current && savedScrollTopRef.current !== null && savedScrollTopRef.current > 0) {
        editorScrollContainerRef.current.scrollTop = savedScrollTopRef.current;
      }
    };
    
    // 延迟恢复，确保 DOM 更新完成
    // 使用多个延迟确保在不同情况下都能恢复
    requestAnimationFrame(() => {
      restoreScroll();
      requestAnimationFrame(() => {
        restoreScroll();
        // 移动端键盘弹出后延迟恢复
        setTimeout(restoreScroll, 100);
        setTimeout(restoreScroll, 300);
      });
    });
  }, [title, handleContentChange]);

  // 编辑后恢复滚动位置（解决手机端编辑后自动回到顶部）
  // 注意：只在进入编辑器视图时恢复，不在内容变化时恢复（避免每次输入都跳转）
  useEffect(() => {
    if (view !== "editor") return;
    const container = editorScrollContainerRef.current;
    if (!container) return;
    const saved = savedScrollTopRef.current;
    
    // 只在有保存的滚动位置且大于0时才恢复（避免初始化时滚动到顶部）
    if (saved === null || saved === 0) return;
    
    // 延迟恢复，确保 DOM 已更新
    const restore = () => {
      if (editorScrollContainerRef.current && savedScrollTopRef.current !== null && savedScrollTopRef.current > 0) {
        editorScrollContainerRef.current.scrollTop = savedScrollTopRef.current;
      }
    };
    
    // 只在视图切换时恢复一次，使用多个延迟确保恢复成功
    requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(() => {
        restore();
        // 移动端键盘/布局稳定后再恢复一次
        setTimeout(restore, 200);
      });
    });
  }, [view]); // 只在 view 变化时触发，不在 content 变化时触发

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
      const before = content.slice(0, linkInsertStart);
      const after = content.slice(linkCursorPos);
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

  // 内容辅助功能：标签补全 - 获取所有已使用的标签
  const allTags = Array.from(new Set(notes.flatMap(n => {
    const rawTags = (n as any).tags as string | null | undefined;
    if (rawTags) {
      return rawTags.split(",").map(t => t.trim()).filter(Boolean);
    }
    return [];
  })));

  // 内容辅助功能：标签补全 - 过滤候选标签
  const tagCandidates = allTags
    .filter(tag => {
      if (!tagQuery) return true;
      return tag.toLowerCase().includes(tagQuery.toLowerCase());
    })
    .slice(0, 10);

  // 内容辅助功能：标签补全 - 插入标签
  const handleInsertTag = (tag: string) => {
    if (tagInsertStart == null || tagCursorPos == null) return;
    const current = content;
    const before = content.slice(0, tagInsertStart);
    const after = content.slice(tagCursorPos);
    // 移除 # 和查询文本，插入完整的标签
    const insertText = `#${tag} `;
    const nextContent = before + insertText + after;
    setContent(nextContent);
    handleContentChange(title, nextContent);
    setTagMenuOpen(false);
    setTagQuery("");
    setTagInsertStart(null);
    setTagCursorPos(null);
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

  // 优化：Ctrl+S / Cmd+S 手动保存时显示 Toast 提示
  useEffect(() => { 
    const handleKeyDown = (e: KeyboardEvent) => { 
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { 
        e.preventDefault(); 
        if (view === 'editor') {
          // 用户主动保存：显示 Toast 提示
          saveNote(title, content, isPinned, isPublished, tags, true); 
        }
      } 
    }; 
    window.addEventListener('keydown', handleKeyDown); 
    return () => window.removeEventListener('keydown', handleKeyDown); 
  }, [view, title, content, isPinned, isPublished, tags, saveNote]);

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
              
              // 自动处理云端更新：保存本地更改到版本历史，然后加载云端版本
              setCloudUpdateNote(updatedNote);
              handleAutoSyncFromCloud(updatedNote);
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

  // 快捷操作增强：键盘快捷键监听
  useEffect(() => {
    if (view !== "editor") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      
      // Ctrl+F 或 Cmd+F：打开查找
      if (modKey && e.key === "f" && !e.shiftKey) {
        e.preventDefault();
        setFindReplaceMode("find");
        setIsFindReplaceOpen(true);
        return;
      }

      // Ctrl+H 或 Cmd+H：打开替换
      if (modKey && e.key === "h" && !e.shiftKey) {
        e.preventDefault();
        setFindReplaceMode("replace");
        setIsFindReplaceOpen(true);
        return;
      }

      // 快捷操作增强：格式化快捷键
      // Ctrl+B / Cmd+B：加粗
      if (modKey && e.key === "b" && !e.shiftKey) {
        e.preventDefault();
        const activeTextarea = document.activeElement as HTMLTextAreaElement;
        if (activeTextarea && activeTextarea.tagName === 'TEXTAREA') {
          const start = activeTextarea.selectionStart;
          const end = activeTextarea.selectionEnd;
          const selectedText = activeTextarea.value.substring(start, end);
          if (selectedText) {
            const newText = `**${selectedText}**`;
            const newValue = content.substring(0, start) + newText + content.substring(end);
            handleContentChange(title, newValue);
            // 恢复光标位置
            setTimeout(() => {
              activeTextarea.focus();
              activeTextarea.setSelectionRange(start + 2, start + 2 + selectedText.length);
            }, 0);
          } else {
            // 插入加粗占位符
            const newText = "**粗体文本**";
            const newValue = content.substring(0, start) + newText + content.substring(end);
            handleContentChange(title, newValue);
            setTimeout(() => {
              activeTextarea.focus();
              activeTextarea.setSelectionRange(start + 2, start + 2 + 4);
            }, 0);
          }
        }
        return;
      }

      // Ctrl+I / Cmd+I：斜体
      if (modKey && e.key === "i" && !e.shiftKey) {
        e.preventDefault();
        const activeTextarea = document.activeElement as HTMLTextAreaElement;
        if (activeTextarea && activeTextarea.tagName === 'TEXTAREA') {
          const start = activeTextarea.selectionStart;
          const end = activeTextarea.selectionEnd;
          const selectedText = activeTextarea.value.substring(start, end);
          if (selectedText) {
            const newText = `*${selectedText}*`;
            const newValue = content.substring(0, start) + newText + content.substring(end);
            handleContentChange(title, newValue);
            setTimeout(() => {
              activeTextarea.focus();
              activeTextarea.setSelectionRange(start + 1, start + 1 + selectedText.length);
            }, 0);
          } else {
            const newText = "*斜体文本*";
            const newValue = content.substring(0, start) + newText + content.substring(end);
            handleContentChange(title, newValue);
            setTimeout(() => {
              activeTextarea.focus();
              activeTextarea.setSelectionRange(start + 1, start + 1 + 4);
            }, 0);
          }
        }
        return;
      }

      // Ctrl+K / Cmd+K：插入链接
      if (modKey && e.key === "k" && !e.shiftKey) {
        e.preventDefault();
        const activeTextarea = document.activeElement as HTMLTextAreaElement;
        if (activeTextarea && activeTextarea.tagName === 'TEXTAREA') {
          const start = activeTextarea.selectionStart;
          const end = activeTextarea.selectionEnd;
          const selectedText = activeTextarea.value.substring(start, end);
          const newText = selectedText ? `[${selectedText}](url)` : `[链接文本](url)`;
          const newValue = content.substring(0, start) + newText + content.substring(end);
          handleContentChange(title, newValue);
          setTimeout(() => {
            activeTextarea.focus();
            if (selectedText) {
              activeTextarea.setSelectionRange(start + selectedText.length + 3, start + selectedText.length + 6);
            } else {
              activeTextarea.setSelectionRange(start + 2, start + 5);
            }
          }, 0);
        }
        return;
      }

      // Ctrl+Shift+K / Cmd+Shift+K：插入代码块
      if (modKey && e.shiftKey && e.key === "K") {
        e.preventDefault();
        const activeTextarea = document.activeElement as HTMLTextAreaElement;
        if (activeTextarea && activeTextarea.tagName === 'TEXTAREA') {
          const start = activeTextarea.selectionStart;
          const end = activeTextarea.selectionEnd;
          const selectedText = activeTextarea.value.substring(start, end);
          const newText = selectedText ? `\`\`\`\n${selectedText}\n\`\`\`` : `\`\`\`\n代码\n\`\`\``;
          const newValue = content.substring(0, start) + newText + content.substring(end);
          handleContentChange(title, newValue);
          setTimeout(() => {
            activeTextarea.focus();
            if (selectedText) {
              activeTextarea.setSelectionRange(start + 4, start + 4 + selectedText.length);
            } else {
              activeTextarea.setSelectionRange(start + 4, start + 6);
            }
          }, 0);
        }
        return;
      }

      // Ctrl+Shift+I / Cmd+Shift+I：插入图片
      if (modKey && e.shiftKey && e.key === "I") {
        e.preventDefault();
        fileInputRef.current?.click();
        return;
      }

      // Ctrl+Shift+T / Cmd+Shift+T：插入表格
      if (modKey && e.shiftKey && e.key === "T") {
        e.preventDefault();
        handleInsertTable();
        return;
      }

      // Ctrl+/ / Cmd+/：显示快捷键帮助（TODO: 实现快捷键帮助对话框）
      if (modKey && e.key === "/" && !e.shiftKey) {
        e.preventDefault();
        // TODO: 显示快捷键帮助对话框
        toast({
          title: "快捷键帮助",
          description: "Ctrl+B: 加粗 | Ctrl+I: 斜体 | Ctrl+K: 链接 | Ctrl+Shift+K: 代码块 | Ctrl+Shift+I: 图片 | Ctrl+Shift+T: 表格",
          duration: 5000,
        });
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, title, content, handleContentChange, handleInsertTable, toast]);

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

  // 自动处理云端更新：保存本地更改到版本历史，然后加载云端版本
  const handleAutoSyncFromCloud = async (updatedNote: any) => {
    if (!updatedNote || !currentNote) return;
    
    // 检查是否有未保存的本地更改
    const hasLocalChanges = saveStatus === 'unsaved' || 
                            title !== (currentNote?.title || '') || 
                            content !== (currentNote?.content || '');
    
    // 如果有本地更改，先保存到版本历史
    if (hasLocalChanges) {
      try {
        await createNoteVersion(currentNote.id, userId, title, content, tags);
        console.log("[NoteManager] 已保存本地更改到版本历史");
      } catch (err) {
        console.warn("[NoteManager] 保存版本历史失败:", err);
      }
    }
    
    // 加载云端最新版本
    setTitle(updatedNote.title || "");
    setContent(updatedNote.content || "");
    
    // 解析 tags
    const rawTags = (updatedNote as any).tags as string | null | undefined;
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
    
    setIsPinned(updatedNote.is_pinned || false);
    setIsPublished(updatedNote.is_published || false);
    setCurrentNote(updatedNote);
    const cloudUpdatedAt = updatedNote.updated_at || new Date().toISOString();
    lastSavedTimestampRef.current = cloudUpdatedAt;
    lastSaveTimeRef.current = new Date(cloudUpdatedAt).getTime();
    setSaveStatus('saved');
    setCloudUpdateNote(null);
    
    // 显示非阻塞的 Toast 提示
    toast({
      title: "已同步云端更新",
      description: hasLocalChanges 
        ? "本地更改已保存到版本历史，已加载云端最新版本" 
        : "已加载云端最新版本",
      duration: 3000,
    });
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

  // 桌面端：鼠标长按选择（按住 500ms 进入选择模式；拖动超过阈值则取消）
  const handleMouseDown = (id: string, e: React.MouseEvent) => {
    if (isSelectionMode) return;
    ignoreClickRef.current = false;
    ignoreTapOnceRef.current = false;
    mouseStartPosRef.current = { x: e.clientX, y: e.clientY };
    if (mouseTimerRef.current) {
      clearTimeout(mouseTimerRef.current);
      mouseTimerRef.current = null;
    }
    mouseTimerRef.current = setTimeout(() => {
      const newSet = new Set(selectedIds);
      newSet.add(id);
      setSelectedIds(newSet);
      ignoreClickRef.current = true; // 让接下来的 click 被忽略（避免直接打开）
    }, 500);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const start = mouseStartPosRef.current;
    if (!start || !mouseTimerRef.current) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    if (dx > 6 || dy > 6) {
      // 用户在拖动：取消长按选择，避免误触
      ignoreTapOnceRef.current = true;
      clearTimeout(mouseTimerRef.current);
      mouseTimerRef.current = null;
    }
  };

  const handleMouseUp = () => {
    if (mouseTimerRef.current) {
      clearTimeout(mouseTimerRef.current);
      mouseTimerRef.current = null;
    }
    mouseStartPosRef.current = null;
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
  
  const handleFolderClick = (folder: any) => {
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
      toggleSelection(folder.id);
    } else if (onEnterFolder) {
      onEnterFolder(folder.id, folder.name);
    }
  };
  const handleDelete = async () => {
    const ids = Array.from(selectedIds);
    // 分离文件夹ID和笔记ID
    const folderIds = ids.filter(id => subFolders.some(f => f.id === id));
    const noteIds = ids.filter(id => notes.some(n => n.id === id));
    
    if (showTrash) {
      // 回收站：永久删除，需要确认
      setBatchDeleteDialogOpen(true);
    } else {
      // 删除文件夹
      if (folderIds.length > 0) {
        const { error: folderError } = await supabase.from('folders').delete().in('id', folderIds);
        if (folderError) {
          toast({
            title: "删除失败",
            description: folderError.message || "删除文件夹时出错",
            variant: "destructive",
          });
          return;
        }
        setSubFolders(prev => prev.filter(f => !folderIds.includes(f.id)));
      }
      
      // 删除笔记：移入回收站
      if (noteIds.length > 0) {
        const { error: noteError } = await supabase.from('notes').update({ is_deleted: true }).in('id', noteIds);
        if (noteError) {
          toast({
            title: "删除失败",
            description: noteError.message || "删除笔记时出错",
            variant: "destructive",
          });
          return;
        }
        setNotes(prev => prev.filter(n => !noteIds.includes(n.id)));
      }
      
      if (folderIds.length > 0 || noteIds.length > 0) {
        exitSelectionMode();
        toast({
          title: "删除成功",
          description: `${folderIds.length > 0 ? `${folderIds.length} 个文件夹已删除，` : ''}${noteIds.length > 0 ? `${noteIds.length} 个笔记已移入回收站` : ''}`,
          variant: "default",
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
    const id = Array.from(selectedIds)[0];
    const note = notes.find(n => n.id === id);
    // 文件夹不支持复制内容
    if (note) {
      navigator.clipboard.writeText(note.content || "");
      toast({
        title: "已复制",
        description: "笔记内容已复制到剪贴板",
        variant: "success",
      });
      exitSelectionMode();
    } else {
      toast({
        title: "无法复制",
        description: "文件夹不支持复制操作",
        variant: "default",
      });
    }
  };
  const handleRename = () => {
    if (selectedIds.size !== 1) return;
    const id = Array.from(selectedIds)[0];
    // 检查是文件夹还是笔记
    const folder = subFolders.find(f => f.id === id);
    const note = notes.find(n => n.id === id);
    
    if (folder) {
      // 重命名文件夹
      setRenameNoteId(id);
      setRenameInput(folder.name || "");
      setRenameDialogOpen(true);
    } else if (note) {
      // 重命名笔记
      setRenameNoteId(id);
      setRenameInput(note.title || "");
      setRenameDialogOpen(true);
    }
  };

  const confirmRename = async () => {
    if (!renameNoteId || !renameInput.trim()) {
      setRenameDialogOpen(false);
      return;
    }
    
    // 检查是文件夹还是笔记
    const folder = subFolders.find(f => f.id === renameNoteId);
    const note = notes.find(n => n.id === renameNoteId);
    
    if (folder) {
      // 重命名文件夹
      if (renameInput.trim() === folder.name) {
        setRenameDialogOpen(false);
        setRenameNoteId(null);
        setRenameInput("");
        return;
      }
      const { error } = await supabase
        .from('folders')
        .update({ name: renameInput.trim() })
        .eq('id', renameNoteId);
      if (!error) {
        setSubFolders(prev => prev.map(f => f.id === renameNoteId ? { ...f, name: renameInput.trim() } : f));
        toast({
          title: "重命名成功",
          description: "文件夹名称已更新",
          variant: "success",
        });
        fetchSubFolders();
        exitSelectionMode();
      } else {
        toast({
          title: "重命名失败",
          description: error.message || "更新文件夹名称时出错",
          variant: "destructive",
        });
      }
    } else if (note) {
      // 重命名笔记
      if (renameInput.trim() === note.title) {
        setRenameDialogOpen(false);
        setRenameNoteId(null);
        setRenameInput("");
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
    }
    setRenameDialogOpen(false);
    setRenameNoteId(null);
    setRenameInput("");
  };
  
  // 🔥 批量置顶逻辑（仅对笔记有效）
  const handlePin = async () => {
      // 只处理笔记，过滤掉文件夹
      const noteIds = Array.from(selectedIds).filter(id => notes.some(n => n.id === id));
      if (noteIds.length === 0) {
        toast({
          title: "无法置顶",
          description: "文件夹不支持置顶操作",
          variant: "default",
        });
        return;
      }
      // 智能判断：如果选中的全都是已置顶，则全部取消；否则全部置顶
      const allPinned = notes.filter(n => noteIds.includes(n.id)).every(n => n.is_pinned);
      const newStatus = !allPinned;

      const { error } = await supabase.from('notes').update({ is_pinned: newStatus }).in('id', noteIds);
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
          {/* 过渡动画优化：页面切换 - 进入编辑页：淡入 + 上滑，300ms ease-out */}
          <div
            className={cn(
            "fixed left-0 right-0 top-0 bg-background z-50 flex flex-col",
            "animate-in fade-in-0 slide-in-from-bottom-4 duration-300 ease-out",
            zenMode && "bg-background"
          )}
            style={{
              // Follow the *visual* viewport so the editor isn't covered by the on-screen keyboard
              height: "var(--vvh, 100dvh)",
              transform: "translateY(var(--vv-offset-top, 0px))",
            }}
          >
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
                        // 过渡动画优化：退出编辑页 - 淡出 + 下滑，200ms ease-in
                        // 使用 setTimeout 延迟切换，让退出动画生效
                        setTimeout(() => {
                          setView("list");
                          fetchNotes();
                        }, 100);
                      }}
                    >
                      <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-1" />
                      <span className="hidden sm:inline">返回</span>
                    </Button>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide flex-1 justify-end min-w-0">
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                      
                      {/* PC端优化：工具栏按钮分组和视觉优化 */}
                      {!zenMode && (
                        <>
                          {/* 第一组：插入功能 */}
                          <div className="hidden sm:flex items-center gap-1 px-1.5 py-1 rounded-md bg-accent/30 border border-border/50">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 shrink-0 hover:bg-accent/80 transition-all" 
                              title="插入表格" 
                              onClick={handleInsertTable}
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
                          
                          {/* 第二组：笔记操作 */}
                          <div className="hidden sm:flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 shrink-0 hover:bg-accent transition-all" 
                              onClick={togglePin} 
                              title={isPinned ? "取消置顶" : "置顶笔记"}
                            >
                              <Pin className={cn(
                                "w-4 h-4 transition-all", 
                                isPinned 
                                  ? "fill-yellow-500 text-yellow-500 rotate-45" 
                                  : "text-foreground/60 hover:text-foreground"
                              )} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 shrink-0 hover:bg-accent transition-all" 
                              onClick={togglePublish} 
                              title={isPublished ? "已发布" : "发布到 Web"}
                            >
                              <Globe className={cn(
                                "w-4 h-4 transition-all", 
                                isPublished 
                                  ? "text-blue-500" 
                                  : "text-foreground/60 hover:text-foreground"
                              )} />
                            </Button>
                          </div>
                          
                          {/* 分隔线 */}
                          <div className="w-[1px] h-6 bg-border/60 mx-1 shrink-0 hidden sm:block"></div>
                          
                          {/* 第三组：编辑操作 */}
                          <div className="hidden sm:flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 shrink-0 flex items-center gap-1.5 hover:bg-accent transition-all"
                              disabled={!canRevert}
                              onClick={handleRevertToLastSaved}
                              title={!canRevert ? "无可撤回操作" : "撤回到上一步"}
                            >
                              <RotateCcw className={cn(
                                "w-4 h-4 transition-colors",
                                canRevert ? "text-foreground/70" : "text-muted-foreground/50"
                              )} />
                              <span className="text-xs font-medium">撤回</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 hover:bg-accent transition-all"
                              title="版本历史"
                              onClick={handleOpenVersionHistory}
                            >
                              <History className="w-4 h-4 text-foreground/60 hover:text-foreground transition-colors" />
                            </Button>
                          </div>
                          
                          {/* 分隔线 */}
                          <div className="w-[1px] h-6 bg-border/60 mx-1 shrink-0 hidden sm:block"></div>
                          
                          {/* 第四组：危险操作 */}
                          <div className="hidden sm:flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-all"
                              title="删除笔记"
                              onClick={handleDeleteCurrentNote}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </>
                      )}
                      
                      {/* 分隔线 */}
                      <div className="w-[1px] h-6 bg-border/60 mx-1 shrink-0 hidden sm:block"></div>
                      
                      {/* 第五组：视图切换 */}
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
                      
                      {/* 移动端优化：参考主流产品设计风格（iOS/Material Design/Notion） */}
                      <div className="relative sm:hidden" ref={moreMenuRef}>
                        <button
                          ref={moreButtonRef}
                          type="button"
                          className={cn(
                            "shrink-0 inline-flex items-center justify-center",
                            // 主流产品风格：圆形按钮，无边框
                            "h-9 w-9 rounded-full",
                            "text-sm font-medium transition-all duration-150 ease-out",
                            // iOS/Notion 风格：极简设计，透明背景，无边框
                            "bg-transparent",
                            "hover:bg-accent/50",
                            "active:bg-accent active:scale-95",
                            "disabled:pointer-events-none disabled:opacity-40",
                            "touch-manipulation min-w-[36px] min-h-[36px]",
                            // 菜单打开时的状态：轻微背景色变化
                            moreMenuOpen && "bg-accent/60"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (moreButtonRef.current) {
                              const rect = moreButtonRef.current.getBoundingClientRect();
                              setMenuPosition({
                                top: rect.bottom + 8,
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
                                top: rect.bottom + 8,
                                right: window.innerWidth - rect.right
                              });
                            }
                            setMoreMenuOpen((prev) => !prev);
                          }}
                        >
                          {/* 主流产品风格：简洁的图标，标准大小 */}
                          <MoreVertical className={cn(
                            "w-5 h-5 transition-colors duration-150",
                            // iOS/Notion 风格：使用系统标准的图标颜色
                            "text-foreground/80",
                            moreMenuOpen && "text-foreground"
                          )} />
                        </button>
                      </div>
                      
                      {/* 更多菜单弹出层 - 参考主流产品设计风格（iOS/Material Design） */}
                      {moreMenuOpen && typeof document !== 'undefined' && createPortal(
                        <>
                          {/* 主流产品风格：点击外部区域关闭菜单 */}
                          <div
                            className="fixed inset-0 z-[99998] bg-black/20 backdrop-blur-sm"
                            onClick={() => setMoreMenuOpen(false)}
                            onTouchEnd={() => setMoreMenuOpen(false)}
                            aria-hidden
                          />
                          {/* 主流产品风格：圆角卡片菜单，毛玻璃效果 */}
                          <div
                            ref={moreMenuPortalRef}
                            className={cn(
                              "fixed z-[99999] py-2",
                              "w-56 rounded-2xl",
                              // iOS/Notion 风格：毛玻璃效果，极细边框
                              "bg-popover/95 backdrop-blur-xl",
                              "border border-border/40",
                              "shadow-2xl",
                              // 主流产品风格：平滑动画
                              "animate-in fade-in-0 zoom-in-95 duration-200"
                            )}
                            style={{ 
                              // 移动端优化：菜单显示在按钮下方
                              top: `${menuPosition.top}px`,
                              right: `${Math.max(12, menuPosition.right)}px`,
                              maxWidth: `calc(100vw - 24px)`
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                          >
                            {!zenMode && (
                              <>
                                <button
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 touch-manipulation transition-colors duration-150"
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
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 touch-manipulation transition-colors duration-150"
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
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 touch-manipulation transition-colors duration-150"
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
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 touch-manipulation transition-colors duration-150"
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
                                {/* 主流产品风格：更精致的分隔线 */}
                                <div className="h-px bg-border/50 my-1.5 mx-2"></div>
                                <button
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 touch-manipulation transition-colors duration-150"
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
                                {/* 主流产品风格：更精致的分隔线 */}
                                <div className="h-px bg-border/50 my-1.5 mx-2"></div>
                              </>
                            )}
                            <button
                              className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation transition-colors duration-150"
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
                              className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 touch-manipulation transition-colors duration-150"
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
                            {/* 主流产品风格：更精致的分隔线 */}
                            <div className="h-px bg-border/50 my-1.5 mx-2"></div>
                            <button
                              className="w-full px-4 py-3 text-left text-sm hover:bg-red-500/10 active:bg-red-500/20 text-red-500 flex items-center gap-3 touch-manipulation transition-colors duration-150"
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
                              className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 active:bg-accent flex items-center gap-3 touch-manipulation transition-colors duration-150"
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
                        </>
                        , document.body
                      )}
                      
                      {/* 移动端优化：参考主流产品设计，重新布局右侧按钮 */}
                      <div className="flex items-center gap-2 sm:gap-1.5 shrink-0">
                        {/* 编辑/预览切换（专注模式下隐藏） */}
                        {!zenMode && (
                          <button 
                            onClick={() => setPreviewMode(!previewMode)} 
                            className="shrink-0 flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/80 transition touch-manipulation"
                          >
                            {previewMode ? (
                              <>
                                <PenLine size={12} className="sm:w-3.5 sm:h-3.5"/>
                                <span className="hidden sm:inline">编辑</span>
                              </>
                            ) : (
                              <>
                                <Eye size={12} className="sm:w-3.5 sm:h-3.5"/>
                                <span className="hidden sm:inline">预览</span>
                              </>
                            )}
                          </button>
                        )}
                        
                        {/* 移动端优化：合并状态指示器，只在重要状态时显示 */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* PC端：完整显示网络状态和保存状态 */}
                          <div className="hidden sm:flex items-center gap-1.5">
                            {/* 指示状态优化：网络状态显示 */}
                            {!isOnlineState ? (
                              <div className="flex items-center gap-1.5 text-xs text-red-500 animate-in fade-in-0 duration-200" title="离线模式 - 更改将保存到本地">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <WifiOff className="w-3 h-3" />
                                <span>离线</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-green-500" title="在线 - 更改将同步到云端">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span>在线</span>
                              </div>
                            )}
                            {/* 保存状态优化：图标 + 动画反馈 */}
                            <div className="flex items-center gap-1.5 text-xs shrink-0">
                              {saveStatus === 'saving' ? (
                                <div className="flex items-center gap-1.5 text-blue-500 animate-in fade-in-0 duration-200">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>保存中...</span>
                                </div>
                              ) : saveStatus === 'error' ? (
                                <div className="flex items-center gap-1.5 text-red-500 animate-in fade-in-0 duration-200">
                                  <X className="w-3.5 h-3.5 animate-in zoom-in-50 duration-200" />
                                  <span>保存失败</span>
                                </div>
                              ) : saveStatus === 'unsaved' ? (
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
                          
                          {/* 移动端优化：精简状态显示，只在异常状态时显示 */}
                          <div className="flex items-center gap-1.5 sm:hidden">
                            {/* 只在离线或保存失败时显示网络状态 */}
                            {!isOnlineState && (
                              <div 
                                className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" 
                                title="离线模式 - 更改将保存到本地"
                              />
                            )}
                            {/* 保存状态：只在非正常状态时显示图标 */}
                            {saveStatus === 'saving' ? (
                              <div title="保存中...">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
                              </div>
                            ) : saveStatus === 'error' ? (
                              <div title="保存失败">
                                <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              </div>
                            ) : saveStatus === 'unsaved' ? (
                              <div title="未保存">
                                <Pencil className="w-3.5 h-3.5 animate-pulse text-yellow-500 shrink-0" />
                              </div>
                            ) : null}
                            {/* 已保存状态：移动端不显示，减少视觉干扰 */}
                          </div>
                        </div>
                        
                        {/* 内容辅助功能：字数统计 */}
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
              <div className={cn(
                "flex-1 mx-auto w-full flex flex-col overflow-y-auto min-h-0",
                // 内容区域优化：根据屏幕尺寸动态调整行宽
                // 移动端优化：为底部工具栏预留空间，避免被键盘遮挡
                "pb-20 sm:pb-0",
                zenMode 
                  ? "max-w-4xl px-8 py-12" 
                  : "max-w-full sm:max-w-3xl md:max-w-4xl p-3 sm:p-4 md:p-8"
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
                  <div className="relative group">
                    <Input
                      value={title}
                      onChange={(e) => {
                        let newTitle = e.target.value;
                        // 支持 Markdown 标题语法：自动识别 # ## ###
                        // 实际存储时保留原始输入（包含 #）
                        handleContentChange(newTitle, content);
                      }}
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
                        "transition-all duration-200",
                        "relative",
                        zenMode 
                          ? "text-4xl md:text-5xl font-bold py-6" 
                          : "text-3xl md:text-4xl font-bold py-4",
                        previewMode && "opacity-80 pointer-events-none",
                        // 支持 Markdown 标题语法显示
                        title.startsWith('# ') && "text-2xl md:text-3xl",
                        title.startsWith('## ') && "text-xl md:text-2xl",
                        title.startsWith('### ') && "text-lg md:text-xl"
                      )}
                    />
                    {/* 下划线装饰 - 仅在聚焦时显示 */}
                    <div 
                      className={cn(
                        "absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-200",
                        "w-0 opacity-0 group-focus-within:w-full group-focus-within:opacity-100"
                      )}
                    />
                  </div>
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
                    <div className={cn(
                      "relative mt-4 flex flex-col",
                      // 移动端固定高度，桌面端使用 flex-1
                      typeof window !== 'undefined' && window.innerWidth < 768 
                        ? "h-[calc(100dvh-14rem)]" // 移动端固定高度（减去 header 和 padding）
                        : "flex-1 min-h-0" // 桌面端自适应
                    )}>
                      {/* SegmentedEditor 已内置表格编辑功能，不再需要 TableEditor 对话框 */}
                      
                      {/* 使用 SegmentedEditor：自动将表格显示为可视化表格 */}
                      <div
                        ref={editorScrollContainerRef}
                        className={cn(
                          "overflow-y-auto",
                          // 移动端固定高度，桌面端自适应
                          typeof window !== 'undefined' && window.innerWidth < 768 
                            ? "h-full" // 移动端占满父容器
                            : "flex-1 min-h-0" // 桌面端自适应
                        )}
                        style={{
                          // Give extra bottom room for toolbars + safe area + keyboard inset fallback
                          scrollPaddingBottom: 'calc(120px + env(safe-area-inset-bottom, 0px) + var(--vv-bottom-inset, 0px))',
                          WebkitOverflowScrolling: 'touch' as any,
                        } as React.CSSProperties}
                        onScroll={(e) => {
                          // 保存滚动位置，用于移动端编辑后恢复
                          if (e.currentTarget) {
                            savedScrollTopRef.current = e.currentTarget.scrollTop;
                          }
                        }}
                        onBlur={(e) => {
                          const next = e.relatedTarget as Node | null;
                          if (next && e.currentTarget.contains(next)) return;
                          if (editorScrollContainerRef.current) {
                            savedScrollTopRef.current = editorScrollContainerRef.current.scrollTop;
                          }
                        }}
                      >
                        <SegmentedEditor
                          content={content}
                          onChange={handleSegmentedEditorChange}
                          placeholder="开始输入内容 (支持 Markdown，输入 [[ 以引用其他笔记)..."
                          className={cn(
                            "w-full min-h-[200px]",
                            // 内容区域优化：行高 1.75，字间距 0.01em
                            zenMode 
                              ? "text-lg leading-[1.75] tracking-[0.01em]" 
                              : "text-base sm:text-lg leading-[1.75] tracking-[0.01em]"
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
                      {/* 内容辅助功能：标签补全菜单 */}
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
                                  handleInsertTag(tag);
                                }}
                              >
                                <div className="font-medium truncate">
                                  #{tag}
                                </div>
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
          
          {/* 移动端优化：底部固定工具栏 */}
          {view === 'editor' && (
            <div className="fixed bottom-0 left-0 right-0 sm:hidden z-50 bg-background/95 backdrop-blur-md border-t border-border shadow-lg safe-area-inset-bottom" style={{ bottom: 'calc(0px + var(--vv-bottom-inset, 0px))' }}>
              <div className="flex items-center justify-around px-2 py-2 gap-1" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
                {/* 常用功能：保存、预览、专注 */}
                <button
                  onClick={() => {
                    if (saveStatus === 'unsaved') {
                      saveNote(title, content, isPinned, isPublished, tags);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all touch-manipulation",
                    "min-w-[44px] min-h-[44px]",
                    saveStatus === 'unsaved' ? "bg-primary text-primary-foreground" : "bg-accent/50 text-accent-foreground"
                  )}
                  title="保存"
                >
                  {saveStatus === 'saving' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : saveStatus === 'saved' ? (
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
                      "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all touch-manipulation",
                      "min-w-[44px] min-h-[44px]",
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
                    "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all touch-manipulation",
                    "min-w-[44px] min-h-[44px]",
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
                
                {/* 更多功能按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (moreButtonRef.current) {
                      const rect = moreButtonRef.current.getBoundingClientRect();
                      setMenuPosition({
                        top: rect.top - 200, // 在底部工具栏上方显示
                        right: window.innerWidth - rect.right
                      });
                    }
                    setMoreMenuOpen((prev) => !prev);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all touch-manipulation",
                    "min-w-[44px] min-h-[44px]",
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

  // --- 列表视图：搜索框及以上固定，仅笔记网格滚动 ---
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          className="flex flex-col h-[calc(100dvh-6rem)] max-h-[calc(100dvh-6rem)] min-h-0"
          onClick={(e) => { if (e.target === e.currentTarget && isSelectionMode) exitSelectionMode(); }}
        >
        <header className="shrink-0 bg-background/80 backdrop-blur z-10 border-b border-border/40">
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2 min-w-10 min-h-10 touch-manipulation shrink-0"><ArrowLeft className="w-5 h-5" /></Button>
                    <h1 className="text-base sm:text-lg font-bold truncate flex-1 min-w-0">{showTrash ? "回收站" : folderName}</h1>
                    {/* 桌面端显示数量，移动端隐藏（已移到底部） */}
                    {!showTrash && (
                      <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full shrink-0 hidden sm:inline">
                        {subFolders.length > 0 && `${subFolders.length} 文件夹 `}
                        {notes.length} 笔记
                      </span>
                    )}
                    {showTrash && (
                      <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full shrink-0 hidden sm:inline">{notes.length}</span>
                    )}
                </div>
                <div className="flex gap-2 items-center shrink-0">
                    {/* 桌面端按钮 */}
                    <Button variant={showTrash ? "destructive" : "ghost"} size="sm" onClick={() => { setShowTrash(!showTrash); setView('list'); }} className="sm:inline hidden">
                      {showTrash ? <ArrowLeft size={14}/> : <Trash2 size={18} className="text-muted-foreground hover:text-red-500 transition"/>}
                      {showTrash && <span className="sm:inline hidden ml-1">返回笔记</span>}
                    </Button>
                    {/* 移动端图标按钮 */}
                    <Button variant={showTrash ? "destructive" : "ghost"} size="icon" onClick={() => { setShowTrash(!showTrash); setView('list'); }} className="sm:hidden">
                      {showTrash ? <ArrowLeft size={18}/> : <Trash2 size={18} className="text-muted-foreground hover:text-red-500 transition"/>}
                    </Button>
                    {!showTrash && !isSelectionMode && (
                        <>
                            {/* 桌面端按钮 */}
                            <Button size="sm" onClick={handleAddFolder} variant="outline" className="sm:inline hidden">
                              <Folder className="w-4 h-4 sm:mr-1"/>
                              <span className="sm:inline hidden">新文件夹</span>
                            </Button>
                            <Button size="sm" onClick={handleAddNote} variant="outline" className="sm:inline hidden">
                              <Plus className="w-4 h-4 sm:mr-1"/>
                              <span className="sm:inline hidden">新笔记</span>
                            </Button>
                            {/* 移动端图标按钮 */}
                            <Button size="icon" onClick={handleAddFolder} variant="outline" className="sm:hidden">
                              <Folder className="w-4 h-4" />
                            </Button>
                            <Button size="icon" onClick={handleAddNote} variant="outline" className="sm:hidden">
                              <Plus className="w-4 h-4" />
                            </Button>
                        </>
                    )}
                </div>
            </div>
            <div className="px-4 pb-3"><div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><Input placeholder={showTrash ? "搜索回收站..." : "搜索笔记..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-accent/50 border-none h-9"/></div></div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pb-32" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-3 p-3 sm:p-4">
            {/* 显示子文件夹 */}
            {!showTrash && filteredSubFolders.map((folder) => {
              const isSelected = selectedIds.has(folder.id);
              return (
                <div
                  key={folder.id}
                  className={cn(
                    "relative h-36 p-4 rounded-xl border flex flex-col justify-between transition-all select-none cursor-pointer touch-pan-y",
                    isSelected ? "bg-accent border-blue-500 shadow-[0_0_0_1px_#3b82f6]" : "bg-card border-border hover:bg-accent/50 active:scale-95"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFolderClick(folder);
                  }}
                  onTouchStart={(e: React.TouchEvent) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleTouchStart(folder.id, e);
                  }}
                  onTouchMove={(e: React.TouchEvent) => {
                    e.stopPropagation();
                    handleTouchMove(e);
                  }}
                  onTouchEnd={(e: React.TouchEvent) => {
                    e.stopPropagation();
                    handleTouchEnd();
                  }}
                  onMouseDown={(e: React.MouseEvent) => {
                    // 桌面端也支持长按选择（使用鼠标按下）
                    if (!isSelectionMode) {
                      e.stopPropagation();
                      handleTouchStart(folder.id);
                    }
                  }}
                  onMouseUp={(e: React.MouseEvent) => {
                    handleTouchEnd();
                  }}
                  onMouseLeave={(e: React.MouseEvent) => {
                    // 鼠标移出时取消长按
                    if (timerRef.current) {
                      clearTimeout(timerRef.current);
                      timerRef.current = null;
                    }
                  }}
                  onMouseDown={(e: React.MouseEvent) => {
                    // 桌面端也支持长按选择（使用鼠标按下）
                    if (!isSelectionMode) {
                      handleTouchStart(folder.id);
                    }
                  }}
                  onMouseUp={(e: React.MouseEvent) => {
                    handleTouchEnd();
                  }}
                  onMouseLeave={(e: React.MouseEvent) => {
                    // 鼠标移出时取消长按
                    if (timerRef.current) {
                      clearTimeout(timerRef.current);
                      timerRef.current = null;
                    }
                  }}
                >
                  <div>
                    <h3 className="font-bold text-sm mb-1 truncate flex items-center gap-1">
                      <Folder className={cn("w-4 h-4", isSelected ? "text-blue-500 fill-blue-500/20" : "text-yellow-500 fill-yellow-500/20")} />
                      {folder.name || "无名称"}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">文件夹</p>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-muted-foreground">{new Date(folder.created_at).toLocaleDateString()}</span>
                    {isSelectionMode ? (
                      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", isSelected ? "bg-blue-500" : "border-2 border-zinc-400")}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    ) : (
                      <Folder className="w-3 h-3 text-muted-foreground/30" />
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* 显示笔记 */}
            {filteredNotes.length === 0 && filteredSubFolders.length === 0 && !showTrash && (
              <div className="col-span-2 text-center py-10 text-muted-foreground border-2 border-dashed border-border rounded-xl flex flex-col items-center gap-2">
                {searchQuery ? <p>未找到相关内容</p> : <p>这里空空如也</p>}
              </div>
            )}
            {filteredNotes.length === 0 && filteredSubFolders.length === 0 && showTrash && (
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
                onClick={() => handleListClick(note)}
                onTouchStart={(e: React.TouchEvent) => handleTouchStart(note.id, e)}
                onTouchMove={(e: React.TouchEvent) => handleTouchMove(e)}
                onTouchEnd={handleTouchEnd}
                // 桌面端支持鼠标长按选择；拖动会自动取消长按，并交给 dnd-kit 做拖拽
                onMouseDown={(e: React.MouseEvent) => handleMouseDown(note.id, e)}
                onMouseMove={(e: React.MouseEvent) => handleMouseMove(e)}
                onMouseUp={() => handleMouseUp()}
              />
            ))}
        </div>
        {/* 底部数量显示：移动端显示，桌面端隐藏（已在 header 显示） */}
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
            <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full">{notes.length}</span>
          </div>
        )}
        </div>

        <div className={cn("fixed left-0 right-0 flex justify-center z-50 transition-all duration-300", "bottom-[calc(2rem+env(safe-area-inset-bottom,0px)+var(--vv-bottom-inset,0px))]", isSelectionMode ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none")}>
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
        {/* 新建文件夹对话框 */}
        <Dialog open={createFolderDialogOpen} onOpenChange={setCreateFolderDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>新建文件夹</DialogTitle>
              <DialogDescription>
                在当前文件夹内创建新文件夹
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Input
                className="w-full"
                placeholder="输入文件夹名称"
                value={folderNameInput}
                onChange={(e) => setFolderNameInput(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && folderNameInput.trim()) {
                    handleCreateFolder();
                  }
                }}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreateFolderDialogOpen(false)}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateFolder}
                  disabled={!folderNameInput.trim()}
                >
                  确定
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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