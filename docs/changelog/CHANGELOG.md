# 更新日志

> **状态**：[权威/现行]  
> 本文档记录项目的重要更新和修复。**只追加、不覆盖。**  
> 路径兼容入口：[`docs/CHANGELOG.md`](../CHANGELOG.md)

## 2026-09-17

### 📝 澄清：NoteManager 拆包 / 轻量增量不是必做下一项

- **轻量已增强**（issue002 关闭所需能力已齐）；「增量」= 可选从砍掉矩阵加回，只服务 iPhone/iPod  
- **NoteManager 拆包**：不为修安卓/PC 现网故障（完整轨已可用）；动机是首屏/中端机韧性与长期架构  
- **下一项默认建议**：思维笔记下线实施；拆包/轻量增量无痛点则搁置  
- 详见 [`guides/IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md`](../guides/IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md)「可选后续」

### ✅ issue002 关闭 + 文档落盘（task021）

- **关闭**：iPhone 8 Plus / iOS 16.3.1 登录→工作台→文件夹可用；双轨策略定稿
- **结案指南**：[`docs/guides/IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md`](../guides/IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md)
- **索引**：`.phrase/docs/ISSUES.md`、分诊详情、移动端测试指南、文档路由表已同步
- **遗留（不阻塞）**：见结案指南「可选后续」——拆包/轻量增量均非必做

### 📋 本轮分诊收束（issue001–010，2026-09-16～17）

| Issue | 要点 |
| :--- | :--- |
| issue001 | Toast 贴底；空白新建直进编辑 |
| issue002 | 硬跳 handoff + iPhone 轻量双轨（本条目关闭） |
| issue003 | 最近打开云端全局 + 手机点击直开（需 SQL） |
| issue004 | 自动标题上限 10 |
| issue005 | `/p` 公开页 + RLS SQL |
| issue006 | 统计单次拉取 + 失败可重试 |
| issue007 | 字数=非空白；编辑态实时统计 |
| issue008 | 链接防误触（Cmd/Ctrl / 长按） |
| issue009 | 移动浮层不被空白点击清选中 |
| issue010 | 删文件夹叶子优先 + 子树软删 |

### 🔧 issue002 续修：多选 UI / Toast / 调试开关（task020）

- **多选顶栏**：改为「已选 N」+ 四格图标按钮，避免文字挤出
- **Toast**：去掉挡住 Toast 的底栏 Dock（操作改顶栏）；Toast z-index 提高
- **调试**：`debugAuth` 改为 sessionStorage（关标签即失效）；说明不能绕过登录；排障完用 `/?debugAuth=0`
- **不可选文字**：导航/多选条/分区标题等 chrome 加 `select-none`；正文/标题输入仍可选

### 🔧 issue002 续修：轻量侧文件夹操作与 Dock（task019）

- **现象**：多选看不到 Dock（被调试条挡住）；子文件夹不可选；无法在文件夹内新建文件夹
- **处理**：顶栏+高 z-index 底栏双 Dock；子文件夹长按/多选；新建文件夹；文件夹移动/级联删除；多选入口按钮
- **验证**：`tsc --noEmit` 通过

### 🔧 issue002 续修：双轨文件夹（task018）

- **策略**：iPhone/iPod → 增强轻量 `LightFolderNotes`；安卓/PC/iPad → 动态完整 `NoteManager`
- **轻量保留**：Dock 点击、置顶、回收站、批量移动/删除、同步提示、简化版本历史与列表缓存
- **轻量砍掉**：分段编辑/表格/格式条/发布/拖拽 Dock/补全/字数
- **验证**：client-capability 6 passed；`tsc --noEmit` 通过

### 🔧 issue002 续修：轻量进文件夹（task017）

- **现象**：`note-manager:import-start` 后 15s 必 `import-timeout`（大包在 iPhone 上永不完成）
- **处理**：新增 `LightFolderNotes`（列表/新建/简易编辑），进文件夹不再动态加载 NoteManager
- **手测**：点文件夹应见 `light-folder:mount` → `load-ok`；可打开/新建/保存笔记

### 🔧 issue002 续修：进文件夹白屏（task016）

- **现象**：能进工作台文件夹列表；点文件夹后白屏转圈
- **处理**：`NoteFolderLazy` 超时/返回；预加载 NoteManager；拉笔记 10s 超时；调试条「清空日志」；进工作台前清日志
- **手测**：点文件夹应见 `folder:enter` → `note-manager:import-ok` → `fetch-ok`；卡死可点返回

### 🔧 issue002 续修：禁止首页自动跳转（task015）

- **现象**：一开首页就跳进「正在验证登录状态」白屏，来不及复制调试日志
- **处理**：取消首页自动进 dashboard，改为「进入工作台」按钮；鉴权页/加载页可回首页；工作台改回按需 import + 15s 超时；NoteManager 懒加载
- **手测**：`/?debugAuth=1` 应停在首页能看绿条；点「进入工作台」再进 dashboard

### 🔧 issue002 续修：去掉 dynamic/Suspense 卡死（task014）

- **现象**：鉴权已通过（`admit:storage` / `dashboard:auth-ok`），卡在「正在加载工作台」；首页↔dashboard 循环
- **处理**：静态渲染 `DashboardHomeClient`；废除 `useSearchParams`（改读 `location.search`）；首页已登录改为硬跳
- **手测**：绿条应出现 `dashboard-home:mount` 并进入文件夹列表

