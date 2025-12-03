'use client'
import { useState, useEffect } from 'react'
// 1. 这里的引入路径改为了相对路径 '../lib/supabase'，这样更稳妥，不会报错
import { supabase } from '../lib/supabase' 
import { Folder, FileText, Plus, Trash2, LogOut, ChevronLeft, Save } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
// 2. 引入 Supabase 的官方类型定义
import { Session } from '@supabase/supabase-js'

export default function Home() {
  // 3. 给 session 加上明确的类型定义 <Session | null>
  const [session, setSession] = useState<Session | null>(null)
  const [folders, setFolders] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  const [editingNote, setEditingNote] = useState<any>(null)
  const [noteContent, setNoteContent] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchData(null)
      setLoading(false)
    })

    // 4. 给回调参数加上明确的类型
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setSession(session)
      if (session) fetchData(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchData = async (folderId: string | null) => {
    setLoading(true)
    const { data: foldersData } = await supabase
      .from('folders')
      .select('*')
      .is('parent_id', folderId)
      .order('created_at', { ascending: false })
      
    let notesData: any[] = []
    if (folderId) {
        const { data } = await supabase.from('notes').select('*').eq('folder_id', folderId).order('updated_at', { ascending: false })
        if (data) notesData = data
    }

    if (foldersData) setFolders(foldersData)
    setNotes(notesData)
    setLoading(false)
  }

  const handleLogin = async () => {
    const email = prompt('请输入你的邮箱 (将收到登录链接):')
    if (!email) return
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) alert(error.message)
    else alert('登录链接已发送到邮箱，请去点击！')
  }

  const createFolder = async () => {
    const name = prompt('文件夹名称:')
    if (!name || !session) return
    await supabase.from('folders').insert({ name, user_id: session.user.id })
    fetchData(null)
  }

  const createNote = async () => {
    if (!currentFolder || !session) return
    await supabase.from('notes').insert({ 
      title: '新笔记', 
      content: '# 在此处开始写作...', 
      folder_id: currentFolder,
      user_id: session.user.id 
    })
    fetchData(currentFolder)
  }
  
  const saveNote = async () => {
    if (!editingNote) return
    await supabase.from('notes').update({ content: noteContent, updated_at: new Date() }).eq('id', editingNote.id)
    setEditingNote(null) 
    fetchData(currentFolder)
  }

  if (loading) return <div className="flex h-screen items-center justify-center bg-zinc-50">Loading...</div>

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tighter">Sumu Cloud</h1>
        <button onClick={handleLogin} className="px-6 py-2 bg-white text-black rounded-full font-medium hover:bg-zinc-200 transition">
          邮箱登录 / 注册
        </button>
      </div>
    )
  }

  if (editingNote) {
    return (
        <div className="flex flex-col h-screen bg-white text-zinc-900">
            <header className="flex items-center justify-between p-4 border-b">
                <button onClick={() => setEditingNote(null)} className="flex items-center text-zinc-600"><ChevronLeft size={20}/> 返回</button>
                <button onClick={saveNote} className="flex items-center gap-2 text-blue-600 font-medium"><Save size={18}/> 保存</button>
            </header>
            <textarea 
                className="flex-1 p-4 text-lg outline-none resize-none font-mono text-zinc-800"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
            />
        </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 pb-20">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between">
        <div className="font-bold text-lg tracking-tight flex items-center gap-2">
            {currentFolder ? (
                <button onClick={() => {setCurrentFolder(null); fetchData(null)}} className="flex items-center text-zinc-500 hover:text-black">
                    <ChevronLeft size={20} /> 返回
                </button>
            ) : 'Sumu Cloud'}
        </div>
        <button onClick={() => supabase.auth.signOut()}><LogOut size={20} className="text-zinc-400 hover:text-red-500"/></button>
      </header>

      <main className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {!currentFolder && folders.map(folder => (
            <div key={folder.id} 
                 onClick={() => {setCurrentFolder(folder.id); fetchData(folder.id)}}
                 className="aspect-square bg-white border border-zinc-200 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md transition cursor-pointer active:scale-95">
                <Folder size={32} className="text-blue-500 fill-blue-100" />
                <span className="text-sm font-medium truncate w-full text-center px-2">{folder.name}</span>
            </div>
        ))}

        {currentFolder && notes.map(note => (
            <div key={note.id} 
                 onClick={() => {setEditingNote(note); setNoteContent(note.content)}}
                 className="aspect-[3/4] bg-white border border-zinc-200 rounded-xl p-3 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col">
                <h3 className="font-bold text-sm mb-2 text-zinc-800">{note.title || '无标题'}</h3>
                <div className="flex-1 overflow-hidden text-xs text-zinc-400 line-clamp-[6]">
                    <ReactMarkdown>{note.content}</ReactMarkdown>
                </div>
                <div className="mt-2 text-[10px] text-zinc-300 text-right">{new Date(note.updated_at).toLocaleDateString()}</div>
            </div>
        ))}
      </main>
      
      <button 
        onClick={currentFolder ? createNote : createFolder}
        className="fixed bottom-6 right-6 w-14 h-14 bg-black text-white rounded-full shadow-lg flex items-center justify-center hover:bg-zinc-800 active:scale-90 transition">
        <Plus size={28} />
      </button>
    </div>
  )
}