"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Copy, Trash2, FolderInput, X, Check, Loader2, Plus, FileText, ArrowLeft, Cloud, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// --- 🏗️ 引入 dnd-kit ---
import { 
  DndContext, 
  DragOverlay, 
  useDraggable, 
  useDroppable, 
  TouchSensor, 
  MouseSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
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

// --- 🧩 子组件：可拖拽的笔记卡片 ---
function DraggableNoteCard({ note, isSelected, isSelectionMode, onClick, onTouchStart, onTouchEnd, onMouseDown, onMouseUp }: any) {
    // 只有在多选模式下，才启用拖拽
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: note.id,
        data: note,
        disabled: !isSelectionMode // 平时不让拖，防止影响滚动
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0 : 1, // 拖拽时原位置隐藏（变透明）
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}
            className={cn(
                "relative h-36 p-4 rounded-xl border flex flex-col justify-between transition-all select-none cursor-pointer touch-none", // touch-none 防止滚动冲突
                isSelected ? "bg-accent border-blue-500 shadow-[0_0_0_1px_#3b82f6]" : "bg-card border-border active:scale-95"
            )}
            // 保留原有的点击/长按逻辑
            onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown} onMouseUp={onMouseUp}
            onClick={onClick}
        >
            <div>
                <h3 className={cn("font-bold text-sm mb-1 truncate", !note.title && "text-muted-foreground italic")}>
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
                ) : <FileText className="w-4 h-4 text-muted-foreground/30" />}
            </div>
        </div>
    );
}

// --- 🧩 子组件：可放置的 Dock 图标 ---
function DroppableDockItem({ id, icon: Icon, label, disabled, onClick, isActive }: any) {
    const { setNodeRef, isOver } = useDroppable({ id });
    
    return (
        <div ref={setNodeRef} 
            className={cn(
                "flex flex-col items-center gap-1 transition-all",
                disabled ? "opacity-30 grayscale cursor-not-allowed" : "cursor-pointer",
                isOver ? "scale-125 -translate-y-2" : "hover:scale-110" // 拖拽悬停时放大反馈
            )}
            onClick={onClick}
        >
            <div className={cn(
                "p-2 rounded-lg transition-colors",
                isOver ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50" : "bg-accent text-foreground"
            )}>
                <Icon className="w-5 h-5" />
            </div>
            <span className={cn("text-[10px]", isOver ? "text-blue-500 font-bold" : "text-muted-foreground")}>{label}</span>
        </div>
    );
}