### 🔧 issue002 续修：Suspense 卡死白屏（task013）

- **现象**：`login:hard-nav` 后无任何 `requireAuth:*`；`/dashboard` 白屏转圈
- **根因**：鉴权写在 `useSearchParams` 的 Suspense 内，iOS 上可能永不 resolve
- **处理**：轻量 `DashboardAuthGate` 先鉴权；主界面 dynamic 加载；跳转目标改为纯 `/dashboard`；`html-boot` 信标
- **验证**：auth-login-handoff 4 passed；`tsc --noEmit` 通过

### 🔧 issue002 续修：白屏无调试条 + 硬跳放行（task012）

- **现象**：登录后白屏转圈；仅 `/?debugAuth=1` 能见绿条，白屏页加参仍空白
- **根因假设**：软跳卡在路由过渡，dashboard 未挂载；鉴权又卡在 `getSession`
- **处理**：登录后 `location.assign` 硬跳；handoff/localStorage user 优先放行；调试条挂根 layout；日志改 localStorage
- **验证**：auth-login-handoff 4 + auth-session-resilience 6 passed；`tsc --noEmit` 通过

### 🔧 issue002 续修：handoff 优先放行 + 调试条跨页

- **现象**：登录后白屏转圈；`/?debugAuth=1` 有日志，dashboard 上看不到
- **处理**：有 handoff 时先放行再后台校验；`debugAuth=1` 写入 localStorage 跨页；调试条 z-index 拉高
- **手测**：先开 `/?debugAuth=1`，再登录；应进工作台且页底有 `handoff-first` 日志

### 🐛 issue002 iPhone 登录后进不去（task011） ✅ 已关闭（见 task021）

- **环境**：iPhone 8 Plus · iOS 16.3.1 · 多浏览器；首页/登录可开，登录后静默进不去
- **根因假设**：登录后进 dashboard 时 `getSession` 偶发空 → 静默踢回首页；未登录分支未结束 loading
- **修复**：session 短重试；成功后硬跳转；回流 `/?auth=required` + Toast；无痕存储告警
- **验证**：`tests/lib/auth-session-resilience.test.ts` 3 passed；`tsc --noEmit` 通过

### 🐛 issue001 手机新建 Toast 挡标题 / 页态不一致（task010） ✅

- **问题**：Toast 贴顶挡住标题；空白新建先进阅读态需再点编辑
- **修复**：Toast 全端贴底；`shouldStartInMobileReadingMode`——空白直进编辑、有内容仍先阅读
- **验证**：`tests/lib/mobile-editor-entry.test.ts` 2 passed；`tsc --noEmit` 通过

### 🐛 issue007 编辑页字数/段落/阅读时间非实时（task009） ✅

- **问题**：统计仅在打开笔记时计算，输入不更新
- **修复**：`computeNoteWordStats`；编辑态对 `content` debounce 200ms 刷新
- **字数口径（产品确认）**：非空白字符数（中英数字标点均计，空白不计）；段落仍为非空行
- **验证**：`tests/lib/note-word-stats.test.ts` 4 passed；`tsc --noEmit` 通过

### 🐛 issue008 正文链接编辑态易误触（task008） ✅

- **问题**：编辑态单击 URL/`[[wiki]]` 即弹「打开链接」
- **修复**：编辑态普通单击只落光标；桌面 Cmd/Ctrl+点击、手机长按/右键才确认；预览态保持单击（MarkdownRenderer）
- **验证**：`tests/lib/editor-link-gesture.test.ts` 6 passed；`tsc --noEmit` 通过

### 🐛 issue004 自动标题字数上限（task007） ✅

- **问题**：空标题保存时从正文首行截取上限为 30，产品期望 10
- **修复**：抽出 `deriveAutoTitleFromContent`（`AUTO_TITLE_MAX_LENGTH=10`）；`useNoteSave` 接入
- **验证**：`tests/lib/note-title.test.ts` 6 passed；`tsc --noEmit` 通过

### 🐛 issue009 移动功能双端无反应（task006） ✅

- **问题**：多选后点「移动」弹窗内目标时无反应 / 静默退出
- **根因**：① 选中态 document 捕获空白点击未忽略 Dialog；② `fetchNotes` finally 无条件清空 `selectedIds`，弹窗期间选中被洗掉；确认时读空选中且曾无 Toast
- **修复**：`isSelectionSafeOverlayTarget`；打开弹窗时快照 `pendingMove`；去掉 fetchNotes 清选中；即时「正在移动…」Toast；弹窗期间隐藏 Dock；Dialog `z-[60]`
- **验证**：`tests/lib/ui-event-guards.test.ts` 3 passed；`tsc --noEmit` 通过
- **手测**：单选笔记 → 移动 → 选目标 → 应出现「正在移动…」再「移动成功」

### 🐛 issue003 最近打开点击无反应 / 非云端（task005） ✅

- **问题**：手机点「最近打开」无反应；列表仅 localStorage，无法跨端
- **修复**：`user_recent_notes` 云端表 + 本地合并；点击改为状态直开（查真实 folder_id）；失败 Toast；打开后清除 initialNoteId
- **运维**：执行 `docs/sql/create_user_recent_notes.sql`（未执行时降级本地，点击修复仍生效）
- **验证**：`tests/lib/recent-notes.test.ts` 3 passed；`tsc --noEmit` 通过

