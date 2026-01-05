"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Copy, Trash2, FolderInput, X, Check, Loader2, Plus, 
  FileText, ArrowLeft, CheckCircle2, Pencil, Eye, PenLine, 
  Search, RotateCcw, Pin, Image as ImageIcon, Globe, Maximize2, Minimize2, MoreVertical
} from "lucide-react"; 
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
                "relative h-36 p-4 rounded-xl border flex flex-col justify-between transition-all select-none cursor-pointer touch-none", 
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
  
  // 实时同步相关状态
  const [cloudUpdateDialogOpen, setCloudUpdateDialogOpen] = useState(false);
  const [cloudUpdateNote, setCloudUpdateNote] = useState<any>(null);
  const lastSavedTimestampRef = useRef<string | null>(null); // 记录最后一次保存的时间戳
  const realtimeChannelRef = useRef<any>(null); // Realtime 订阅通道
  
  // 移动端更多菜单
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // 多选与拖拽
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedIds.size > 0;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const ignoreClickRef = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 10 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showTrash, setShowTrash] = useState(false);

  // --- [[ 自动补全 ---
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
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
      let finalTitle = currentTitle;
      if (!finalTitle.trim()) {
          finalTitle = currentContent.split('\n')[0]?.replace(/[#*`]/g, '').trim().slice(0, 30) || "";
          setTitle(finalTitle); 
      }
      // 首次尝试：包含 tags 字段
      let { error } = await supabase
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
        .eq("id", currentNote.id);

      // 如果后端还没有 tags 字段，降级为不更新 tags，避免整条更新失败
      if (error && typeof error.message === "string" && error.message.includes("column") && error.message.includes("tags")) {
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
          .eq("id", currentNote.id);
        error = retry.error;
      }

      if (!error) {
        setSaveStatus("saved");
        // 记录保存时间戳，用于检测云端更新
        lastSavedTimestampRef.current = now.toISOString();
      } else {
        console.error("[NoteManager] 保存笔记失败：", error.message || error);
        setSaveStatus("error");
      }
  }, [currentNote]);

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

  // 检测 [[ 触发与查询
  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const cursor = e.target.selectionStart ?? value.length;
      handleContentChange(title, value);

      // 在光标前寻找最近的 [[ 且尚未闭合 ]]
      const beforeCursor = value.slice(0, cursor);
      const start = beforeCursor.lastIndexOf("[[");
      const endClose = beforeCursor.lastIndexOf("]]");

      if (start !== -1 && (endClose === -1 || endClose < start)) {
          const rawQuery = beforeCursor.slice(start + 2, cursor);
          setLinkMenuOpen(true);
          setLinkQuery(rawQuery.trim());
          setLinkInsertStart(start);
          setLinkCursorPos(cursor);
          setLinkActiveIndex(0);
      } else {
          setLinkMenuOpen(false);
          setLinkQuery("");
          setLinkInsertStart(null);
          setLinkCursorPos(null);
      }
  };

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

      // 将光标移到插入链接之后
      requestAnimationFrame(() => {
          if (editorRef.current) {
              const pos = before.length + insertText.length;
              editorRef.current.focus();
              editorRef.current.setSelectionRange(pos, pos);
          }
      });
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!linkMenuOpen || linkCandidates.length === 0) return;

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
          alert(`✅ 已发布！公开链接已复制：\n${url}`);
      } else {
          alert("🚫 已取消发布，链接将失效。");
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
          alert("✅ 图片上传成功");
      } catch (error: any) {
          alert("上传失败: " + error.message);
          setSaveStatus('error');
      } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  useEffect(() => { const handleKeyDown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (view === 'editor') saveNote(title, content, isPinned, isPublished, tags); } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [view, title, content, isPinned, isPublished, tags, saveNote]);

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
          
          // 如果这次更新不是我们自己保存的（时间戳不同），则提示用户
          if (
            lastSavedTimestampRef.current &&
            updatedAt !== lastSavedTimestampRef.current &&
            new Date(updatedAt).getTime() > new Date(lastSavedTimestampRef.current).getTime()
          ) {
            // 检测到云端有更新
            setCloudUpdateNote(updatedNote);
            setCloudUpdateDialogOpen(true);
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

  // 处理云端更新：刷新并放弃本地更改
  const handleRefreshFromCloud = async () => {
    if (!cloudUpdateNote) return;
    
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
    lastSavedTimestampRef.current = cloudUpdateNote.updated_at || new Date().toISOString();
    setSaveStatus('saved');
    setCloudUpdateDialogOpen(false);
    setCloudUpdateNote(null);
  };

  // 处理云端更新：保留本地更改（覆盖云端）
  const handleKeepLocalChanges = async () => {
    if (!currentNote) return;
    
    // 使用当前本地内容覆盖云端
    await saveNote(title, content, isPinned, isPublished, tags);
    setCloudUpdateDialogOpen(false);
    setCloudUpdateNote(null);
  };

  // 点击外部关闭更多菜单
  useEffect(() => {
    if (!moreMenuOpen) return;
    
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      // 检查点击是否在菜单容器外（ref 包含按钮和菜单）
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        console.log('Click outside detected, closing menu');
        setMoreMenuOpen(false);
      } else {
        console.log('Click inside menu container, keeping menu open');
      }
    };
    
    // 延迟添加监听器，确保 React onClick 事件先处理
    const timeoutId = setTimeout(() => {
      console.log('Adding click outside listeners');
      document.addEventListener('click', handleClickOutside, true);
      document.addEventListener('touchend', handleClickOutside, true);
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      console.log('Removing click outside listeners');
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('touchend', handleClickOutside, true);
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

  // --- 交互逻辑 ---
  const toggleSelection = (id: string) => { const newSet = new Set(selectedIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedIds(newSet); };
  const handleTouchStart = (id: string) => { if (isSelectionMode) return; ignoreClickRef.current = false; timerRef.current = setTimeout(() => { const newSet = new Set(selectedIds); newSet.add(id); setSelectedIds(newSet); if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50); ignoreClickRef.current = true; }, 500); };
  const handleTouchMove = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  const handleTouchEnd = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  const exitSelectionMode = () => setSelectedIds(new Set());
  const handleListClick = (note: any) => { if (ignoreClickRef.current) { ignoreClickRef.current = false; return; } if (isSelectionMode) { toggleSelection(note.id); } else { enterEditor(note); } };
  const handleDelete = async () => { const ids = Array.from(selectedIds); if (showTrash) { if (confirm(`⚠️ 危险操作：\n这些笔记将被永久删除，无法找回！\n确认继续吗？`)) { const { error } = await supabase.from('notes').delete().in('id', ids); if (!error) { setNotes(prev => prev.filter(n => !selectedIds.has(n.id))); exitSelectionMode(); } } } else { const { error } = await supabase.from('notes').update({ is_deleted: true }).in('id', ids); if (!error) { setNotes(prev => prev.filter(n => !selectedIds.has(n.id))); exitSelectionMode(); } } };
  const handleRestore = async () => { const ids = Array.from(selectedIds); const { error } = await supabase.from('notes').update({ is_deleted: false }).in('id', ids); if (!error) { setNotes(prev => prev.filter(n => !selectedIds.has(n.id))); exitSelectionMode(); alert("✅ 笔记已还原"); } }
  const handleCopy = () => { if (selectedIds.size > 1) return; const note = notes.find(n => n.id === Array.from(selectedIds)[0]); if (note) { navigator.clipboard.writeText(note.content || ""); alert("✅ 已复制"); exitSelectionMode(); } };
  const handleRename = async () => { if (selectedIds.size !== 1) return; const id = Array.from(selectedIds)[0]; const note = notes.find(n => n.id === id); if (!note) return; const newTitle = prompt("重命名笔记标题：", note.title); if (!newTitle || newTitle === note.title) return; const { error } = await supabase.from('notes').update({ title: newTitle }).eq('id', id); if (!error) { fetchNotes(); exitSelectionMode(); } };
  
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
                          <Button variant="ghost" size="icon" className="shrink-0 hidden sm:flex" title="插入图片" onClick={() => fileInputRef.current?.click()}><ImageIcon className="w-4 h-4 text-muted-foreground" /></Button>
                          <Button variant="ghost" size="icon" className="shrink-0 hidden sm:flex" onClick={togglePin} title={isPinned ? "取消置顶" : "置顶笔记"}><Pin className={cn("w-4 h-4 transition-all", isPinned ? "fill-yellow-500 text-yellow-500 rotate-45" : "text-muted-foreground")} /></Button>
                          <Button variant="ghost" size="icon" className="shrink-0 hidden sm:flex" onClick={togglePublish} title={isPublished ? "已发布" : "发布到 Web"}><Globe className={cn("w-4 h-4 transition-all", isPublished ? "text-blue-500" : "text-muted-foreground")} /></Button>
                          <div className="w-[1px] h-4 bg-border mx-0.5 sm:mx-1 shrink-0 hidden sm:block"></div>
                        </>
                      )}
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
                          type="button"
                          className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-md text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('More button clicked! Current state:', moreMenuOpen);
                            setMoreMenuOpen((prev) => {
                              console.log('Setting state from', prev, 'to', !prev);
                              return !prev;
                            });
                          }}
                        >
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </button>
                        
                        {/* 更多菜单弹出层 - 使用 Portal 避免被 overflow 裁剪 */}
                        {moreMenuOpen && typeof document !== 'undefined' && (
                          <div
                            className="fixed right-2 w-48 rounded-lg border border-border bg-popover shadow-lg z-[100] py-1"
                            style={{ 
                              top: 'calc(3.5rem + 4px)',
                              right: '0.5rem'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {!zenMode && (
                              <>
                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                                  onClick={() => {
                                    fileInputRef.current?.click();
                                    setMoreMenuOpen(false);
                                  }}
                                >
                                  <ImageIcon className="w-4 h-4" />
                                  <span>插入图片</span>
                                </button>
                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                                  onClick={() => {
                                    togglePin();
                                    setMoreMenuOpen(false);
                                  }}
                                >
                                  <Pin className={cn("w-4 h-4", isPinned ? "fill-yellow-500 text-yellow-500 rotate-45" : "")} />
                                  <span>{isPinned ? "取消置顶" : "置顶笔记"}</span>
                                </button>
                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                                  onClick={() => {
                                    togglePublish();
                                    setMoreMenuOpen(false);
                                  }}
                                >
                                  <Globe className={cn("w-4 h-4", isPublished ? "text-blue-500" : "")} />
                                  <span>{isPublished ? "取消发布" : "发布到 Web"}</span>
                                </button>
                                <div className="h-[1px] bg-border my-1"></div>
                              </>
                            )}
                            <button
                              className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={!canRevert}
                              onClick={() => {
                                handleRevertToLastSaved();
                                setMoreMenuOpen(false);
                              }}
                            >
                              <RotateCcw className="w-4 h-4" />
                              <span>撤回</span>
                            </button>
                            <button
                              className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
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
                        )}
                      </div>
                      
                      {/* 编辑/预览切换（所有设备都显示） */}
                      <button onClick={() => setPreviewMode(!previewMode)} className="shrink-0 flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/80 transition">{previewMode ? <><PenLine size={12} className="sm:w-3.5 sm:h-3.5"/><span className="hidden sm:inline">编辑</span></> : <><Eye size={12} className="sm:w-3.5 sm:h-3.5"/><span className="hidden sm:inline">预览</span></>}</button>
                      <div className="text-xs text-muted-foreground w-8 sm:w-12 text-right shrink-0">{saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin ml-auto text-blue-500"/> : <CheckCircle2 className="w-3 h-3 ml-auto text-green-600"/>}</div>
                  </div>
              </header>
              <div className={cn(
                "flex-1 mx-auto w-full flex flex-col p-3 sm:p-4 md:p-8 overflow-y-auto min-h-0",
                zenMode ? "max-w-5xl" : "max-w-3xl"
              )}>
                  <Input
                    value={title}
                    onChange={(e) => handleContentChange(e.target.value, content)}
                    placeholder="无标题"
                    className={cn(
                      "text-3xl md:text-4xl font-bold border-none shadow-none px-0 focus-visible:ring-0 bg-transparent h-auto py-4",
                      previewMode && "opacity-80 pointer-events-none"
                    )}
                  />
                  {/* 标签编辑区域 */}
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
                  {previewMode ? (
                    <div className="flex-1 mt-4 animate-in fade-in duration-200">
                      <MarkdownRenderer content={content} />
                      <div className="h-20" />
                    </div>
                  ) : (
                    <div className="relative flex-1 mt-4 min-h-0">
                      <Textarea
                        ref={editorRef}
                        value={content}
                        onChange={handleEditorChange}
                        onKeyDown={handleEditorKeyDown}
                        placeholder="开始输入内容 (支持 Markdown，输入 [[ 以引用其他笔记)..."
                        className="w-full h-full min-h-[200px] resize-none border-none shadow-none px-0 focus-visible:ring-0 text-base sm:text-lg leading-relaxed bg-transparent p-0 font-sans"
                      />
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
                  检测到其他设备更新了这篇笔记。你可以选择刷新以查看最新内容，或保留当前编辑的内容。
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
                  onClick={handleRefreshFromCloud}
                >
                  刷新查看最新
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

        <div className="grid grid-cols-2 gap-3 p-4">
            {filteredNotes.length === 0 && (<div className="col-span-2 text-center py-10 text-muted-foreground border-2 border-dashed border-border rounded-xl flex flex-col items-center gap-2">{searchQuery ? <p>未找到相关笔记</p> : (showTrash ? <p>回收站是空的</p> : <p>这里空空如也</p>)}</div>)}
            {filteredNotes.map((note) => (<DraggableNoteCard key={note.id} note={note} isSelected={selectedIds.has(note.id)} isSelectionMode={isSelectionMode} onClick={() => handleListClick(note)} onTouchStart={() => handleTouchStart(note.id)} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onMouseDown={() => handleTouchStart(note.id)} onMouseUp={handleTouchEnd} />))}
        </div>

        <div className={cn("fixed left-0 right-0 bottom-8 flex justify-center z-50 transition-all duration-300", isSelectionMode ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none")}>
            <div className="relative bg-background/90 backdrop-blur-md border border-border px-8 py-3 rounded-2xl shadow-2xl flex items-center gap-8">
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
        </div>
    </DndContext>
  );
}