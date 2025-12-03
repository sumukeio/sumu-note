'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Folder, Plus, LogOut, ChevronLeft, Save, ArrowUp, KeyRound, Mail } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Session } from '@supabase/supabase-js'

export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  
  // 数据状态
  const [folders, setFolders] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  // 编辑器状态
  const [editingNote, setEditingNote] = useState<any>(null)
  const [noteContent, setNoteContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 登录界面状态
  const [loginMode, setLoginMode] = useState<'magic' | 'password'>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // --- 1. 初始化与鉴权 ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchData(null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchData(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // --- 2. 数据获取 ---
  const fetchData = async (folderId: string | null) => {
    // setLoading(true) // 为了体验流畅，切换文件夹时不全屏Loading，只刷新数据
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

  // --- 3. 认证相关功能 (核心修改) ---

  // 处理登录
  const handleLogin = async () => {
    if (!email) return alert('请输入邮箱')
    setAuthLoading(true)

    if (loginMode === 'magic') {
        // 魔法链接登录 (注册/验证)
        const { error } = await supabase.auth.signInWithOtp({ email })
        if (error) alert('发送失败: ' + error.message)
        else alert('登录链接已发送到邮箱，请去点击！')
    } else {
        // 密码登录
        if (!password) {
            setAuthLoading(false)
            return alert('请输入密码')
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) alert('登录失败: ' + error.message)
        // 成功后 onAuthStateChange 会自动处理跳转
    }
    setAuthLoading(false)
  }

  // 设置/修改密码
  const handleSetPassword = async () => {
    const newPassword = prompt('为了以后方便登录，请设置一个新密码：')
    if (!newPassword) return
    if (newPassword.length < 6) return alert('密码长度不能少于6位')

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) alert('设置失败: ' + error.message)
    else alert('密码设置成功！下次你可以直接用密码登录了。')
  }

  // --- 4. 笔记操作 ---
  const createFolder = async () => {
    const name = prompt('文件夹名称:')
    if (!name || !session) return
    await supabase.from('folders').insert({ name, user_id: session.user.id })
    fetchData(null)
  }

  const createNote = async () => {
    if (!currentFolder || !session) return
    const { data } = await supabase.from('notes').insert({ 
      title: '新笔记', 
      content: '', 
      folder_id: currentFolder,
      user_id: session.user.id 
    }).select().single()
    
    if (data) {
        await fetchData(currentFolder)
        setEditingNote(data)
        setNoteContent('')
    }
  }
  
  const saveNote = async () => {
    if (!editingNote) return
    const title = noteContent.split('\n')[0]?.slice(0, 20) || '无标题'
    await supabase.from('notes').update({ 
        content: noteContent, 
        title: title,
        updated_at: new Date() 
    }).eq('id', editingNote.id)
    setEditingNote(null) 
    fetchData(currentFolder)
  }

  const scrollToTop = () => {
    if (textareaRef.current) {
        textareaRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // --- 渲染逻辑 ---

  if (loading) return <div className="flex h-screen items-center justify-center bg-zinc-50 text-zinc-500">Loading...</div>

  // 登录界面 (UI已大幅升级，支持切换模式)
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white flex-col gap-8 p-4">
        <div className="text-center space-y-2">
            <h1 className="text-5xl font-bold tracking-tighter">Sumu Cloud</h1>
            <p className="text-zinc-400">极简主义者的私有云盘</p>
        </div>

        <div className="w-full max-w-xs space-y-4">
            {/* 模式切换 */}
            <div className="flex bg-zinc-900 p-1 rounded-lg">
                <button 
                    onClick={() => setLoginMode('magic')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${loginMode === 'magic' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    邮箱链接 (注册)
                </button>
                <button 
                    onClick={() => setLoginMode('password')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${loginMode === 'password' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    密码登录
                </button>
            </div>

            <div className="space-y-3">
                <input 
                    type="email" 
                    placeholder="请输入邮箱" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 outline-none focus:border-zinc-600 transition"
                />
                
                {loginMode === 'password' && (
                    <input 
                        type="password" 
                        placeholder="请输入密码" 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 outline-none focus:border-zinc-600 transition"
                    />
                )}

                <button 
                    onClick={handleLogin} 
                    disabled={authLoading}
                    className="w-full py-3 bg-white text-black rounded-lg font-bold hover:bg-zinc-200 transition active:scale-95 disabled:opacity-50">
                    {authLoading ? '处理中...' : (loginMode === 'magic' ? '发送登录链接' : '登录')}
                </button>
            </div>
            
            <p className="text-xs text-center text-zinc-500">
                {loginMode === 'password' ? '忘记密码？请使用邮箱链接登录重置' : '首次使用将自动注册'}
            </p>
        </div>
      </div>
    )
  }

  // 编辑模式视图
  if (editingNote) {
    return (
        <div className="flex flex-col h-[100dvh] bg-white text-zinc-900 overflow-hidden relative">
            <header className="flex-none flex items-center justify-between p-4 border-b bg-white z-10 shadow-sm">
                <button onClick={() => setEditingNote(null)} className="flex items-center text-zinc-600 active:text-black">
                    <ChevronLeft size={24}/> <span className="text-lg">返回</span>
                </button>
                <button onClick={saveNote} className="flex items-center gap-2 bg-black text-white px-4 py-1.5 rounded-full font-medium active:scale-95 transition">
                    <Save size={18}/> 保存
                </button>
            </header>
            
            <textarea 
                ref={textareaRef}
                className="flex-1 p-5 text-lg leading-relaxed outline-none resize-none font-sans text-zinc-800 overflow-y-auto w-full max-w-3xl mx-auto"
                placeholder="在此处开始写作..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                autoFocus
            />

            <button 
                onClick={scrollToTop}
                className="absolute bottom-6 right-6 w-12 h-12 bg-zinc-100 text-zinc-600 rounded-full border border-zinc-200 shadow-lg flex items-center justify-center hover:bg-zinc-200 active:scale-90 transition z-20 opacity-80 hover:opacity-100"
            >
                <ArrowUp size={24} />
            </button>
        </div>
    )
  }

  // 文件夹/列表视图
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 pb-24">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="font-bold text-xl tracking-tight flex items-center gap-2">
            {currentFolder ? (
                <button onClick={() => {setCurrentFolder(null); fetchData(null)}} className="flex items-center text-zinc-500 hover:text-black transition">
                    <ChevronLeft size={24} /> 返回
                </button>
            ) : '我的文件'}
        </div>
        
        <div className="flex items-center gap-3">
             {/* 设置密码按钮 */}
            <button onClick={handleSetPassword} title="设置/修改密码" className="p-2 text-zinc-400 hover:text-black transition hover:bg-zinc-100 rounded-full">
                <KeyRound size={20} />
            </button>
            {/* 退出按钮 */}
            <button onClick={() => supabase.auth.signOut()} title="退出登录" className="p-2 text-zinc-400 hover:text-red-500 transition hover:bg-red-50 rounded-full">
                <LogOut size={20} />
            </button>
        </div>
      </header>

      <main className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {!currentFolder && folders.map(folder => (
            <div key={folder.id} 
                 onClick={() => {setCurrentFolder(folder.id); fetchData(folder.id)}}
                 className="aspect-square bg-white border border-zinc-200 rounded-2xl flex flex-col items-center justify-center gap-3 shadow-sm hover:shadow-md transition cursor-pointer active:scale-95">
                <Folder size={48} className="text-zinc-800 fill-zinc-100" strokeWidth={1.5} />
                <span className="text-sm font-medium truncate w-full text-center px-4 text-zinc-600">{folder.name}</span>
            </div>
        ))}

        {currentFolder && notes.map(note => (
            <div key={note.id} 
                 onClick={() => {setEditingNote(note); setNoteContent(note.content)}}
                 className="aspect-[3/4] bg-white border border-zinc-200 rounded-xl p-4 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col overflow-hidden relative group">
                <h3 className="font-bold text-base mb-2 text-zinc-900 truncate shrink-0">{note.title || '无标题'}</h3>
                <div className="flex-1 overflow-hidden">
                    <div className="text-sm leading-relaxed text-zinc-500 line-clamp-[8] break-all">
                        <ReactMarkdown>{note.content}</ReactMarkdown>
                    </div>
                </div>
                <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
                <div className="absolute bottom-3 right-3 text-[10px] text-zinc-300 font-mono bg-white px-1">
                    {new Date(note.updated_at).toLocaleDateString()}
                </div>
            </div>
        ))}
      </main>
      
      <button 
        onClick={currentFolder ? createNote : createFolder}
        className="fixed bottom-8 right-8 w-14 h-14 bg-black text-white rounded-full shadow-xl flex items-center justify-center hover:bg-zinc-800 active:scale-90 transition z-50">
        <Plus size={28} />
      </button>
    </div>
  )
}