### 🐛 issue006 统计仪表盘加载失败（task004） ✅

- **问题**：`/dashboard/stats` 加载不出来
- **修复**：`getDashboardStats` 改为单次拉取再纯函数聚合（避免 4 次全量并行）；Recharts 饼图仅客户端挂载并固定高度；失败展示原因+重试
- **验证**：`tests/lib/stats.test.ts` 6 passed；`tsc --noEmit` 通过

### 🐛 issue005 发布功能失败（task003） ✅

- **问题**：发布后链接指向 `/p/{id}`，但无对应路由；保存失败仍提示已发布
- **修复**：新增公开页 `/p/[id]`、`getPublishedNoteById`、可读性校验；ADR 锁定语义；提供 RLS SQL；`save` 返回成功与否，发布失败回滚状态并 Toast
- **运维**：请在 Supabase 执行 `docs/sql/allow_select_published_notes.sql`（匿名访客必需）
- **验证**：`tests/lib/note-publish.test.ts` 4 passed；`tsc --noEmit` 通过

### 🐛 issue010 删除文件夹外键失败（task002） ✅

- **问题**：删除含有子文件夹的文件夹时报 `folders_parent_id_fkey`
- **修复**：`resolveFolderIdsForDelete` 展开后代并叶子优先删除；`deleteFoldersCascade` 同步将子树笔记移入回收站；`NoteManager` / `FolderManager` 接入
- **验证**：`npm test -- --run tests/lib/folder-utils.test.ts`（5 passed）；`npm run type-check` 通过
- **文件**：`src/lib/folder-utils.ts`、`src/lib/folder-service.ts`、`tests/lib/folder-utils.test.ts`、`NoteManager.tsx`、`FolderManager.tsx`

## 2026-09-16

### ✅ 产品拍板落盘（无代码）

- 最近打开 → **云端全局**（issue003）
- 自动标题上限 → **10**（issue004）
- 链接误触 → **同意编辑态防误触手势**（issue008）
- 首页/笔记/文件夹改版 → **待讨论**，未立项
- 详情：`.phrase/phases/phase-bug-triage-mindnote-sunset-20260916/adr_product-decisions_recents-title-link_20260916.md`

### 🩺 Bug 分诊登记 + 思维笔记计划下线（phase-bug-triage / task001） ✅

- **决策**：思维笔记 **计划下线**（本期仅 ADR，不实施下线代码）→ `.phrase/phases/phase-bug-triage-mindnote-sunset-20260916/adr_mind-note-sunset_20260916.md`
- **登记**：`issue001`–`issue010` 见 `.phrase/docs/ISSUES.md`；详情与优先级见同 phase `issue_triage_20260916.md`
- **建议先修**：issue010（删文件夹 FK）→ issue005（发布/`/p`）→ issue006（统计）
- **验证**：仅文档；无 `src/` 业务改动

### 🧱 工程治理脚手架落地（task001） ✅

- **依据**：根目录 `AGENTS.md` 本地化；阶段 `phase-engineering-governance-20260916`
- **变更**：
  - 适配 Sumu Note 技术栈与负向禁令；标明对数据平台专属条款的「暂缓启用」
  - 新增 `.phrase/`（spec/plan/task/change + CHANGE/ISSUES 索引）
  - 新增 `.agents/rules/`、`.cursor/rules/`、`.cursorrules`
  - 更新 `docs/README.md` 治理路由；新增 `docs/CHANGELOG.md` 薄索引
- **验证**：关键路径文件存在；无业务运行时代码改动
- **影响**：仅协作流程与文档可追溯性

## 2026-03-XX

### 🧩 Dock 多选与编辑体验修复（2026-03-18）

#### 1) 粘贴 Markdown 不再“缩成一团” ✅
- **问题**：编辑器粘贴时优先走 `text/html` → `htmlToMarkdown()`，其中对空白的处理会吞掉换行，导致 Markdown 段落合并成一行。
- **修复**：
  - 粘贴策略：检测到多行或疑似 Markdown 时优先使用 `text/plain`，保留换行与段落。
  - `htmlToMarkdown`：不再用 `\\s+` 全量折叠空白；保留换行，并对 `pre/code` 做更安全的转换。
- **文件**：`src/components/SegmentedEditor.tsx`

#### 2) Dock 新增「全选/取消全选」 ✅
- **能力**：在文件夹列表页 Dock 中新增「全选」，支持一键选中当前列表内可见的**文件夹 + 笔记**；再次点击可「取消全选」并退出多选模式。
- **文件**：`src/components/NoteList.tsx`、`src/components/NoteManager.tsx`

#### 3) 多选模式下点击空白区域可取消选中 ✅
- **问题**：部分页面只能点击“卡片间隙/局部空白”才能退出多选，点击页面其它留白不生效。
- **修复**：在列表页与根目录文件夹页增加 document 捕获级空白点击退出（排除卡片、Dock、顶部栏）。
- **文件**：`src/components/NoteList.tsx`、`src/components/FolderManager.tsx`

#### 4) 移动端编辑页「完成」按钮去重 ✅
- **问题**：移动端写作模式右上与右下均出现「完成」，造成重复入口。
- **修复**：移除右上角「完成」，仅保留底部悬浮「完成」。
- **文件**：`src/components/NoteEditor.tsx`

