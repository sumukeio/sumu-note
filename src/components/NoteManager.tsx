"use client";

/**
 * 数据流说明（编辑态与服务器一致性）：
 * - 编辑态：以本地 state（title/content/tags 等）为准。
 * - 保存成功后：以服务器返回的 updated_at 为准，用于 Realtime 自更新过滤与冲突判断。
 * - Realtime 收到他人/他端更新：经用户确认或自动拉取后，以服务器为准覆盖本地 state。
 * - 冲突策略：last-write-wins；每次保存会写入 note_versions 表，便于历史恢复。
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Copy, Trash2, FolderInput, X, Check, Loader2, Plus,
  FileText, ArrowLeft, Pencil, Search, RotateCcw, Pin, Image as ImageIcon, Globe, Maximize2, Minimize2, MoreVertical, WifiOff, Wifi, History, Table, Folder
} from "lucide-react"; 
import { supabase } from "@/lib/supabase";
import {
  getNotes,
  getNoteByIdInFolder,
  createNote,
  updateNote,
  deleteNote,
  deleteNotes,
  setNotesDeleted,
  setNotesPinned,
  moveNoteToFolder,
  moveNotesToFolder,
} from "@/lib/note-service";
import { useNoteSave } from "@/hooks/useNoteSave";
import { useNoteRealtime } from "@/hooks/useNoteRealtime";
import { useLinkComplete } from "@/hooks/useLinkComplete";
import { useTagComplete } from "@/hooks/useTagComplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { createNoteVersion, getNoteVersions, type NoteVersion } from "@/lib/version-history";
import { isOnline, onNetworkStatusChange, savePendingSyncNote, syncPendingNotes } from "@/lib/offline-storage";
import { NoteList } from "@/components/NoteList";
import { NoteEditor } from "@/components/NoteEditor";
import { type Match } from "@/lib/search-utils";
import type { Note, FolderItem } from "@/types/note";

import { TouchSensor, MouseSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';

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

// --- 主组件 ---
export default function NoteManager({ userId, folderId, folderName, onBack, onEnterFolder, initialNoteId }: NoteManagerProps) {
  const { toast } = useToast();
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [notes, setNotes] = useState<Note[]>([]);
  const [subFolders, setSubFolders] = useState<FolderItem[]>([]); // 子文件夹列表
  const [loading, setLoading] = useState(true);
  
  // 编辑器状态
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  // 撤回栈：记录之前的编辑状态（多步撤回）
  const [undoStack, setUndoStack] = useState<{ title: string; content: string }[]>([]);
  const lastChangeTimeRef = useRef<number | null>(null);
  const [zenMode, setZenMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const { save: saveNote, saveStatus, setSaveStatus, refs: saveRefs } = useNoteSave(
    currentNote,
    userId,
    { toast, onTitleDerived: setTitle }
  );
  const [isPinned, setIsPinned] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isOnlineState, setIsOnlineState] = useState(true); // 网络状态
  
  // 实时同步相关状态
  const [cloudUpdateNote, setCloudUpdateNote] = useState<Note | null>(null);
  const [deleteNoteDialogOpen, setDeleteNoteDialogOpen] = useState(false); // 删除笔记确认对话框
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false); // 批量删除确认对话框
  const [renameDialogOpen, setRenameDialogOpen] = useState(false); // 重命名对话框
  const [renameNoteId, setRenameNoteId] = useState<string | null>(null); // 待重命名的笔记ID
  const [renameInput, setRenameInput] = useState(""); // 重命名输入框
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null); // 待删除的笔记ID
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false); // 新建文件夹对话框
  const [folderNameInput, setFolderNameInput] = useState(""); // 文件夹名称输入框
  // 子文件夹移动对话框
  const [moveSubfolderDialogOpen, setMoveSubfolderDialogOpen] = useState(false);
  const [moveSubfolderTargets, setMoveSubfolderTargets] = useState<FolderItem[]>([]);
  const [lastMoveTargetId, setLastMoveTargetId] = useState<string | null>(null);

  // 读取上次移动目标（本地缓存，按用户区分）
  useEffect(() => {
    if (typeof window === "undefined" || !userId) return;
    try {
      const key = `sumunote:lastMoveFolder:${userId}`;
      const stored = window.localStorage.getItem(key);
      if (stored) {
        setLastMoveTargetId(stored);
      }
    } catch {
      // 忽略本地存储错误
    }
  }, [userId]);

  const [wordStats, setWordStats] = useState({ words: 0, paragraphs: 0, readingTime: 0 }); // 字数统计

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

  // --- [[ 链接补全（useLinkComplete）---
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const editorScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const savedScrollTopRef = useRef<number>(0);
  // 移动端写作模式：键盘弹出 + 正文编辑时，精简布局和底部工具栏
  const [isMobileWritingMode, setIsMobileWritingMode] = useState(false);
  const onLinkContentReplaceRef = useRef<(newContent: string) => void>(() => {});
  const stableOnLinkContentReplace = useCallback((newContent: string) => {
    onLinkContentReplaceRef.current?.(newContent);
  }, []);
  const linkComplete = useLinkComplete(content, notes, stableOnLinkContentReplace);
  const allTags = useMemo(() => {
    return Array.from(
      new Set(
        notes.flatMap((n) => {
          const rawTags = n.tags;
          if (rawTags) {
            return rawTags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
          }
          return [];
        })
      )
    );
  }, [notes]);
  const onTagContentReplaceRef = useRef<(newContent: string) => void>(() => {});
  const stableOnTagContentReplace = useCallback((newContent: string) => {
    onTagContentReplaceRef.current?.(newContent);
  }, []);
  const tagComplete = useTagComplete(content, allTags, stableOnTagContentReplace);

  // --- 获取数据 ---
  const fetchNotes = async () => {
      try {
        const data = await getNotes(userId, {
          folder_id: folderId,
          is_deleted: showTrash ? true : false,
        });
        setNotes(data);
      } catch (e) {
        console.error("fetchNotes error:", e);
      } finally {
        setLoading(false);
        setSelectedIds(new Set());
      }
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
    getNoteByIdInFolder(initialNoteId, userId, folderId)
      .then((data) => {
        if (data) {
          enterEditor(data);
          setTimeout(() => {
            isProcessingInitialNoteRef.current = false;
          }, 100);
        } else {
          console.warn("Failed to load note: not found in folder");
          processedInitialNoteIdRef.current = null;
          isProcessingInitialNoteRef.current = false;
        }
      })
      .catch(() => {
        processedInitialNoteIdRef.current = null;
        isProcessingInitialNoteRef.current = false;
      });
    // 移除 view 依赖，避免 enterEditor 调用 setView('editor') 时触发循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNoteId, userId, folderId, notes.length, loading]);

  const filteredNotes = notes.filter(note => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const noteTags = (note.tags ?? "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
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
  const enterEditor = (note: Note) => { 
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
      const rawTags = note.tags;
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
      // 记录初始时间戳（供 Realtime 自更新过滤使用）
      saveRefs.lastSavedTimestampRef.current = note.updated_at || new Date().toISOString();
  };

  const handleAddNote = async () => {
    try {
      const data = await createNote({ user_id: userId, folder_id: folderId, title: "", content: "" });
      enterEditor(data);
      toast({
        title: "新笔记已创建",
        description: "点击撤销可删除此空白笔记",
        variant: "default",
        duration: 5000,
        undoAction: async () => {
          await deleteNote(data.id, userId);
          setView("list");
          fetchNotes();
          toast({ title: "已撤销创建", description: "空白笔记已删除", variant: "default", duration: 3000 });
        },
      });
    } catch (e) {
      toast({ title: "创建失败", description: (e as Error).message || "创建笔记时出错", variant: "destructive" });
    }
  };
  
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
      // 刷新后获取新建文件夹的 id，供撤销时删除
      const { data: newFolderData } = await supabase
        .from("folders")
        .select("id")
        .eq("user_id", userId)
        .eq("name", name)
        .eq("parent_id", folderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      toast({
        title: "创建成功",
        description: `文件夹「${name}」已创建`,
        variant: "default",
        duration: 5000,
        undoAction: newFolderData ? async () => {
          await supabase.from("folders").delete().eq("id", newFolderData.id);
          fetchSubFolders();
          toast({ title: "已撤销创建", description: `文件夹「${name}」已删除`, variant: "default", duration: 3000 });
        } : undefined,
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
    // 编辑前保存滚动位置，避免编辑后页面回到顶部
    if (editorScrollContainerRef.current) {
      savedScrollTopRef.current = editorScrollContainerRef.current.scrollTop;
    }
    handleContentChange(title, newContent);
    // [[ 链接菜单由 useLinkComplete 根据 content 自动检测，此处不再维护

    // 桌面端：内容变化后恢复一次滚动位置，避免编辑时整页跳到顶部（只恢复一次，减少与编辑器内部时序冲突导致的抖动）
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      const restoreScroll = () => {
        if (editorScrollContainerRef.current && savedScrollTopRef.current !== null && savedScrollTopRef.current > 0) {
          editorScrollContainerRef.current.scrollTop = savedScrollTopRef.current;
        }
      };
      requestAnimationFrame(() => {
        restoreScroll();
        setTimeout(restoreScroll, 0);
      });
    }
  }, [title, handleContentChange]);

  // 移动端写作模式检测：利用 visualViewport 高度变化粗略判断键盘弹出/收起
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 768) {
      // 桌面端不启用写作模式
      setIsMobileWritingMode(false);
      return;
    }

    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) {
      // 不支持 visualViewport 时，保守处理：始终关闭写作模式
      setIsMobileWritingMode(false);
      return;
    }

    let initialHeight = vv.height;

    const handleResize = () => {
      const delta = initialHeight - vv.height;
      // 当可视高度显著变小时，认为键盘弹出，进入写作模式
      if (delta > 150) {
        setIsMobileWritingMode(true);
      } else {
        setIsMobileWritingMode(false);
      }
    };

    vv.addEventListener("resize", handleResize);

    return () => {
      vv.removeEventListener("resize", handleResize);
    };
  }, []);

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

  // 链接补全插入回调：注入到 useLinkComplete 使用的 ref，供 hook 调用
  useEffect(() => {
    onLinkContentReplaceRef.current = (newContent: string) => {
      setContent(newContent);
      handleContentChange(title, newContent);
    };
  }, [title, handleContentChange]);

  // 标签补全插入回调：注入到 useTagComplete 使用的 ref，供 hook 调用
  useEffect(() => {
    onTagContentReplaceRef.current = (newContent: string) => {
      setContent(newContent);
      handleContentChange(title, newContent);
    };
  }, [title, handleContentChange]);

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
  // 链接菜单键盘导航（↑↓ Enter Escape）由 useLinkComplete 内部处理

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
    
    try {
      await setNotesDeleted([deleteNoteId], userId, true);
      const deletedNoteId = deleteNoteId;
      toast({
        title: "已移入回收站",
        description: "笔记已移入回收站",
        variant: "default",
        duration: 5000,
        undoAction: async () => {
          if (deletedNoteId) {
            await setNotesDeleted([deletedNoteId], userId, false);
          }
          fetchNotes();
          toast({ title: "已撤销删除", description: "笔记已从回收站还原", variant: "default", duration: 3000 });
        },
      });
      setView("list");
      fetchNotes();
    } catch (e) {
      toast({ title: "删除失败", description: (e as Error).message || "删除笔记时出错", variant: "destructive" });
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
      if (newStatus && currentNote) {
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
      } catch (error: unknown) {
          toast({
            title: "上传失败",
            description: (error as Error)?.message || "图片上传时出错",
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
  const handleAutoSyncFromCloud = async (updatedNote: Note) => {
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
    const rawTags = updatedNote.tags;
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
    saveRefs.lastSavedTimestampRef.current = cloudUpdatedAt;
    saveRefs.lastSaveTimeRef.current = new Date(cloudUpdatedAt).getTime();
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

  const onCloudUpdateRef = useRef<(note: Record<string, unknown>) => void>(() => {});
  onCloudUpdateRef.current = (updatedNote: Record<string, unknown>) => {
    const note = updatedNote as unknown as Note;
    setCloudUpdateNote(note);
    handleAutoSyncFromCloud(note);
  };
  const stableOnCloudUpdate = useCallback(
    (updatedNote: Record<string, unknown>) => {
      onCloudUpdateRef.current?.(updatedNote);
    },
    []
  );
  useNoteRealtime(currentNote?.id ?? null, view, {
    saveRefs,
    onCloudUpdate: stableOnCloudUpdate,
  });

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
  const handleMouseDown = (id: string, e?: React.MouseEvent) => {
    if (isSelectionMode || !e) return;
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
  const handleListClick = (note: Note) => {
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
  
  const handleFolderClick = (folder: FolderItem) => {
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
      onEnterFolder(folder.id, folder.name ?? "");
    }
  };
  const handleDelete = async () => {
    const ids = Array.from(selectedIds);
    // 分离文件夹ID和笔记ID
    const folderIds = ids.filter(id => subFolders.some(f => f.id === id));
    const noteIds = ids.filter(id => notes.some(n => n.id === id));
    // 快照当前居此数据，供撤销时使用
    const deletedFoldersCopy = subFolders.filter(f => folderIds.includes(f.id));
    const deletedNotesCopy = notes.filter(n => noteIds.includes(n.id));
    
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
        try {
          await setNotesDeleted(noteIds, userId, true);
          setNotes(prev => prev.filter(n => !noteIds.includes(n.id)));
        } catch (noteError: unknown) {
          toast({
            title: "删除失败",
            description: (noteError as Error)?.message || "删除笔记时出错",
            variant: "destructive",
          });
          return;
        }
      }

      if (folderIds.length > 0 || noteIds.length > 0) {
        exitSelectionMode();
        toast({
          title: "删除成功",
          description: `${folderIds.length > 0 ? `${folderIds.length} 个文件夹已删除，` : ''}${noteIds.length > 0 ? `${noteIds.length} 个笔记已移入回收站` : ''}`,
          variant: "default",
          duration: 5000,
          undoAction: async () => {
            if (deletedFoldersCopy.length > 0) {
              await supabase.from("folders").insert(
                deletedFoldersCopy.map(({ id, name, parent_id, user_id }) => ({ id, name, parent_id, user_id: user_id ?? userId }))
              );
            }
            if (deletedNotesCopy.length > 0) {
              await setNotesDeleted(deletedNotesCopy.map((n) => n.id), userId, false);
            }
            fetchSubFolders();
            fetchNotes();
            toast({ title: "已撤销删除", description: "内容已还原", variant: "default", duration: 3000 });
          },
        });
      }
    }
  };

  // 从 dock 触发“移动”（支持同时移动子文件夹和笔记）
  const handleMoveSubfoldersClick = async () => {
    const ids = Array.from(selectedIds);
    const folderIds = ids.filter((id) => subFolders.some((f) => f.id === id));
    const noteIds = ids.filter((id) => notes.some((n) => n.id === id));
    if (folderIds.length === 0 && noteIds.length === 0) {
      toast({
        title: "无法移动",
        description: "请先选中要移动的文件夹或笔记",
        variant: "default",
      });
      return;
    }

    // 获取所有可作为目标的文件夹（排除当前选中的子文件夹本身）
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId);

    if (error || !data) {
      toast({
        title: "加载失败",
        description: error?.message || "加载文件夹列表时出错",
        variant: "destructive",
      });
      return;
    }

    // 目标文件夹不能是被移动的文件夹本身
    const targets = data.filter((f) => !folderIds.includes(f.id));
    if (targets.length === 0) {
      toast({
        title: "没有可移动到的位置",
        description: "没有可作为目标的其他文件夹",
        variant: "default",
      });
      return;
    }

    setMoveSubfolderTargets(targets);
    setMoveSubfolderDialogOpen(true);
  };

  const handleMoveSubfoldersToTarget = async (targetFolderId: string) => {
    const ids = Array.from(selectedIds);
    const folderIds = ids.filter((id) => subFolders.some((f) => f.id === id));
    const noteIds = ids.filter((id) => notes.some((n) => n.id === id));
    if (folderIds.length === 0 && noteIds.length === 0) {
      setMoveSubfolderDialogOpen(false);
      return;
    }

    // 先移动文件夹，再移动笔记
    if (folderIds.length > 0) {
      const { error: folderError } = await supabase
        .from("folders")
        .update({ parent_id: targetFolderId })
        .in("id", folderIds);

      if (folderError) {
        toast({
          title: "移动失败",
          description: folderError.message || "移动文件夹时出错",
          variant: "destructive",
        });
        return;
      }
    }

    if (noteIds.length > 0) {
      try {
        await moveNotesToFolder(noteIds, userId, targetFolderId);
      } catch (noteError: unknown) {
        toast({
          title: "移动失败",
          description: (noteError as Error)?.message || "移动笔记时出错",
          variant: "destructive",
        });
        return;
      }
    }

    const movedFoldersText =
      folderIds.length > 0 ? `${folderIds.length} 个文件夹` : "";
    const movedNotesText =
      noteIds.length > 0 ? `${noteIds.length} 篇笔记` : "";

    // 记住原始位置，供撤销时使用
    const originalFolderParents = folderIds.map((id) => ({
      id,
      parent_id: subFolders.find((f) => f.id === id)?.parent_id ?? null,
    }));
    const originalNoteParents = noteIds.map((id) => ({
      id,
      folder_id: notes.find((n) => n.id === id)?.folder_id ?? null,
    }));

    toast({
      title: "移动成功",
      description:
        movedFoldersText && movedNotesText
          ? `${movedFoldersText} 与 ${movedNotesText} 已移动`
          : movedFoldersText || movedNotesText || "内容已移动",
      variant: "success",
      duration: 5000,
      undoAction: async () => {
        for (const { id, parent_id } of originalFolderParents) {
          await supabase.from("folders").update({ parent_id }).eq("id", id);
        }
        for (const { id, folder_id } of originalNoteParents) {
          await moveNoteToFolder(id, userId, folder_id);
        }
        fetchSubFolders();
        fetchNotes();
        toast({
          title: "已撤销移动",
          description: "内容已还原到原来的位置",
          variant: "default",
          duration: 3000,
        });
      },
    });

    // 记录“上次移动到”的目标文件夹
    setLastMoveTargetId(targetFolderId);
    if (typeof window !== "undefined" && userId) {
      try {
        const key = `sumunote:lastMoveFolder:${userId}`;
        window.localStorage.setItem(key, targetFolderId);
      } catch {
        // 忽略本地存储错误
      }
    }

    setMoveSubfolderDialogOpen(false);
    // 刷新当前文件夹下的子文件夹和笔记列表
    fetchSubFolders();
    fetchNotes();
    exitSelectionMode();
  };

  const confirmBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    try {
      await deleteNotes(ids, userId);
      setNotes(prev => prev.filter(n => !selectedIds.has(n.id)));
      exitSelectionMode();
      toast({ title: "已永久删除", description: `${ids.length} 个笔记已被永久删除，无法找回`, variant: "destructive" });
    } catch (e) {
      toast({ title: "删除失败", description: (e as Error).message || "删除笔记时出错", variant: "destructive" });
    }
    setBatchDeleteDialogOpen(false);
  };

  const handleRestore = async () => {
    const ids = Array.from(selectedIds);
    try {
      await setNotesDeleted(ids, userId, false);
      setNotes(prev => prev.filter(n => !selectedIds.has(n.id)));
      exitSelectionMode();
      toast({ title: "已还原", description: `${ids.length} 个笔记已还原`, variant: "success" });
    } catch (e) {
      toast({ title: "还原失败", description: (e as Error).message || "还原笔记时出错", variant: "destructive" });
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
      try {
        await updateNote(renameNoteId, userId, { title: renameInput.trim() });
        toast({ title: "重命名成功", description: "笔记标题已更新", variant: "success" });
        fetchNotes();
        exitSelectionMode();
      } catch (e) {
        toast({ title: "重命名失败", description: (e as Error).message || "更新笔记标题时出错", variant: "destructive" });
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

      try {
        await setNotesPinned(noteIds, userId, newStatus);
        fetchNotes();
        exitSelectionMode();
      } catch (e) {
        toast({ title: "置顶失败", description: (e as Error).message || "操作失败", variant: "destructive" });
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
    else if (over.id === 'dock-move-subfolder') handleMoveSubfoldersClick();
  };
  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveId(id);
    if (!selectedIds.has(id)) {
      const newSet = new Set(selectedIds);
      newSet.add(id);
      setSelectedIds(newSet);
    }
  };

  // 辅助变量：判断当前选中是否全是置顶（用于 UI 显示）
  const allSelectedPinned = selectedIds.size > 0 && notes.filter(n => selectedIds.has(n.id)).every(n => n.is_pinned);

  if (loading && view === 'list') return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground"/></div>;

  if (view === 'editor') {
      return (
        <>
        <NoteEditor
          title={title}
          content={content}
          tags={tags}
          tagInput={tagInput}
          zenMode={zenMode}
          previewMode={previewMode}
          saveStatus={saveStatus}
          isPinned={isPinned}
          isPublished={isPublished}
          isOnlineState={isOnlineState}
          wordStats={wordStats}
          moreMenuOpen={moreMenuOpen}
          menuPosition={menuPosition}
          isFindReplaceOpen={isFindReplaceOpen}
          findReplaceMode={findReplaceMode}
          matches={matches}
          currentMatchIndex={currentMatchIndex}
          linkMenuOpen={linkComplete.linkMenuOpen}
          linkQuery={linkComplete.linkQuery}
          linkInsertStart={linkComplete.linkInsertStart}
          linkCursorPos={linkComplete.linkCursorPos}
          linkActiveIndex={linkComplete.linkActiveIndex}
          linkCandidates={linkComplete.linkCandidates}
          tagMenuOpen={tagComplete.tagMenuOpen}
          tagQuery={tagComplete.tagQuery}
          tagInsertStart={tagComplete.tagInsertStart}
          tagCursorPos={tagComplete.tagCursorPos}
          tagActiveIndex={tagComplete.tagActiveIndex}
          tagCandidates={tagComplete.tagCandidates}
          isMobileWritingMode={isMobileWritingMode}
          currentNote={currentNote}
          canRevert={canRevert}
          setTitle={setTitle}
          setContent={setContent}
          setTags={setTags}
          setTagInput={setTagInput}
          setZenMode={setZenMode}
          setPreviewMode={setPreviewMode}
          setMoreMenuOpen={setMoreMenuOpen}
          setMenuPosition={setMenuPosition}
          setIsFindReplaceOpen={setIsFindReplaceOpen}
          setFindReplaceMode={setFindReplaceMode}
          onBack={() => { setView("list"); fetchNotes(); }}
          saveNote={saveNote}
          onContentChange={handleContentChange}
          onSegmentedEditorChange={handleSegmentedEditorChange}
          onInsertTable={handleInsertTable}
          onImageUpload={handleImageUpload}
          togglePin={togglePin}
          togglePublish={togglePublish}
          onDeleteCurrentNote={handleDeleteCurrentNote}
          onRevertToLastSaved={handleRevertToLastSaved}
          onOpenVersionHistory={handleOpenVersionHistory}
          onFind={handleFind}
          onReplace={handleReplace}
          onReplaceAll={handleReplaceAll}
          onInsertLink={linkComplete.handleInsertLink}
          onInsertTag={tagComplete.handleInsertTag}
          onTagsChangeWithSave={(newTags) => {
            setTags(newTags);
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = setTimeout(() => {
              saveNote(title, content, isPinned, isPublished, newTags);
            }, 1500);
          }}
          onExitMobileWritingMode={() => setIsMobileWritingMode(false)}
          editorScrollContainerRef={editorScrollContainerRef}
          savedScrollTopRef={savedScrollTopRef}
          moreMenuRef={moreMenuRef}
          moreButtonRef={moreButtonRef}
          moreMenuPortalRef={moreMenuPortalRef}
          fileInputRef={fileInputRef}
        />
          
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

  // --- 列表视图：由 NoteList 组件渲染 ---
  return (
    <>
      <NoteList
        folderName={folderName}
        showTrash={showTrash}
        setShowTrash={(v) => { setShowTrash(v); setView("list"); }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        notes={notes}
        subFolders={subFolders}
        filteredNotes={filteredNotes}
        filteredSubFolders={filteredSubFolders}
        selectedIds={selectedIds}
        isSelectionMode={isSelectionMode}
        activeId={activeId}
        allSelectedPinned={allSelectedPinned}
        onBack={onBack}
        onAddFolder={handleAddFolder}
        onAddNote={handleAddNote}
        onFolderClick={handleFolderClick}
        onNoteClick={handleListClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        exitSelectionMode={exitSelectionMode}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onRestore={handleRestore}
        onDelete={handleDelete}
        onRename={handleRename}
        onMoveSubfoldersClick={handleMoveSubfoldersClick}
        onPin={handlePin}
        onCopy={handleCopy}
        sensors={sensors}
      />
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

      {/* 文件夹 / 笔记移动对话框 */}
      <Dialog open={moveSubfolderDialogOpen} onOpenChange={setMoveSubfolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移动到...</DialogTitle>
            <DialogDescription>
              选择要将选中的文件夹和笔记移动到哪个目标文件夹。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto py-2 space-y-3">
            {/* 上次移动的快捷入口 */}
            {lastMoveTargetId && (
              (() => {
                const lastTarget = moveSubfolderTargets.find(
                  (f) => f.id === lastMoveTargetId
                );
                if (!lastTarget) return null;
                return (
                  <div className="border border-dashed border-border rounded-md p-2 space-y-1">
                    <div className="text-[11px] text-muted-foreground">
                      上次移动到
                    </div>
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-2 text-sm"
                      onClick={() => handleMoveSubfoldersToTarget(lastTarget.id)}
                    >
                      <Folder className="w-4 h-4 mr-2 text-yellow-500" />
                      <span className="truncate">
                        {lastTarget.name || "未命名文件夹"}
                      </span>
                    </Button>
                  </div>
                );
              })()
            )}

            {/* 按层级展开的目标文件夹列表 */}
            <div className="space-y-1">
              {(() => {
                if (!moveSubfolderTargets.length) {
                  return (
                    <p className="text-xs text-muted-foreground px-1">
                      暂无可用的目标文件夹。
                    </p>
                  );
                }

                // 构建层级树（全部展开）
                const byParent = new Map<string | null, FolderItem[]>();
                for (const f of moveSubfolderTargets) {
                  const key = f.parent_id ?? null;
                  if (!byParent.has(key)) byParent.set(key, []);
                  byParent.get(key)!.push(f);
                }
                for (const group of byParent.values()) {
                  group.sort((a, b) =>
                    (a.name || "").localeCompare(b.name || "", "zh-CN")
                  );
                }

                const items: { folder: FolderItem; depth: number }[] = [];
                const walk = (parentId: string | null, depth: number) => {
                  const children = byParent.get(parentId) || [];
                  for (const child of children) {
                    items.push({ folder: child, depth });
                    walk(child.id, depth + 1);
                  }
                };
                walk(null, 0);

                return items.map(({ folder, depth }) => (
                  <Button
                    key={folder.id}
                    variant="outline"
                    className="justify-start h-auto py-2 text-sm"
                    style={{ paddingLeft: 12 + depth * 16 }}
                    onClick={() => handleMoveSubfoldersToTarget(folder.id)}
                  >
                    <Folder className="w-4 h-4 mr-2 text-yellow-500" />
                    <span className="truncate">
                      {folder.name || "未命名文件夹"}
                    </span>
                  </Button>
                ));
              })()}
            </div>
          </div>
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
    </>
  );
}