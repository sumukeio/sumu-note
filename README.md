# SumuNote

> 极简主义者的个人知识管理系统 - 不仅是笔记，更是你的第二大脑

SumuNote 是一个现代化的 Web 笔记应用，专注于极简设计、流畅体验和强大的知识管理能力。支持双向链接、Markdown 编辑、文件夹组织、数据统计等功能，让笔记管理变得简单而高效。

## ✨ 核心功能

### 📝 笔记管理
- **Markdown 编辑器**：实时预览、语法高亮、自动保存
- **文件夹组织**：多层级文件夹管理，清晰分类
- **笔记操作**：创建、编辑、删除、复制、重命名、置顶
- **图片上传**：支持图片上传到 Supabase Storage
- **发布分享**：一键发布笔记到 Web，生成公开链接
- **标签系统**：为笔记添加多个标签（如 `#项目`、`#想法`），支持标签筛选与搜索

### 🧠 思维笔记（Mind Notes）
- **大纲结构**：无限层级的节点树，支持任意深度的父子关系
- **富文本格式化**：支持加粗（`**文本**`）、高亮（`==文本==`）
- **快捷键操作**：
  - 桌面端：Tab（创建子节点）、Enter（创建同级节点）、Shift+Tab（提升层级）、Alt+.（展开/折叠全部）
  - 移动端：长按多选、拖拽改变层级、工具栏操作
- **拖拽重排**：流畅的拖拽体验，支持改变节点层级和顺序
- **文档内嵌**：在节点中插入其他思维笔记（`[[mind_note_id|显示名称]]`）
- **文件夹支持**：思维笔记支持文件夹组织，与文本笔记共享文件夹系统
- **长按多选**：长按文件夹或思维笔记进入多选模式，支持批量操作（重命名、移动、删除）
- **Dock 工具栏**：多选模式下显示操作工具栏，支持拖拽到 Dock 执行操作

### 🔗 双向链接（Wiki-style Links）
- **Markdown 链接语法**：支持 `[[笔记标题]]` 和 `[[noteId|显示名称]]` 语法
- **自动链接渲染**：`[[...]]` 自动转换为可点击的内部链接
- **反向链接（Backlinks）**：自动追踪哪些笔记引用了当前笔记，并显示上下文预览
- **自动补全**：输入 `[[` 时触发智能补全，快速插入笔记链接

### 📊 数据统计
- **写作热力图**：可视化展示一年内的写作活跃度
- **统计仪表盘**：总笔记数、本周新增、总字数、活跃天数等
- **文件夹分布**：饼图展示不同文件夹的笔记分布情况
- **最近编辑**：快速访问最近更新的笔记

### 🎨 用户体验
- **拖拽交互**：支持拖拽笔记进行批量操作（删除、复制、置顶等）
- **多选模式**：长按或点击进入多选模式，批量管理笔记
- **搜索功能**：
  - 列表内搜索：按标题、内容和标签搜索当前文件夹内的笔记
  - 全局搜索：在 Dashboard 顶部对所有笔记做全文搜索（标题 / 内容 / 标签）
- **回收站**：删除的笔记可恢复，支持彻底删除
- **暗色模式**：支持亮色/暗色主题切换
- **ZEN 专注模式**：编辑页面一键进入/退出专注模式，放大编辑区域、隐藏部分干扰元素

### 🔐 身份认证
- **邮箱密码登录**：传统邮箱+密码登录/注册
- **OAuth 登录**：支持 Google 和 Apple 一键登录
- **自动登录**：近期登录用户自动恢复会话，无需重复输入密码
- **会话持久化**：Supabase 自动管理 session，保持登录状态

### 💾 数据管理
- **数据导出**：支持导出所有笔记为 ZIP 文件备份
- **云端同步**：基于 Supabase 的实时数据同步
- **实时同步**：使用 Supabase Realtime 实现多端实时同步，检测到云端更新时智能提示用户选择
- **版本历史**：每次保存笔记时自动创建版本快照，保留最近 50 个版本，支持版本恢复
- **离线支持**：支持离线编辑，自动保存到本地 IndexedDB，网络恢复后自动同步到云端
- **数据安全**：企业级数据存储，用户数据私有化

## 🛠️ 技术栈

