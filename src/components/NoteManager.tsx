"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Copy, Trash2, FolderInput, X, Check, Loader2, Plus, 
  FileText, ArrowLeft, CheckCircle2, Pencil, Eye, PenLine, 
  Search, RotateCcw, Pin, Image as ImageIcon, Globe // 🔥 确保引入 Pin
} from "lucide-react"; 
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

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
        id: note.id, data: note, disabled: !isSelectionMode
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
  const [previewMode, setPreviewMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [isPinned, setIsPinned] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

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
      return (note.title?.toLowerCase() || "").includes(q) || (note.content?.toLowerCase() || "").includes(q);
  });
  
  // --- 编辑器操作 ---
  const enterEditor = (note: any) => { 
      setCurrentNote(note); 
      setTitle(note.title || ""); 
      setContent(note.content || ""); 
      setIsPinned(note.is_pinned || false); 
      setIsPublished(note.is_published || false);
      setSaveStatus('saved'); 
      setPreviewMode(false); 
      setView('editor'); 
  };

  const handleAddNote = async () => { const { data } = await supabase.from('notes').insert({ user_id: userId, folder_id: folderId, title: "", content: "" }).select().single(); if (data) enterEditor(data); };
  
  const saveNote = useCallback(async (currentTitle: string, currentContent: string, pinned: boolean, published: boolean) => { 
      if (!currentNote) return; 
      setSaveStatus('saving'); 
      const now = new Date(); 
      let finalTitle = currentTitle;
      if (!finalTitle.trim()) {
          finalTitle = currentContent.split('\n')[0]?.replace(/[#*`]/g, '').trim().slice(0, 30) || "";
          setTitle(finalTitle); 
      }
      const { error } = await supabase.from('notes').update({ 
          title: finalTitle, 
          content: currentContent, 
          is_pinned: pinned,
          is_published: published,
          updated_at: now.toISOString() 
      }).eq('id', currentNote.id); 
      if (!error) { setSaveStatus('saved'); } else { setSaveStatus('error'); } 
  }, [currentNote]);

  const handleContentChange = (newTitle: string, newContent: string) => { 
      setTitle(newTitle); 
      setContent(newContent); 
      setSaveStatus('unsaved'); 
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); 
      autoSaveTimerRef.current = setTimeout(() => { saveNote(newTitle, newContent, isPinned, isPublished); }, 1500); 
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
      await saveNote(title, content, newStatus, isPublished);
  };

  const togglePublish = async () => {
      const newStatus = !isPublished;
      setIsPublished(newStatus);
      await saveNote(title, content, isPinned, newStatus);
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

  useEffect(() => { const handleKeyDown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (view === 'editor') saveNote(title, content, isPinned, isPublished); } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [view, title, content, isPinned, isPublished, saveNote]);

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
          <div className="fixed inset-0 bg-background z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
              <header className="px-4 h-14 flex items-center justify-between border-b border-border/50 bg-background/50 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" className="-ml-2 text-muted-foreground hover:text-foreground" onClick={() => { if (saveStatus === 'unsaved') saveNote(title, content, isPinned, isPublished); setView('list'); fetchNotes(); }}><ArrowLeft className="w-5 h-5 mr-1" />返回</Button>
                  </div>
                  <div className="flex items-center gap-1">
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                      <Button variant="ghost" size="icon" title="插入图片" onClick={() => fileInputRef.current?.click()}><ImageIcon className="w-4 h-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" onClick={togglePin} title={isPinned ? "取消置顶" : "置顶笔记"}><Pin className={cn("w-4 h-4 transition-all", isPinned ? "fill-yellow-500 text-yellow-500 rotate-45" : "text-muted-foreground")} /></Button>
                      <Button variant="ghost" size="icon" onClick={togglePublish} title={isPublished ? "已发布" : "发布到 Web"}><Globe className={cn("w-4 h-4 transition-all", isPublished ? "text-blue-500" : "text-muted-foreground")} /></Button>
                      <div className="w-[1px] h-4 bg-border mx-1"></div>
                      <button onClick={() => setPreviewMode(!previewMode)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/80 transition">{previewMode ? <><PenLine size={14}/> 编辑</> : <><Eye size={14}/> 预览</>}</button>
                      <div className="text-xs text-muted-foreground w-12 text-right">{saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin ml-auto text-blue-500"/> : <CheckCircle2 className="w-3 h-3 ml-auto text-green-600"/>}</div>
                  </div>
              </header>
              <div className="flex-1 max-w-3xl mx-auto w-full flex flex-col p-4 md:p-8 overflow-y-auto">
                  <Input value={title} onChange={(e) => handleContentChange(e.target.value, content)} placeholder="无标题" className={cn("text-3xl md:text-4xl font-bold border-none shadow-none px-0 focus-visible:ring-0 bg-transparent h-auto py-4", previewMode && "opacity-80 pointer-events-none")}/>
                  {previewMode ? (
                    <div className="flex-1 mt-4 animate-in fade-in duration-200">
                      <MarkdownRenderer content={content} />
                      <div className="h-20" />
                    </div>
                  ) : (
                    <div className="relative flex-1 mt-4">
                      <Textarea
                        ref={editorRef}
                        value={content}
                        onChange={handleEditorChange}
                        onKeyDown={handleEditorKeyDown}
                        placeholder="开始输入内容 (支持 Markdown，输入 [[ 以引用其他笔记)..."
                        className="flex-1 resize-none border-none shadow-none px-0 focus-visible:ring-0 text-lg leading-relaxed bg-transparent p-0 font-sans"
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