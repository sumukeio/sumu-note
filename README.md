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
- **搜索功能**：支持按标题和内容搜索笔记
- **回收站**：删除的笔记可恢复，支持彻底删除
- **暗色模式**：支持亮色/暗色主题切换

### 🔐 身份认证
- **邮箱密码登录**：传统邮箱+密码登录/注册
- **OAuth 登录**：支持 Google 和 Apple 一键登录
- **自动登录**：近期登录用户自动恢复会话，无需重复输入密码
- **会话持久化**：Supabase 自动管理 session，保持登录状态

### 💾 数据管理
- **数据导出**：支持导出所有笔记为 ZIP 文件备份
- **云端同步**：基于 Supabase 的实时数据同步
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
│   │   ├── notes/[id]/        # 笔记详情页
│   │   └── auth/callback/     # OAuth 回调
│   ├── components/            # React 组件
│   │   ├── AuthModal.tsx      # 登录/注册弹窗
│   │   ├── FolderManager.tsx  # 文件夹管理
│   │   ├── NoteManager.tsx    # 笔记管理
│   │   ├── MarkdownRenderer.tsx # Markdown 渲染（支持双向链接）
│   │   └── ui/                # UI 基础组件
│   └── lib/                   # 工具函数
│       ├── supabase.ts        # Supabase 客户端
│       ├── stats.ts           # 统计数据逻辑
│       └── export-utils.ts    # 导出功能
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

## 📄 许可证

本项目为私有项目。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**Built with ❤️ using Next.js and Supabase**