#### 5) 移动端：进入编辑页只显示 1/3 / 键盘遮挡输入 ✅
- **问题 A**：从预览页进入编辑页，编辑层偶发只显示 1/3，高度/位移依赖的 `--vvh/--vv-offset-top` 可能卡在旧值。
- **问题 B**：编辑时当前输入位置可能被软键盘覆盖。
- **修复**：
  - `ViewportVars` 增加 `pageshow/focus/visibilitychange` 等时机强制刷新 `visualViewport` 相关 CSS 变量，并做首帧兜底刷新。
  - 编辑全屏层对 `--vv-offset-top` 做保护：仅允许负 offset 生效，避免异常正 offset 把全屏层下推。
  - 移动端写作模式下 textarea 聚焦时 `scrollIntoView`，降低被键盘遮挡概率。
- **文件**：`src/components/ViewportVars.tsx`、`src/components/NoteEditor.tsx`、`src/components/SegmentedEditor.tsx`

### ✨ 11 项需求落地（1-11）与体验补齐（2026-03-06）

#### 1) 撤销/重做快捷键 ✅
- 普通笔记支持 Ctrl/Cmd + Z 撤销、Ctrl+Y/Cmd+Shift+Z 重做，多步撤销 + 重做栈
- 文件：`src/components/NoteManager.tsx`

#### 2) 粘贴优化（不含图片粘贴）✅
- 支持 HTML `<table>` 与 TSV（Excel）粘贴转 Markdown 表格
- 富文本粘贴清理（标题/列表/引用等基础结构）
- 文件：`src/components/SegmentedEditor.tsx`、`src/lib/table-utils.ts`

#### 3) 移动端输入稳定性 ✅
- 中文输入法组合态期间避免 `setSelectionRange` 打断输入，降低光标跳动/失焦
- 文件：`src/components/SegmentedEditor.tsx`

#### 4) 新建按钮 UI 优化 ✅
- 文件夹内（NoteList）PC 端合并为「新建」主按钮下拉
- 根目录（FolderManager）新建按钮主色化，默认直接新建文件夹
- 文件：`src/components/NoteList.tsx`、`src/components/FolderManager.tsx`

#### 5) 移动端拇指可及 ✅
- 列表页新增 FAB 下沉新建入口；编辑页底部保存入口保持可达（safe-area）
- 文件：`src/components/NoteList.tsx`、`src/components/NoteEditor.tsx`

#### 6) 触觉反馈 ✅
- 新增统一封装 `haptics`，在勾选/保存/删除/长按多选等场景调用
- 文件：`src/lib/haptics.ts`、`src/components/NoteManager.tsx`、`src/components/FolderManager.tsx`、`src/components/MindNoteManager.tsx`、`src/components/TodoItem.tsx`、`src/hooks/useNoteSave.ts`

#### 7) 表格列宽拖拽 + 首列冻结 ✅（需执行 SQL 建表）
- 编辑态表格支持列宽拖拽、首列冻结；预览态同步列宽/冻结
- 新增表格布局元数据表脚本：`docs/sql/create_note_table_layouts.sql`
- 文件：`src/lib/note-service.ts`、`src/components/SegmentedEditor.tsx`、`src/components/MarkdownRenderer.tsx`

#### 8) 最近打开 ✅
- Dashboard 增加“最近打开”（默认折叠，折叠状态本地持久化）
- 文件：`src/lib/recent-notes.ts`、`src/app/dashboard/page.tsx`、`src/components/NoteManager.tsx`

#### 9) 长文虚拟滚动 ✅
- 预览态 Markdown 块级虚拟化；编辑态 SegmentedEditor 段级虚拟化（保留活动段避免丢焦）
- 依赖：`@tanstack/react-virtual`
- 文件：`src/components/MarkdownRenderer.tsx`、`src/components/SegmentedEditor.tsx`

#### 10) 离线首屏缓存 ✅
- 列表/内容缓存优先展示，网络回填；保存成功后写缓存
- 文件：`src/lib/offline-storage.ts`、`src/components/NoteManager.tsx`、`src/hooks/useNoteSave.ts`

#### 11) 启动速度优化 ✅
- Dashboard 预取常用路由与最近笔记页
- 文件：`src/app/dashboard/page.tsx`

### ✨ 笔记编辑页体验优化（Task 7.5.2～7.6.2）

#### 1. 标题下元信息行 ✅
- 在标题下方增加弱化元信息：更新时间（如「更新于 3月5日」）、标签（`#tag1 #tag2`）
- 阅读态与编辑态均展示，小字号、`text-muted-foreground`，不抢夺正文注意力
- 文件：`src/components/NoteEditor.tsx`

#### 2. 长文目录/大纲 ✅
- 解析正文中的 H1/H2/H3 标题，在「更多」菜单中提供「目录」入口
- 点击目录项可平滑滚动到对应标题（`scrollIntoView`）
- 标题渲染时设置 `id` 与 `extractOutline` 一致，支持锚点跳转
- 文件：`src/lib/outline-utils.ts`、`src/components/MarkdownRenderer.tsx`、`src/components/NoteEditor.tsx`

