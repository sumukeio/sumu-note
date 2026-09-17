# Issue 分诊详情 — 2026-09-16

> **状态**：[权威/现行]  
> **阶段**：phase-bug-triage-mindnote-sunset-20260916  
> **环境约定**：手机端 = 手机浏览器；电脑端 = 桌面浏览器。  
> **关联决策**：[ADR 思维笔记计划下线](./adr_mind-note-sunset_20260916.md)

## 用户原始草稿（归档保留）

> 以下原文保留，不硬删。正式条目见 `issue001`–`issue010`。

1. 手机端，新建笔记后的 Toast，直接挡住了标题。笔记新建起来后是一个页面，点击编辑后页面内容又变了。  
2. iPhone8P 的浏览器看不了的问题。版本？  
3. 最近打开，是一个全局的功能……手机端点击最近打开里的内容，没反应。  
4. 自动设置标题时，字数上限=10。  
5. 发布功能失败。  
6. 统计功能，统计仪表盘的页面加载不出来。  
7. 编辑页右上角的字数、段落数、阅读时间展示，不是实时更新的。  
8. 点击链接即弹窗……容易误触……想知道业界做法。  
9. 手机端 电脑端的移动功能都没反应。  
10. 删除文件夹报错：`folders_parent_id_fkey`。  
另：希望审视项目；想把思维笔记砍掉 → 已确认为**计划下线**（见 ADR）。

---

## issue001 [x] 手机端新建 Toast 挡标题 + 新建/编辑页态不一致

| 项 | 内容 |
| :--- | :--- |
| **级别** | P2 |
| **环境** | 手机浏览器 |
| **期望** | Toast 不遮挡标题输入；新建进入编辑的信息架构连贯 |
| **实际** | Toast 挡住标题；新建后一页、点编辑又换一页 |
| **相关路径** | `toast.tsx`；`mobile-editor-entry.ts`；`NoteEditor.tsx`；`NoteManager.tsx` |
| **根因** | Toast Viewport 移动端 `top-0`；空白笔记默认 `isMobileReadingMode=true` |
| **修复（task010 / 2026-09-17）** | Toast 贴底；空白新建直进编辑态，有内容仍先阅读 |
| **验证** | `tests/lib/mobile-editor-entry.test.ts` 通过；type-check 通过 |

---

## issue002 [x] iPhone 8 Plus 登录后进不去

| 项 | 内容 |
| :--- | :--- |
| **级别** | P1 |
| **环境** | iPhone 8 Plus · **iOS 16.3.1** · 多浏览器均复现（非单一浏览器） |
| **期望** | 登录后进入 dashboard；可进文件夹读写笔记 |
| **实际** | 演进：静默进不去 → 登录成功后白屏转圈 → 软跳后留首页 → 工作台可用但进文件夹 import 超时 |
| **相关路径** | `auth-login-handoff.ts`；`useRequireAuth.tsx`；`client-capability.ts`；`LightFolderNotes.tsx`；`DashboardHomeClient.tsx` |
| **根因** | (1) WebKit 上 `getSession`/软路由/Suspense 陷阱；(2) NoteManager 大包动态加载在旧机永不完成 |
| **修复（task011–020 / 2026-09-17）** | 硬跳+handoff；鉴权出 Suspense；禁首页自动跳；**双轨**（iPhone/iPod→`LightFolderNotes`，其余→NoteManager）；轻量侧文件夹 CRUD/多选顶栏；Toast z-index；debugAuth→sessionStorage（不能绕过登录）；chrome `select-none` |
| **结案文档** | [`docs/guides/IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md`](../../../docs/guides/IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md) |
| **验证** | handoff / client-capability 单测；type-check；用户确认可登录进工作台并用轻量文件夹读写（2026-09-17 关闭） |
| **Resolved At/By** | 2026-09-17 / 人类确认关单 |
| **遗留** | 见结案指南「可选后续」：拆包≠修安卓现网；轻量已增强，增量仅按需 |

---

## issue003 [x] 手机端「最近打开」点击无反应 + 跨端预期偏差

| 项 | 内容 |
| :--- | :--- |
| **级别** | P1 |
| **期望** | 点击可打开；云端全局同步 |
| **修复（task005 / 2026-09-17）** | `user_recent_notes` 表 + 本地/云合并；点击改为 `openNoteById` 状态直开；失败 Toast |
| **运维** | 执行 `docs/sql/create_user_recent_notes.sql` |
| **验证** | `tests/lib/recent-notes.test.ts`；type-check |
---

## issue004 [x] 自动标题字数上限（用户期望 10）

| 项 | 内容 |
| :--- | :--- |
| **级别** | P2（偏产品） |
| **期望** | 自动标题上限 = 10 字（用户表述） |
| **实际/代码** | 原 `useNoteSave` `slice(0, 30)` |
| **相关路径** | `src/lib/note-title.ts`；`src/hooks/useNoteSave.ts` |
| **根因** | 产品期望 10 与实现 30 不一致（ADR 已拍板） |
| **修复（task007 / 2026-09-17）** | `deriveAutoTitleFromContent` + `AUTO_TITLE_MAX_LENGTH=10` |
| **验证** | `tests/lib/note-title.test.ts` 6 passed；type-check 通过 |

---

## issue005 [x] 发布功能失败

