This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## SumuNote Features (最近更新)

### 双向链接（Wiki-style Links）

- **Markdown 双向链接语法**
  - 支持 `[[笔记标题]]` 和 `[[noteId|显示名称]]` 语法。
  - 通过 `src/components/MarkdownRenderer.tsx` 进行统一解析渲染：
    - 将 `[[...]]` 转换为内部链接 `/notes/[id or title]`。
    - 内部链接使用极简高亮样式（`bg-blue-50 text-blue-600`），点击后跳转到对应笔记详情页。

- **笔记详情页 & Backlinks**
  - 新增 `src/app/notes/[id]/page.tsx`：
    - 支持通过笔记 `id` 或标题访问单篇笔记。
    - 使用 `MarkdownRenderer` 渲染笔记正文。
    - 底部新增 **Backlinks** 区域：
      - 使用 Supabase 在 `notes.content` 上执行 `ILIKE` 模糊查询，查找包含 `[[当前笔记 id...` 或 `[[当前笔记标题]]` 的笔记。
      - 展示引用当前笔记的其他笔记列表 + 一小段上下文预览（Context Snippet）。

### 编辑体验：`[[` 自动补全

- 在 `src/components/NoteManager.tsx` 的编辑器模式中：
  - 当用户在内容中输入 `[[` 时：
    - 触发简易自动补全浮层，候选来源为当前文件夹内的笔记列表。
    - 支持根据后续输入对笔记标题 / 内容做模糊过滤。
  - 键盘交互：
    - `↑ / ↓`：移动选中项。
    - `Enter`：插入当前选中笔记的链接。
    - `Esc`：关闭自动补全。
  - 插入格式：
    - 选中后自动插入 `[[noteId|title]]`，确保即使标题变更，仍能通过 `id` 唯一定位目标笔记。

### 自动登录（Session Persistence）

- **近期登录用户免密自动登录**
  - 在 `src/app/page.tsx` 中实现：
    - 页面加载时自动调用 `supabase.auth.getUser()` 检查是否存在有效会话。
    - 如果检测到用户已登录（Supabase 的 session / refresh token 仍有效），自动跳转到 `/dashboard`，无需用户再次输入密码。
  - **技术原理**：
    - Supabase JS SDK 会自动从浏览器本地存储（localStorage / IndexedDB）中恢复登录状态。
    - 只要用户之前成功登录过，且会话未过期（或可通过 refresh token 刷新），下次访问网站即可自动登录。
  - **用户体验**：
    - 已登录用户访问首页时，会无缝跳转到仪表盘，提升使用流畅度。
    - 未登录或会话已过期的用户，仍会看到原有的登录/注册界面。

### Bug 修复记录

- **Next.js 动态路由参数使用方式**
  - 修复了 `src/app/notes/[id]/page.tsx` 中直接访问 `params.id` 导致的报错：
    - 现在使用 `useParams<{ id: string }>()` 获取动态路由参数，避免 `params` 作为 Promise 导致的运行时错误。

- **Markdown 渲染中的 HTML 结构问题**
  - 之前的 Markdown `code` 渲染器在块级代码块中返回 `<div><code>...</code></div>`：
    - 当被包裹在 `<p>` 内部时会产生 “`<div> cannot be a descendant of <p>`” 的 hydration 报错。
  - 现已调整为：
    - 非行内代码渲染为单个块级 `<code>` 元素（`display: block`），避免在 `<p>` 里嵌套 `<div>`，消除结构与 hydration 警告。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