#### 3. 聚焦态/选区态样式 ✅
- 去掉标题与正文的默认粗边框
- 通过 `focus-within:bg-muted/10`（标题）、`focus-within:bg-muted/5` 与 `focus-within:border-l-2`（正文）表达可编辑
- SegmentedEditor 支持 `textareaClassName` 覆盖 border/ring，由外层 focus-within 表达
- 文件：`src/components/NoteEditor.tsx`、`src/components/SegmentedEditor.tsx`

#### 4. Placeholder 与首次轻提示 ✅
- 标题 placeholder「写个标题」、正文「向下输入正文，输入 / 可插入内容…」
- 移动端首次进入编辑态时显示一次 Toast 轻提示，`localStorage` 标记 `sumunote:editor-hint-seen` 仅显示一次
- 文件：`src/components/NoteEditor.tsx`

---

## 2026-02-XX（历史）

### ✨ 新功能：Toast + 撤销（Undo）

#### 1. 全局 Toast 撤销基础能力 ✅
- **统一的撤销交互**：
  - 为全局 `toast` 能力新增 `undoAction` 与 `duration` 支持（默认 5 秒自动关闭）。
  - 在 `Toaster` 中，当传入 `undoAction` 时，在右侧渲染「撤销」按钮，点击后执行回调并关闭当前 Toast。
  - 同时支持最多 3 条 Toast 并行显示，避免重要提示被覆盖。
- **技术实现**：
  - `src/components/ui/use-toast.ts`：扩展 `ToasterToast` 类型，新增 `undoAction`、`duration` 字段；增加自动关闭与延迟移除两级定时控制。
  - `src/components/ui/toaster.tsx`：根据 `undoAction` 动态渲染「撤销」按钮，并与 Radix Toast 行为兼容。

#### 2. 普通笔记（NoteManager）关键操作支持撤销 ✅
- **移动到其他文件夹**：
  - 支持同时移动“子文件夹 + 笔记”，并在成功后展示可撤销的 Toast。
  - Toast 内的撤销会将所有被移动的条目按照原始 `parent_id` / `folder_id` 还原到移动前位置。
  - 同时记录“上次移动到”目标文件夹，移动对话框支持快捷选择“上次移动到”。
- **批量删除（列表页 Dock 删除）**：
  - 删除子文件夹：执行真实删除（`folders.delete`），并在本地记录被删除文件夹快照，撤销时通过 `insert` 重新插入。
  - 删除笔记：并非直接删除，而是将 `notes.is_deleted=true` 移入回收站，撤销时批量恢复 `is_deleted=false`。
  - 删除成功后展示带撤销按钮的 Toast，点击后自动还原内容并给出“已撤销删除”的二次提示。
- **编辑页删除当前笔记**：
  - 编辑器内“删除当前笔记”仍采用“移入回收站”的软删除策略。
  - 删除成功 Toast 带有撤销按钮；撤销时仅针对当前笔记执行 `is_deleted=false` 并刷新列表。
- **新建笔记 / 新建文件夹**：
  - 新建空白笔记后，立即进入编辑器，同时弹出 Toast；若在有效时间内点击“撤销”，会删除这条空白笔记并返回列表。
  - 新建文件夹成功后，通过一次查询获取刚创建的文件夹 `id`，Toast 附带撤销回调；撤销将删除该文件夹并刷新子文件夹列表。
- **回收站“彻底删除”**：
  - 所有在“回收站视图”中执行的“彻底删除”操作仍为不可撤销（按照产品决定），不提供 Undo 按钮。
- **文件**：
  - `src/components/ui/use-toast.ts`
  - `src/components/ui/toaster.tsx`
  - `src/components/NoteManager.tsx`

#### 3. 移动端体验优化补充说明 ✅
- **移动端笔记编辑页（NoteManager）**：
  - 强化了编辑页滚动恢复逻辑，避免移动端软键盘弹出后频繁“跳顶”。
  - 列表视图中固定了搜索栏与顶部区域，保证滚动时导航与搜索始终可见。
- **移动端 Todo 管理**：
  - 修复了移动端浏览器中 Todo 视图“更多”按钮不弹出的问题，通过 `createPortal` 提升层级并避免被父容器裁剪。
  - 调整 Todo 详情、筛选、列表视图的栅格与间距，使其在手机上不再“挤在一起”，表单控件尺寸符合触控规范。
- **仪表盘导航与返回行为**：
  - Dashboard 顶部左侧 `S` 图标点击行为统一为“回到根文件夹列表，并清空当前搜索”。
  - 笔记编辑页左上角返回按钮行为恢复为“返回当前文件夹的笔记列表”，而不是跳转到根列表。
- **文件（节选）**：
  - `src/app/dashboard/page.tsx`
  - `src/components/NoteManager.tsx`
  - `src/components/TodoManager.tsx` 及 Todo 相关子组件（详情、筛选、列表等）

### 📚 文档更新

- ✅ 更新 `docs/changelog/CHANGELOG.md`（本文档），记录 Toast + 撤销能力与移动端体验优化。
- ✅ 更新 `docs/changelog/DOCUMENTATION_UPDATE.md`，补充本次文档同步项。
- ✅ 更新 `docs/弹窗替换进度.md`，增加 Toast + Undo 的设计与使用说明。
- ✅ 更新 `docs/productmanager/PRD_SUMU_NOTE.md` 与 `docs/productmanager/移动端编辑体验优化_PRD.md`，在产品层补充“关键操作支持 Toast + 撤销”的规格描述。