### 前端框架
- **[Next.js 16](https://nextjs.org/)** - React 框架，App Router
- **[React 19](https://react.dev/)** - UI 库
- **[TypeScript](https://www.typescriptlang.org/)** - 类型安全

### 样式与 UI
- **[Tailwind CSS 4](https://tailwindcss.com/)** - 实用优先的 CSS 框架
- **[Radix UI](https://www.radix-ui.com/)** - 无样式、可访问的 UI 组件
- **[Lucide React](https://lucide.dev/)** - 图标库
- **[next-themes](https://github.com/pacocoursey/next-themes)** - 主题切换

### 后端与数据库
- **[Supabase](https://supabase.com/)** - 后端即服务（BaaS）
  - PostgreSQL 数据库
  - 身份认证（Auth）
  - 对象存储（Storage）

### 功能库
- **[react-markdown](https://github.com/remarkjs/react-markdown)** - Markdown 渲染
- **[recharts](https://recharts.org/)** - 数据可视化图表
- **[@dnd-kit/core](https://dndkit.com/)** - 拖拽交互
- **[date-fns](https://date-fns.org/)** - 日期处理
- **[jszip](https://stuk.github.io/jszip/)** + **[file-saver](https://github.com/eligrey/FileSaver.js/)** - 数据导出
- **[localforage](https://localforage.github.io/localForage/)** - 离线存储（IndexedDB）

### 开发工具
- **[Vitest](https://vitest.dev/)** - 测试框架
- **[ESLint](https://eslint.org/)** - 代码检查
- **[Testing Library](https://testing-library.com/)** - React 组件测试

## 📦 项目结构

```
sumu-note/
├── src/
│   ├── app/                    # Next.js App Router 页面
│   │   ├── page.tsx           # 首页（登录页）
│   │   ├── dashboard/         # 仪表盘
│   │   │   ├── mind-notes/    # 思维笔记列表页
│   │   │   └── mind-notes/[id]/ # 思维笔记编辑页
│   │   ├── notes/[id]/        # 笔记详情页
│   │   └── auth/callback/     # OAuth 回调
│   ├── components/            # React 组件
│   │   ├── AuthModal.tsx      # 登录/注册弹窗
│   │   ├── FolderManager.tsx  # 文件夹管理
│   │   ├── NoteManager.tsx    # 笔记管理
│   │   ├── MarkdownRenderer.tsx # Markdown 渲染（支持双向链接）
│   │   ├── MindNoteManager.tsx # 思维笔记管理（列表页）
│   │   ├── MindNoteEditor.tsx  # 思维笔记编辑器
│   │   ├── MindNode.tsx       # 思维笔记节点组件
│   │   ├── DraggableMindNode.tsx # 可拖拽节点组件
│   │   ├── MindNodeToolbar.tsx # 移动端工具栏
│   │   └── MindNodeContent.tsx # 节点内容渲染
│   └── lib/                   # 工具函数
│       ├── supabase.ts        # Supabase 客户端
│       ├── stats.ts           # 统计数据逻辑
│       ├── export-utils.ts    # 导出功能
│       ├── version-history.ts # 版本历史管理
│       ├── offline-storage.ts # 离线存储管理
│       ├── mind-note-storage.ts # 思维笔记数据存储
│       └── mind-note-utils.ts # 思维笔记工具函数
├── docs/                      # 文档
│   ├── sql/                   # SQL 脚本
│   │   ├── create_mind_notes_tables.sql
│   │   └── add_folder_support_to_mind_notes.sql
│   └── MIND_NOTE_FEATURE.md   # 思维笔记功能文档
├── tests/                     # 测试文件
└── public/                    # 静态资源
```

## 🚀 快速开始

### 环境要求
- Node.js 18+ 
- npm / yarn / pnpm / bun

### 安装依赖

```bash
npm install
# 或
yarn install
# 或
pnpm install
```

### 环境变量配置

在项目根目录创建 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 运行开发服务器

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
# 或
bun dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建生产版本

```bash
npm run build
npm start
```

### 运行测试

```bash
npm test              # 运行测试
npm test:ui          # 测试 UI
npm test:coverage    # 测试覆盖率
```

## 🌐 部署

### Vercel（推荐）

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 配置环境变量（`NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`）
4. 部署完成

### 其他平台

项目基于 Next.js，可以部署到任何支持 Node.js 的平台：
- Netlify
- Railway
- Render
- 自建服务器

## 📝 最近更新

### 🧠 思维笔记功能
- **大纲编辑器**：类似 Workflowy/Roam Research 的无限层级节点结构
- **富文本格式化**：支持加粗（`**文本**`）和高亮（`==文本==`）
- **快捷键系统**：
  - 桌面端：Tab（创建子节点）、Enter（创建同级节点）、Shift+Tab（提升层级）、Alt+.（展开/折叠全部）
  - 移动端：长按多选、拖拽改变层级、工具栏操作
- **拖拽重排**：流畅的拖拽体验，支持改变节点层级和顺序
- **文档内嵌**：在节点中插入其他思维笔记（`[[mind_note_id|显示名称]]`）
- **文件夹支持**：思维笔记支持文件夹组织，与文本笔记共享文件夹系统
- **长按多选**：文件夹和思维笔记都支持长按（500ms）进入多选模式
- **Dock 工具栏**：多选模式下显示操作工具栏（重命名、移动、删除），支持拖拽到 Dock 执行操作

### 🔐 OAuth 登录支持
- **Google 登录**：一键使用 Google 账号登录/注册
- **Apple 登录**：支持 Apple ID 登录（需配置）
- **登录体验优化**：保留密码登录的同时，提供更便捷的第三方登录选项

### 🔗 双向链接系统
- **Wiki-style 链接语法**：支持 `[[笔记标题]]` 和 `[[noteId|显示名称]]`
- **反向链接（Backlinks）**：自动展示引用当前笔记的其他笔记列表
- **智能自动补全**：输入 `[[` 时触发笔记标题补全，支持模糊搜索

### 🔄 自动登录
- **会话持久化**：近期登录用户访问时自动恢复登录状态
- **无需重复输入**：Supabase 自动管理 session，提升用户体验

### 🐛 Bug 修复
- 修复 Next.js 14 动态路由参数使用方式
- 修复 Markdown 渲染中的 HTML 结构问题（hydration 错误）
- 修复 Vercel 构建时的类型错误和 Suspense 边界问题

### 🏷 标签 & 搜索 & 专注模式
- **标签系统（Tags）**
  - 支持在笔记编辑页为笔记添加多个标签（输入后回车即可添加，点击标签上的叉号可移除）
  - 标签保存到 `notes.tags` 字段，并在笔记卡片上以 `#tag` 形式展示
  - 列表内搜索与全局搜索均会匹配标签内容

- **ZEN 专注模式**
  - 编辑页工具栏新增 ZEN 按钮：进入专注模式时放大编辑区域（`max-w-5xl`）、隐藏部分工具按钮，仅保留撤回、专注、预览
  - 适合长文写作或需要专注时使用，再次点击即可退出

- **全局全文搜索**
  - Dashboard 顶部新增全局搜索框（桌面端可见）
  - 支持在所有笔记中按标题、内容、标签进行模糊搜索，并以列表形式展示结果
  - 点击搜索结果可直接跳转到对应的笔记详情页

### 📚 版本历史
- **自动版本快照**：每次保存笔记时自动创建版本历史，无需手动操作
- **版本管理**：自动保留最近 50 个版本，旧版本自动清理以节省存储空间
- **版本恢复**：支持查看和恢复任意历史版本（UI 功能待完善）
- **数据安全**：版本历史存储在独立的 `note_versions` 表中，支持 RLS 权限控制

### 📡 实时同步与离线支持
- **实时同步（Realtime Sync）**
  - 使用 Supabase Realtime 监听笔记变化，多端同时编辑时自动检测云端更新
  - 智能冲突处理：检测到云端更新时提示用户选择
    - **保留我的更改**：使用本地内容覆盖云端
    - **查看最新内容**：加载云端最新版本
      - 有未保存更改时，提供二次确认对话框
      - 支持"保存后刷新"：先将本地更改保存到版本历史，再加载云端版本
      - 支持"不保存，直接刷新"：丢弃本地更改，直接加载云端版本
  - 无需手动刷新页面即可看到其他设备的更新

- **离线支持（Offline Support）**
  - **智能网络检测**：自动检测网络状态，即使 `navigator.onLine` 不准确也能通过错误捕获正确判断
  - **离线编辑**：网络断开时自动保存到本地 IndexedDB，编辑体验不受影响
  - **自动同步**：网络恢复时自动同步离线更改到云端
  - **状态指示**：编辑器工具栏显示离线状态图标，清晰提示当前网络状态
  - **数据持久化**：使用 localforage 封装 IndexedDB，确保离线数据不丢失

### 🧠 思维笔记功能
- **大纲编辑器**：类似 Workflowy/Roam Research 的无限层级节点结构
- **富文本格式化**：支持加粗（`**文本**`）和高亮（`==文本==`）
- **快捷键系统**：
  - 桌面端：Tab（创建子节点）、Enter（创建同级节点）、Shift+Tab（提升层级）、Alt+.（展开/折叠全部）
  - 移动端：长按多选、拖拽改变层级、工具栏操作
- **拖拽重排**：使用 `@dnd-kit` 实现流畅的拖拽体验，支持改变节点层级和顺序
- **文档内嵌**：在节点中插入其他思维笔记（`[[mind_note_id|显示名称]]`），支持跳转和预览
- **文件夹组织**：思维笔记支持文件夹管理，与文本笔记共享文件夹系统
- **长按多选**：文件夹和思维笔记都支持长按（500ms）进入多选模式
- **Dock 工具栏**：多选模式下显示操作工具栏（重命名、移动、删除），支持拖拽到 Dock 执行操作

## 🔧 配置 OAuth 登录

### Google OAuth 配置

1. 在 [Google Cloud Console](https://console.cloud.google.com/) 创建 OAuth 2.0 客户端 ID
2. 配置重定向 URI：`https://你的项目ID.supabase.co/auth/v1/callback`
3. 在 Supabase Dashboard → Authentication → Providers → Google 中启用并填入 Client ID 和 Secret

详细配置步骤请查看项目文档或 Supabase 官方文档。

### Apple OAuth 配置

1. 需要 Apple Developer 账号（$99/年）
2. 在 Apple Developer 创建 App ID 和 Service ID
3. 配置回调 URL
4. 在 Supabase Dashboard 中启用 Apple Provider 并填入凭据

## 🔧 配置实时同步

### 启用 Supabase Realtime

实时同步功能使用 Supabase Realtime 实现多端同步。要启用此功能：

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 进入 **Database** → **Replication** 页面
4. 找到 `notes` 表，点击右侧的开关启用 Realtime

或者使用 SQL：

```sql
-- 启用 notes 表的 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
```

### 验证设置

运行以下 SQL 查询验证 Realtime 已启用：

```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notes';
```

如果返回一行数据，说明设置成功。

## 🔧 配置版本历史

### 创建版本历史表

版本历史功能需要在 Supabase 数据库中创建 `note_versions` 表：

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 进入 **SQL Editor**
4. 执行以下 SQL 脚本（见 `docs/sql/create_note_versions.sql`）

```sql
-- 创建 note_versions 表
CREATE TABLE note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  tags TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_note_versions_note_id ON note_versions(note_id);
CREATE INDEX idx_note_versions_created_at ON note_versions(created_at DESC);

-- 启用 RLS
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
CREATE POLICY "Users can view their own note versions"
  ON note_versions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own note versions"
  ON note_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own note versions"
  ON note_versions FOR DELETE
  USING (auth.uid() = user_id);
```

### 自动清理旧版本（可选）

版本历史表会自动保留最近 50 个版本，旧版本会被自动清理。如需调整清理策略，可修改 SQL 脚本中的触发器逻辑。

## 🔧 配置思维笔记

### 创建思维笔记表

思维笔记功能需要在 Supabase 数据库中创建 `mind_notes` 和 `mind_note_nodes` 表：

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 进入 **SQL Editor**
4. 执行以下 SQL 脚本（见 `docs/sql/create_mind_notes_tables.sql`）

```sql
-- 创建 mind_notes 表（思维笔记主表）
CREATE TABLE IF NOT EXISTS mind_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '未命名思维笔记',
  root_node_id UUID,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 创建 mind_note_nodes 表（思维笔记节点表）
CREATE TABLE IF NOT EXISTS mind_note_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mind_note_id UUID NOT NULL REFERENCES mind_notes(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES mind_note_nodes(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  is_expanded BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_mind_notes_user_id ON mind_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_mind_notes_updated_at ON mind_notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mind_notes_is_deleted ON mind_notes(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_mind_notes_folder_id ON mind_notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_mind_note_nodes_mind_note_id ON mind_note_nodes(mind_note_id);
CREATE INDEX IF NOT EXISTS idx_mind_note_nodes_parent_id ON mind_note_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_mind_note_nodes_order ON mind_note_nodes(mind_note_id, parent_id, order_index);

-- 启用 RLS
ALTER TABLE mind_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mind_note_nodes ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略（详见 docs/sql/create_mind_notes_tables.sql）
```

### 添加文件夹支持（可选）

如果需要在思维笔记中使用文件夹功能，执行以下 SQL 脚本（见 `docs/sql/add_folder_support_to_mind_notes.sql`）：

```sql
-- 为 mind_notes 表添加 folder_id 字段（如果尚未添加）
ALTER TABLE mind_notes 
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mind_notes_folder_id ON mind_notes(folder_id);
```

详细配置步骤请查看 `docs/sql/create_mind_notes_tables.sql` 和 `docs/MIND_NOTE_FEATURE.md`。

## 📄 许可证

本项目为私有项目。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**Built with ❤️ using Next.js and Supabase**
