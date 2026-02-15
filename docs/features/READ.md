## 只读页面功能

只读页面（`/notes/[id]`）提供了笔记的预览功能，支持 Markdown 渲染、搜索高亮、内容复制等功能。


## 项目概览

**SumuNote** 是一个基于 Next.js 的个人知识管理系统，定位为“极简主义者的第二大脑”。

## 技术架构

### 前端技术栈
- **框架**: Next.js 16 (App Router) + React 19 + TypeScript
- **样式**: Tailwind CSS 4 + Radix UI 组件库
- **拖拽**: @dnd-kit/core 实现拖拽交互
- **数据可视化**: Recharts
- **离线存储**: LocalForage (IndexedDB)

### 后端技术栈
- **BaaS**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **实时同步**: Supabase Realtime
- **数据存储**: PostgreSQL 数据库

## 核心功能模块

### 1. 笔记管理 (`NoteManager`)
- Markdown 编辑器（实时预览、语法高亮）
- 文件夹组织（多层级）
- 标签系统（支持多标签）
- 双向链接（Wiki-style `[[链接]]` 语法）
- 反向链接（Backlinks）
- 版本历史（自动保存最近 50 个版本）
- 实时同步（多端同步，冲突处理）
- 离线支持（自动保存到 IndexedDB，网络恢复后同步）
- 导出功能（ZIP 备份）
- 搜索功能（列表内搜索 + 全局全文搜索）

### 2. 思维笔记 (`MindNoteEditor`)
- 大纲编辑器（无限层级节点树）
- 富文本格式化（加粗 `**文本**`、高亮 `==文本==`）
- 快捷键操作（Tab/Enter/Shift+Tab）
- 拖拽重排（改变节点层级和顺序）
- 文档内嵌（`[[mind_note_id|显示名称]]`）
- 文件夹支持
- 撤销/重做功能

### 3. 任务管理 (`TodoManager`)
- 多视图模式（列表、日历、看板、四象限、时间线、甘特图）
- 任务清单（Todo Lists）
- 子任务支持
- 优先级、标签、截止日期
- 重复任务规则
- 提醒功能
- 筛选和排序

### 4. 数据统计 (`NoteStats`)
- 写作热力图
- 统计仪表盘（总笔记数、字数、活跃天数等）
- 文件夹分布饼图
- 最近编辑记录

## 数据库结构

主要数据表：
1. `notes` - 文本笔记表
2. `folders` - 文件夹表
3. `mind_notes` - 思维笔记主表
4. `mind_note_nodes` - 思维笔记节点表
5. `todos` - 任务表
6. `todo_lists` - 任务清单表
7. `note_versions` - 笔记版本历史表
8. `user_settings` - 用户设置表

## 项目结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── page.tsx           # 首页（登录页）
│   ├── dashboard/         # 仪表盘
│   │   ├── page.tsx       # 笔记列表页
│   │   ├── mind-notes/    # 思维笔记
│   │   ├── todos/         # 任务管理
│   │   └── stats/         # 统计页面
│   └── notes/[id]/        # 笔记详情页
├── components/            # React 组件
│   ├── NoteManager.tsx    # 笔记管理
│   ├── MindNoteEditor.tsx # 思维笔记编辑器
│   ├── TodoManager.tsx    # 任务管理
│   └── ui/                # UI 组件库
└── lib/                   # 工具函数
    ├── supabase.ts        # Supabase 客户端
    ├── offline-storage.ts # 离线存储
    ├── version-history.ts # 版本历史
    ├── mind-note-storage.ts # 思维笔记存储
    └── todo-storage.ts    # 任务存储
```

## 只读页面功能特性

### 1. Markdown 渲染 ✅
- 使用 `MarkdownRenderer` 组件渲染笔记内容
- 支持完整的 Markdown 语法（标题、列表、链接、表格等）
- 支持双向链接（Wiki-style `[[链接]]` 语法）
- 自动转换为可点击的内部链接

### 2. 内容可复制 ✅
- 内容区域支持文本选择（`user-select: text`）
- 用户可以选择和复制渲染后的内容
- 支持跨浏览器兼容（Chrome、Safari、Firefox）

### 3. 搜索高亮和定位 ✅
- **自动高亮**：从搜索结果进入时，自动高亮所有匹配的搜索词
- **自动定位**：自动滚动到第一个匹配项，确保用户能看到相关内容
- **匹配项导航**：
  - 支持 `Ctrl+G` / `Cmd+G` 跳转到下一个匹配项
  - 支持 `Ctrl+Shift+G` / `Cmd+Shift+G` 跳转到上一个匹配项
  - 支持 `F3` / `Shift+F3` 导航
  - 提供可视化导航按钮（上一个/下一个）
- **高亮样式**：
  - 所有匹配项：黄色背景高亮（`bg-yellow-200 dark:bg-yellow-900`）
  - 当前匹配项：蓝色边框高亮（`ring-2 ring-blue-500`）

### 4. 反向链接（Backlinks）✅
- 自动显示引用当前笔记的其他笔记
- 显示引用上下文片段
- 点击可跳转到引用笔记

### 5. 编辑功能 ✅
- 提供"编辑"按钮，可快速切换到编辑模式
- 跳转到 `/dashboard` 页面并自动打开对应笔记

## 技术实现

### 文件位置
- **页面组件**: `src/app/notes/[id]/page.tsx`
- **Markdown 渲染器**: `src/components/MarkdownRenderer.tsx`
- **搜索工具**: `src/lib/search-utils.ts`

### 核心功能实现

#### 1. Markdown 渲染
```typescript
<MarkdownRenderer content={note.content || ""} />
```
- 使用 `react-markdown` 库渲染 Markdown
- 自定义组件处理内部链接和表格样式
- 支持暗色模式

#### 2. 搜索高亮
- 使用 `TreeWalker` API 遍历 DOM 文本节点
- 使用 `Range` API 创建高亮标记
- 智能跳过已高亮的节点，避免重复高亮
- 支持跨节点的高亮处理

#### 3. 自动定位
- 等待 Markdown 渲染完成（600ms 延迟）
- 使用 `requestAnimationFrame` 确保 DOM 更新
- 使用 `scrollIntoView` 平滑滚动到匹配项
- 添加二次检查确保元素在可视区域内

## 核心特性

1. 实时同步：使用 Supabase Realtime 实现多端实时同步，检测到云端更新时自动保存本地更改到版本历史，然后加载云端最新版本
2. 离线支持：网络断开时自动保存到本地，恢复后自动同步
3. 版本历史：每次保存自动创建版本快照
4. 拖拽交互：支持拖拽笔记、节点、任务进行批量操作
5. 多选模式：长按进入多选模式，支持批量操作
6. 暗色模式：支持亮色/暗色主题切换
7. OAuth 登录：支持 Google、Apple 一键登录
8. **搜索功能**：全局全文搜索，支持高亮和定位 ✅
9. **只读预览**：Markdown 渲染，内容可复制，搜索高亮 ✅
10. **云端冲突处理**：自动保存本地更改到版本历史，然后加载云端最新版本，无需手动选择 ✅

## 开发工具

- **测试**: Vitest + Testing Library
- **代码检查**: ESLint
- **类型检查**: TypeScript

项目结构清晰，功能模块化，代码组织良好。需要我深入某个模块或功能吗？