### 🔧 技术改进：笔记模块重构与类型收紧

- **补全逻辑解耦**：
  - 将 `[[ 链接 ]]` 与 `# 标签` 的检测/候选/键盘导航抽离为 `useLinkComplete` / `useTagComplete`。
  - 补全 UI 统一由 `NoteEditor` 渲染，`NoteManager` 不再维护补全细粒度状态。
- **错误语义统一（note-service）**：
  - `src/lib/note-service.ts` 统一抛出 `NoteServiceError`（含 `operation`），便于上层 Toast/重试/埋点。
- **类型安全提升**：
  - 笔记/文件夹相关 state 与事件回调由 `any` 收敛到 `Note` / `FolderItem`。
  - 拖拽事件类型与组件 props 对齐（`DragStartEvent`）。

---

## 2025-01-XX（历史）

### ✨ 新功能

#### 3. 云端冲突处理优化 ✅
- **简化交互流程**：
  - 移除了云端更新时的对话框选择（"查看最新版本" vs "保留我的更改"）
  - 改为自动处理：检测到云端更新时，自动保存本地更改到版本历史，然后加载云端最新版本
  - 显示非阻塞的 Toast 提示，告知用户操作结果

- **用户体验提升**：
  - 减少决策负担：无需每次手动选择
  - 数据安全：本地更改自动保存到版本历史，不会丢失
  - 符合主流产品设计：与 Apple Notes 等产品一致
  - 可恢复性：用户可在版本历史中找回本地更改

- **技术实现**：
  - 新增 `handleAutoSyncFromCloud` 函数，自动处理云端更新
  - 自动检测本地未保存的更改
  - 如有本地更改，先保存到版本历史，再加载云端版本
  - 使用 Toast 提示用户操作结果

- **文件**: `src/components/NoteManager.tsx`

### ✨ 新功能（历史）

#### 1. 只读页面优化 ✅
- **Markdown 渲染**：
  - 使用 `MarkdownRenderer` 组件渲染笔记内容
  - 支持完整的 Markdown 语法（标题、列表、链接、表格等）
  - 支持双向链接（Wiki-style `[[链接]]` 语法）
  - 自动转换为可点击的内部链接

- **内容可复制**：
  - 内容区域支持文本选择（`user-select: text`）
  - 用户可以选择和复制渲染后的内容
  - 支持跨浏览器兼容（Chrome、Safari、Firefox）

- **搜索高亮和定位**：
  - 从搜索结果进入时，自动高亮所有匹配的搜索词
  - 自动滚动到第一个匹配项，确保用户能看到相关内容
  - 支持 `Ctrl+G` / `Cmd+G` 跳转到下一个匹配项
  - 支持 `Ctrl+Shift+G` / `Cmd+Shift+G` 跳转到上一个匹配项
  - 支持 `F3` / `Shift+F3` 导航
  - 提供可视化导航按钮（上一个/下一个）
  - 当前匹配项使用蓝色边框高亮，其他匹配项使用黄色背景高亮

- **技术实现**：
  - 使用 `TreeWalker` API 遍历 DOM 文本节点
  - 使用 `Range` API 创建高亮标记
  - 智能跳过已高亮的节点，避免重复高亮
  - 支持跨节点的高亮处理
  - 使用 `requestAnimationFrame` 确保 DOM 更新完成后再滚动

- **文件**: `src/app/notes/[id]/page.tsx`, `src/components/MarkdownRenderer.tsx`

#### 2. 搜索功能优化 ✅
- **搜索结果导航**：
  - 点击搜索结果进入只读预览页面（方案A）
  - 只读页面显示搜索高亮和匹配项导航
  - 提供"编辑"按钮，可快速切换到编辑模式

- **文件**: `src/app/dashboard/page.tsx`, `src/app/notes/[id]/page.tsx`

### 🔧 技术改进

#### 代码质量
- ✅ 改进了搜索高亮的 DOM 操作逻辑
- ✅ 优化了自动定位的时机和方式
- ✅ 添加了跨浏览器兼容性支持
- ✅ 改进了错误处理和边界情况处理

#### 用户体验
- ✅ 只读页面内容可复制，提升了可用性
- ✅ 搜索高亮和自动定位提升了搜索体验
- ✅ 匹配项导航提供了便捷的浏览方式

---

## 2024-12-XX（历史）

### 🚀 性能优化

#### 1. 看板视图拖拽优化 ✅
- **问题**: 拖拽后需要刷新页面才能显示，体验不流畅
- **优化**:
  - 添加本地状态管理 `localTodos`，使用乐观更新
  - 拖拽后立即更新UI，无需等待服务器响应
  - 后台异步更新数据库，失败时回滚状态
  - 移除 `onRefresh()` 调用，避免页面刷新
- **效果**: 拖拽操作更加流畅自然，用户体验显著提升
- **文件**: `src/components/TodoKanban.tsx`

#### 2. 四象限视图拖拽优化 ✅
- **问题**: 
  - 多个象限间的拖拽失败
  - 成功的拖拽也会刷新页面，影响体验
- **优化**:
  - 改进拖拽目标识别逻辑，支持拖到象限和拖到象限内任务两种情况
  - 添加本地状态管理，使用乐观更新
  - 移除 `onRefresh()` 调用，避免页面刷新
  - 改进错误处理和状态回滚机制