export default function NoteManager({ userId, folderId, folderName, onBack }: NoteManagerProps) {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 编辑器状态
  const [currentNote, setCurrentNote] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // 多选状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedIds.size > 0;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const ignoreClickRef = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- 🏗️ dnd-kit 传感器配置 ---
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }), // 鼠标移动 10px 才算拖拽
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }) // 触摸按住 150ms 才算拖拽
  );
  const [activeId, setActiveId] = useState<string | null>(null); // 当前正在拖拽的 ID

  // --- 数据加载 & 编辑逻辑 (保持不变) ---
  const fetchNotes = async () => {
    const { data } = await supabase.from('notes').select('*').eq('user_id', userId).eq('folder_id', folderId).order('updated_at', { ascending: false });
    if (data) setNotes(data);
    setLoading(false);
  };
  useEffect(() => { if (userId && folderId && view === 'list') fetchNotes(); }, [userId, folderId, view]);
  const enterEditor = (note: any) => { setCurrentNote(note); setTitle(note.title || ""); setContent(note.content || ""); setSaveStatus('saved'); setLastSavedAt(new Date(note.updated_at)); setView('editor'); };
  const handleAddNote = async () => { const { data } = await supabase.from('notes').insert({ user_id: userId, folder_id: folderId, title: "", content: "" }).select().single(); if (data) enterEditor(data); };
  const saveNote = useCallback(async (currentTitle: string, currentContent: string) => { if (!currentNote) return; setSaveStatus('saving'); const now = new Date(); const { error } = await supabase.from('notes').update({ title: currentTitle, content: currentContent, updated_at: now.toISOString() }).eq('id', currentNote.id); if (!error) { setSaveStatus('saved'); setLastSavedAt(now); } else { setSaveStatus('error'); } }, [currentNote]);
  const handleContentChange = (newTitle: string, newContent: string) => { setTitle(newTitle); setContent(newContent); setSaveStatus('unsaved'); if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = setTimeout(() => { saveNote(newTitle, newContent); }, 1500); };
  useEffect(() => { const handleKeyDown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (view === 'editor') saveNote(title, content); } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [view, title, content, saveNote]);

  // --- 交互逻辑 (长按/点击) ---
  const toggleSelection = (id: string) => { const newSet = new Set(selectedIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedIds(newSet); };
  const handleTouchStart = (id: string) => { if (isSelectionMode) return; ignoreClickRef.current = false; timerRef.current = setTimeout(() => { const newSet = new Set(selectedIds); newSet.add(id); setSelectedIds(newSet); if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50); ignoreClickRef.current = true; }, 500); };
  const handleTouchEnd = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  const exitSelectionMode = () => setSelectedIds(new Set());
  const handleListClick = (note: any) => { if (ignoreClickRef.current) { ignoreClickRef.current = false; return; } if (isSelectionMode) { toggleSelection(note.id); } else { enterEditor(note); } };
  
  // --- 功能函数 ---
  const handleDelete = async () => { if (confirm(`确认删除这 ${selectedIds.size} 条笔记吗？`)) { const { error } = await supabase.from('notes').delete().in('id', Array.from(selectedIds)); if (!error) { setNotes(prev => prev.filter(n => !selectedIds.has(n.id))); exitSelectionMode(); } } };
  const handleCopy = () => { if (selectedIds.size > 1) return; const note = notes.find(n => n.id === Array.from(selectedIds)[0]); if (note) { navigator.clipboard.writeText(note.content || ""); alert("✅ 已复制"); exitSelectionMode(); } };
  const handleMove = () => { alert("移动功能开发中..."); /* 这里可以复用 FolderManager 的 Dialog 逻辑 */ };

  // --- 🏗️ 核心：拖拽结束处理 ---
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { over } = event;
    
    // 如果没有拖到任何 Dock 图标上，就什么都不做
    if (!over) return;

    // 根据拖到的 ID 执行不同逻辑
    if (over.id === 'dock-delete') {
        handleDelete();
    } else if (over.id === 'dock-copy') {
        handleCopy();
    } else if (over.id === 'dock-move') {
        handleMove();
    }
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
    // 如果拖拽的是一个没被选中的，自动把它加入选中集合
    if (!selectedIds.has(event.active.id)) {
        const newSet = new Set(selectedIds);
        newSet.add(event.active.id);
        setSelectedIds(newSet);
    }
  };


  // --- 视图渲染 ---

  if (loading && view === 'list') return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground"/></div>;

  if (view === 'editor') {
      // (编辑器代码省略，与之前一致，保持不变即可)
      return (
          <div className="fixed inset-0 bg-background z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
              <header className="px-4 h-14 flex items-center justify-between border-b border-border/50 bg-background/50 backdrop-blur">
                  <Button variant="ghost" className="-ml-2 text-muted-foreground hover:text-foreground" onClick={() => { if (saveStatus === 'unsaved') saveNote(title, content); setView('list'); fetchNotes(); }}><ArrowLeft className="w-5 h-5 mr-1" />返回</Button>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">{saveStatus === 'saving' && <span className="flex items-center text-blue-500"><Loader2 className="w-3 h-3 animate-spin mr-1"/>保存中</span>} {saveStatus === 'saved' && <span className="flex items-center text-green-600"><CheckCircle2 className="w-3 h-3 mr-1"/>已保存</span>}</div>
              </header>
              <div className="flex-1 max-w-3xl mx-auto w-full flex flex-col p-4 md:p-8 overflow-y-auto">
                  <Input value={title} onChange={(e) => handleContentChange(e.target.value, content)} placeholder="无标题" className="text-3xl md:text-4xl font-bold border-none shadow-none px-0 focus-visible:ring-0 bg-transparent h-auto py-4"/>
                  <Textarea value={content} onChange={(e) => handleContentChange(title, e.target.value)} placeholder="开始输入内容..." className="flex-1 resize-none border-none shadow-none px-0 focus-visible:ring-0 text-lg leading-relaxed bg-transparent p-0 mt-4"/>
              </div>
          </div>
      );
  }

  return (
    <DndContext 
        sensors={sensors} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
    >
        <div className="min-h-[80vh] pb-32" onClick={(e) => { if (e.target === e.currentTarget && isSelectionMode) exitSelectionMode(); }}>
        
        {/* 顶部导航 */}
        <header className="flex items-center justify-between mb-6 sticky top-0 bg-background/80 backdrop-blur z-10 py-4">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2"><ArrowLeft className="w-5 h-5" /></Button>
                <h1 className="text-xl font-bold truncate max-w-[200px]">{folderName}</h1>
                <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full">{notes.length}</span>
            </div>
            <div className="flex gap-2">
                {isSelectionMode ? (
                    <button onClick={exitSelectionMode} className="text-sm text-muted-foreground">取消</button>
                ) : (
                    <Button size="sm" onClick={handleAddNote} variant="outline"><Plus className="w-4 h-4 mr-1"/> 新笔记</Button>
                )}
            </div>
        </header>

        {/* 列表渲染 (使用 Draggable 组件) */}
        <div className="grid grid-cols-2 gap-3">
            {notes.length === 0 && <div className="col-span-2 text-center py-10 text-muted-foreground border-2 border-dashed border-border rounded-xl">空空如也</div>}
            {notes.map((note) => (
                <DraggableNoteCard 
                    key={note.id} 
                    note={note} 
                    isSelected={selectedIds.has(note.id)}
                    isSelectionMode={isSelectionMode}
                    onClick={() => handleListClick(note)}
                    onTouchStart={() => handleTouchStart(note.id)} 
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={() => handleTouchStart(note.id)} 
                    onMouseUp={handleTouchEnd}
                />
            ))}
        </div>

        {/* Dock (使用 Droppable 组件) */}
        <div className={cn("fixed left-0 right-0 bottom-8 flex justify-center z-50 transition-all duration-300", isSelectionMode ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none")}>
            <div className="relative bg-background/90 backdrop-blur-md border border-border px-8 py-3 rounded-2xl shadow-2xl flex items-center gap-8">
                <button onClick={(e) => { e.stopPropagation(); exitSelectionMode(); }} className="absolute -top-3 -right-3 w-6 h-6 bg-muted rounded-full flex items-center justify-center border border-border shadow-md"><X className="w-3 h-3" /></button>
                
                {/* 放置目标 */}
                <DroppableDockItem id="dock-copy" icon={Copy} label="复制" disabled={selectedIds.size > 1} onClick={handleCopy} />
                <DroppableDockItem id="dock-move" icon={FolderInput} label="移动" onClick={handleMove} />
                <DroppableDockItem id="dock-delete" icon={Trash2} label="删除" onClick={handleDelete} />
            </div>
        </div>

        {/* 👻 拖拽魅影 (Drag Overlay) - 拖动时跟随手指显示的东西 */}
        <DragOverlay>
            {activeId ? (
                <div className="w-40 h-24 bg-accent/90 backdrop-blur border border-blue-500 rounded-xl shadow-2xl p-4 flex flex-col justify-center items-center rotate-3">
                    <FileText className="w-8 h-8 text-blue-500 mb-2" />
                    <span className="text-xs font-bold">
                        {selectedIds.size > 1 ? `已选择 ${selectedIds.size} 项` : "移动笔记"}
                    </span>
                </div>
            ) : null}
        </DragOverlay>

        </div>
    </DndContext>
  );
}