| 项 | 内容 |
| :--- | :--- |
| **级别** | P0 |
| **期望** | 发布后可打开公开链接 |
| **实际** | 发布失败（或链接不可用） |
| **根因** | UI 复制 `/p/{id}` 但无路由；保存失败仍提示成功；匿名读缺 RLS |
| **修复（task003 / 2026-09-17）** | `/p/[id]` + `getPublishedNoteById` + ADR + SQL；save 返回 boolean |
| **验证** | `tests/lib/note-publish.test.ts`；type-check |
| **运维** | 执行 `docs/sql/allow_select_published_notes.sql` |
---

## issue006 [x] 统计仪表盘页面加载不出来

| 项 | 内容 |
| :--- | :--- |
| **级别** | P0/P1 |
| **期望** | `/dashboard/stats` 正常展示或明确错误态 |
| **实际** | 加载不出来 |
| **根因** | `getDashboardStats` 并行 4 次全量拉笔记易超时；Recharts 零尺寸/SSR 易白屏；失败态弱 |
| **修复（task004 / 2026-09-17）** | 单次拉取 + 纯函数组装；饼图客户端挂载；错误+重试 |
| **验证** | `tests/lib/stats.test.ts` 6 passed；type-check |
---

## issue007 [x] 编辑页字数/段落/阅读时间非实时

| 项 | 内容 |
| :--- | :--- |
| **级别** | P2 |
| **期望** | 输入时统计更新（至少 debounce） |
| **实际** | 不随编辑实时变 |
| **相关路径** | `note-word-stats.ts`；`NoteManager.tsx`；`NoteEditor.tsx` 展示 |
| **根因** | 统计只在 `enterEditor` 时计算，未订阅 `content` |
| **修复（task009 / 2026-09-17）** | `computeNoteWordStats`；编辑态 content debounce 200ms 刷新；字数口径 = **非空白字符数** |
| **验证** | `tests/lib/note-word-stats.test.ts` 通过；type-check 通过 |

---

## issue008 [x] 正文链接点击易误触弹窗

| 项 | 内容 |
| :--- | :--- |
| **级别** | P2 |
| **期望** | 编辑时不易误触；预览时链接可点 |
| **实际** | 编辑/换行易弹出链接弹窗 |
| **相关路径** | `editor-link-gesture.ts`；`SegmentedEditor.tsx`；`MarkdownRenderer.tsx` |
| **根因** | 编辑态 textarea `onClick` 命中 URL/wiki 即 `confirmAndOpenSmartLink` |
| **修复（task008 / 2026-09-17）** | 普通单击不打开；桌面 Cmd/Ctrl+点击；触摸长按/右键确认；预览态单击不变 |
| **验证** | `tests/lib/editor-link-gesture.test.ts` 通过；type-check 通过 |

---

## issue009 [x] 移动功能双端均无反应

| 项 | 内容 |
| :--- | :--- |
| **级别** | P1 |
| **环境** | 手机 + 电脑 |
| **期望** | 笔记/文件夹「移动到…」生效并有反馈 |
| **实际** | 无反应 |
| **相关路径** | `MoveToFolderDialog.tsx`；`NoteManager.tsx`（`handleMove*`）；`FolderManager.tsx`；`NoteList.tsx` Dock |
| **根因** | 选中态 document 捕获空白点击未忽略 Dialog Portal，先清空 `selectedIds`，移动回调空跑 |
| **修复（task006 / 2026-09-17）** | `isSelectionSafeOverlayTarget`；列表/根目录忽略浮层；FolderManager 统一 MoveToFolderDialog；空选中 Toast；Dialog z-index 高于 Dock |
| **验证** | `tests/lib/ui-event-guards.test.ts` 通过；type-check 通过 |

---

## issue010 [x] 删除文件夹违反 `folders_parent_id_fkey`

| 项 | 内容 |
| :--- | :--- |
| **级别** | P0 |
| **期望** | 删除文件夹时级联处理子文件夹/先迁出再删，并给清晰反馈 |
| **实际** | `update or delete on table "folders" violates foreign key constraint "folders_parent_id_fkey"` |
| **相关路径** | `folder-utils.ts` / `folder-service.ts`；`NoteManager.tsx`；`FolderManager.tsx` |
| **根因** | 仅删选中 id，子文件夹 `parent_id` 仍指向父级 |
| **修复（task002 / 2026-09-17）** | 展开后代 + 叶子优先删除；子树笔记软删进回收站；合并移动路径同步修复 |
| **验证** | `tests/lib/folder-utils.test.ts` 通过；type-check 通过 |
---

## 根因簇一览

| 簇 | Issues | 说明 |
| :--- | :--- | :--- |
| 数据完整性 / FK | 010 | 删文件夹 |
| 路由与发布契约 | 005 | 缺公开页 |
| 加载失败可见性 | 006 | 统计 |
| 深链与「最近」产品语义 | 003 | localStorage vs 全局预期 |
| 交互无反馈 | 009、001 | 移动、Toast/页态 |
| 编辑态统计与链接 UX | 007、008 | 需部分产品拍板 |
| 兼容性 | 002 | 需环境信息 |
| 产品参数 | 004 | 标题长度 |

## 思维笔记下线 — 代码触及面（实施阶段再用，本期不改）

- 路由：`src/app/dashboard/mind-notes/**`
- 组件：`MindNoteManager.tsx`、`MindNoteEditor.tsx`、相关 Toolbar/Node
- 库：`mind-note-storage.ts`、`mind-note-utils.ts`
- 导航入口：Dashboard / 设置等指向 mind-notes 的链接（实施时逐项隐藏）