- **效果**: 所有象限间的拖拽都能正常工作，且无需刷新页面
- **文件**: `src/components/TodoQuadrant.tsx`

#### 3. 列表视图拖拽排序优化 ✅
- **问题**: 拖拽排序后会触发自动刷新，影响体验
- **优化**:
  - 移除拖拽排序后的 `onRefresh()` 调用
  - 使用已有的 `localTodos` 本地状态管理，UI已通过乐观更新立即响应
  - 后台异步更新数据库，失败时回滚状态
- **效果**: 拖拽排序操作更加流畅，无需刷新页面
- **文件**: `src/components/TodoList.tsx`

### 🐛 Bug 修复

#### 1. 看板视图拖拽问题修复
- **问题**: 看板视图中，任务可以从一个区域拖拽到另一个区域，但拖拽之后无法拖回去
- **原因**: 拖拽处理逻辑只检查了直接拖到列上的情况，当拖到列内的任务上时，无法识别目标列
- **解决方案**: 
  - 改进 `handleDragEnd` 逻辑，支持识别拖到列内任务的情况
  - 当拖到列内的任务上时，通过查找目标任务所在的列来确定目标列
  - 将列 droppable id 改为 `col-*`，避免与任务 id 冲突
  - 碰撞检测优先使用指针命中（`pointerWithin`），减少“吸附到错误列/错误卡片”导致的误判
  - 确保所有拖拽操作都能正确更新任务状态
- **文件**: `src/components/TodoKanban.tsx`

#### 2. 四象限视图拖拽问题修复
- **问题**: 四象限视图中，无法拖拽到另一个象限，拖过去又自动跑回去
- **原因**: `manualAssignments` 状态在组件刷新后会丢失，导致任务回到原来的象限
- **解决方案**:
  - 添加本地状态 `localTodos` 来跟踪任务更新
  - 在拖拽时立即更新本地状态和手动分配
  - 使用 `useEffect` 同步外部更新，但保留手动分配
  - 添加乐观更新，提升用户体验
  - 失败时回滚状态
- **文件**: `src/components/TodoQuadrant.tsx`

#### 3. 日历视图上下文菜单错误修复
- **问题**: `Runtime ReferenceError: onContextMenu is not defined`
- **原因**: `DateCell` 组件的参数解构中缺少 `onContextMenu`
- **解决方案**: 在 `DateCell` 函数的参数列表中添加 `onContextMenu`
- **文件**: `src/components/TodoCalendar.tsx`

### ✨ 新功能

#### 1. 快速操作功能 ✅
- **1.1 快速完成/取消完成**
  - 在日历视图（月/周/日视图）的任务卡片上添加了悬停显示的完成按钮
  - 点击即可快速切换任务状态，无需打开详情页
  - 显示加载状态和完成状态图标

- **1.2 快速设置优先级**
  - 创建了 `TodoContextMenu` 组件，支持右键菜单
  - 在日历视图和列表视图中集成了上下文菜单
  - 支持快速操作：设置优先级、移动到清单、删除任务
  - 点击外部或按 ESC 键关闭菜单

- **1.3 快速添加子任务**
  - 在任务详情页的子任务输入框中集成了智能识别功能
  - 支持自动识别日期时间、标签、优先级
  - 输入框提示已更新，告知用户支持的智能识别功能

#### 2. 视图增强功能 ✅
- **2.1 时间线视图**
  - 创建了 `TodoTimeline` 组件
  - 支持日/周/月三种视图模式
  - 以时间轴形式展示任务，清晰显示时间关系
  - 显示任务时间、优先级、标签等信息

- **2.2 甘特图视图**
  - 创建了 `TodoGantt` 组件
  - 以甘特图形式展示任务，适合项目管理
  - 支持周视图，显示一周内的任务
  - 任务以条形图形式显示在对应日期
  - 支持任务优先级颜色标识

- **2.3 看板视图增强**
  - 支持自定义列：可以添加自定义列（默认列：待办/进行中/已完成）
  - 支持泳道分组：按清单、按标签、按优先级分组
  - 支持卡片颜色自定义：根据优先级自动设置卡片颜色
  - 添加了设置面板，方便管理自定义列

### 📚 文档更新

- ✅ 更新 `docs/TODO_FEATURE_SUGGESTIONS.md`，标记已完成功能
- ✅ 更新 `docs/CHANGELOG.md`，记录最新更新和修复

### 🔧 技术改进

#### 代码质量
- ✅ 修复了拖拽逻辑中的边界情况处理
- ✅ 改进了状态管理，使用乐观更新提升用户体验
- ✅ 添加了错误回滚机制

#### 用户体验
- ✅ 拖拽操作更加流畅和可靠
- ✅ 快速操作功能提升了任务管理效率
- ✅ 新增的视图提供了更多任务展示方式

---

## 2024-12-XX（历史）

### 🐛 Bug 修复

#### 1. findNodeInTree 初始化错误修复
- **问题**: `Runtime ReferenceError: Cannot access 'findNodeInTree' before initialization`
- **原因**: `findNodeInTree` 使用 `useCallback` 递归调用自己，导致初始化顺序问题
- **解决方案**: 将 `findNodeInTree` 移到组件外部作为普通函数
- **影响**: 修复了所有使用 `findNodeInTree` 的函数（共19处）
- **文件**: `src/components/MindNoteEditor.tsx`

#### 2. buildNodeTree 根节点排序问题修复
- **问题**: `buildNodeTree` 函数只对子节点排序，未对根节点排序
- **解决方案**: 在返回前对 `rootNodes` 数组按 `order_index` 排序
- **文件**: `src/lib/mind-note-utils.ts`

#### 3. 版本管理功能误判问题修复
- **问题**: 
  - 单设备编辑时误判为其他设备更新
  - 频繁弹出"云端有更新"提示，严重影响用户体验
- **原因**: 
  - 实时订阅会收到自己触发的更新事件
  - 缺少机制区分自己的更新和其他设备的更新
  - 时间戳比较不够精确
- **解决方案**:
  - 添加 `isSavingRef` 保存状态标记
  - 添加 `lastSaveTimeRef` 记录保存时间戳
  - 在保存期间（2秒内）忽略实时订阅事件
  - 使用时间窗口（2秒）判断是否为其他设备的更新
- **文件**: `src/components/NoteManager.tsx`
- **详细文档**: `docs/VERSION_MANAGEMENT_BUG_FIX.md`

### ✨ 功能改进

#### 1. 撤销/重做功能
- ✅ 实现了完整的撤销/重做功能
- ✅ 支持撤销/重做节点操作（创建、删除、更新、移动）
- ✅ 支持撤销/重做标题更新
- ✅ 快捷键支持：Ctrl+Z / Cmd+Z（撤销），Ctrl+Y / Cmd+Y（重做）
- **文件**: `src/components/MindNoteEditor.tsx`, `src/hooks/useUndoRedo.ts`, `src/lib/undo-redo-executor.ts`

#### 2. 工具函数优化
- ✅ 将 `findNodeInTree` 移到组件外部，提高可测试性和性能
- ✅ 所有工具函数都移到组件外部，避免重复创建

### 🧪 测试覆盖

#### 新增测试
- ✅ **mind-note-utils.test.ts**: 21个单元测试，全部通过
  - 覆盖所有核心工具函数
  - 包括边界情况和错误处理
- ✅ **MindNoteEditor.test.tsx**: 组件测试框架（当前有内存问题，待优化）

#### 测试统计
- **总测试数**: 34个（排除 MindNoteEditor.test.tsx）
- **通过率**: 100%
- **测试文件**: 5个

### 📚 文档更新

#### 新增文档
- ✅ `docs/CODE_REVIEW_REPORT.md`: 代码审查报告
- ✅ `docs/VERSION_MANAGEMENT_BUG_FIX.md`: 版本管理功能 Bug 修复文档
- ✅ `docs/CHANGELOG.md`: 更新日志（本文档）

#### 更新文档
- ✅ `docs/MIND_NOTE_REQUIREMENTS.md`: 更新功能状态和已知问题
- ✅ `docs/CODE_REVIEW_CHECKLIST.md`: 更新审查记录和测试覆盖情况

### 🔧 技术改进

#### 代码质量
- ✅ 所有函数都有明确的类型定义
- ✅ 通过 TypeScript 编译检查
- ✅ 通过 ESLint 检查
- ✅ 无循环依赖

#### 性能优化
- ✅ 使用 `useCallback` 避免不必要的重渲染
- ✅ 工具函数移到组件外部，避免重复创建
- ✅ 乐观更新减少 API 调用
- ✅ 防抖保存减少频繁请求

#### 错误处理
- ✅ 所有异步操作都有 try-catch
- ✅ 错误时显示用户友好的提示
- ✅ 失败时回滚到之前状态

### 📊 代码统计

#### 修改的文件
1. `src/components/MindNoteEditor.tsx`
   - 修复 `findNodeInTree` 初始化问题
   - 移除所有依赖数组中的 `findNodeInTree` 引用
   - 代码行数: ~1530 行

2. `src/lib/mind-note-utils.ts`
   - 修复 `buildNodeTree` 根节点排序问题
   - 代码行数: ~519 行

3. `src/components/NoteManager.tsx`
   - 修复版本管理功能误判问题
   - 添加保存状态标记机制
   - 改进实时订阅事件处理逻辑

#### 新增的文件
1. `tests/lib/mind-note-utils.test.ts`
   - 21 个单元测试用例
   - 代码行数: ~350 行

2. `tests/components/MindNoteEditor.test.tsx`
   - 组件测试框架
   - 代码行数: ~180 行（当前有内存问题）

3. `docs/CODE_REVIEW_REPORT.md`
   - 代码审查报告

4. `docs/VERSION_MANAGEMENT_BUG_FIX.md`
   - 版本管理功能 Bug 修复文档

5. `docs/CHANGELOG.md`
   - 更新日志（本文档）

### ⚠️ 已知问题

1. **MindNoteEditor 组件测试内存问题**
   - 问题: 测试时出现 JavaScript heap out of memory
   - 状态: 待优化
   - 影响: 不影响功能，仅影响测试

### 🎯 下一步计划

1. **测试优化**
   - 优化 MindNoteEditor 组件测试，解决内存问题
   - 增加更多集成测试和 E2E 测试

2. **功能完善**
   - 实现 TODO 项中的功能（撤销/重做的数据库同步等）
   - 完善错误提示和加载状态

3. **性能优化**
   - 实现虚拟滚动（大量节点时）
   - 性能监控和优化

---

**最后更新**: 2024-12-XX  
**维护者**: AI Assistant












