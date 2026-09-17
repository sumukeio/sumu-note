# Change Log — phase-bug-triage-mindnote-sunset-20260916

> **状态**：[权威/现行]  
> 按时间倒序追加。

## 2026-09-17 — task015 issue002 续修：禁止首页自动跳转

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Modify | `page.tsx` | 去掉 getSession 自动进 dashboard；改为「进入工作台」 |
| Modify | `dashboard/page.tsx` | 鉴权后懒加载 Home；15s 超时+回首页 |
| Modify | `AuthLoadingScreen.tsx` | 验证中也可回首页 |
| Modify | `DashboardHomeClient.tsx` | NoteManager dynamic，减轻首包 |

**验证**：type-check 通过。

## 2026-09-17 — task014 issue002 续修：去掉「正在加载工作台」卡死

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Modify | `dashboard/page.tsx` | 静态渲染 Home；去掉 dynamic/外包 Suspense |
| Modify | `DashboardHomeClient.tsx` | 不用 `useSearchParams`；挂载打点 `dashboard-home:mount` |
| Modify | `page.tsx` | 已登录自动进工作台改为 `location.replace` |

**日志证据**：`dashboard:auth-ok` 后无 `dashboard-home:mount`，UI 停在 dynamic/Suspense fallback。  
**验证**：type-check 通过。

## 2026-09-17 — task013 issue002 续修：鉴权移出 Suspense

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Add | `DashboardHomeClient.tsx` | 原 dashboard 主界面（含 useSearchParams） |
| Modify | `dashboard/page.tsx` | 轻量 AuthGate；dynamic 加载主界面 |
| Modify | `layout.tsx` | `html-boot` 内联信标 + AuthBootBeacon |
| Modify | `auth-login-handoff.ts` | 跳转目标固定 `/dashboard`（debug 靠 localStorage） |

**日志证据**：hard-nav 后无 `requireAuth:*` → Suspense 内鉴权未执行。  
**验证**：handoff 测试 + type-check 通过。

## 2026-09-17 — task012 issue002 续修：硬跳 + 根级调试条

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Modify | `auth-login-handoff.ts` | handoff 双写；调试日志改 localStorage；debug 开关持久化 |
| Modify | `useRequireAuth.tsx` | handoff/storage 优先放行；首挂一次；后台校验 |
| Modify | `AuthModal.tsx` | 登录成功后 `location.assign` 硬跳（弃软跳） |
| Modify | `layout.tsx` | 根布局常驻 `AuthDebugPanel` |
| Modify | `dashboard/page.tsx` / `page.tsx` | 去掉重复调试挂载 |

**现象**：白屏转圈；仅首页 `?debugAuth=1` 有绿条。  
**验证**：auth-login-handoff 4 + auth-session-resilience 6；type-check 通过。

## 2026-09-17 — task011 修复 issue002 iOS 登录后进不去

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Add | `auth-session-resilience.ts` + 测试 | `withRetries` / 硬跳转判定 |
| Modify | `auth-utils.ts` | `getSession` 短重试；拉长 ensureSession |
| Modify | `useRequireAuth.ts` | 未登录结束 loading；回流 `/?auth=required` |
| Modify | `AuthModal.tsx` | 成功 Toast；localStorage 时硬跳 `/dashboard` |
| Modify | `page.tsx` | `auth=required` 提示并打开登录 |
| Modify | `supabase.ts` | 暴露 `getAuthStorageMode` |

**环境**：iPhone 8 Plus · iOS 16.3.1 · 多浏览器同现 · 首页/登录可进 · 登录后静默进不去。  
**续修**：登录成功后曾白屏转圈 → `getSession` 加超时、storage 降级、鉴权 10s 总闸；改回软跳转。  
**验证**：auth-session-resilience 6 passed；type-check 通过。  
**手测**：该机登录应进入工作台；最多约 10s 应出现超时重试而非永久转圈。

## 2026-09-17 — task010 修复 issue001 Toast 挡标题 / 新建页态

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Modify | `src/components/ui/toast.tsx` | Viewport 全端贴底；入场动画自底部 |
| Add | `mobile-editor-entry.ts` + 测试 | 空白笔记 → 不进阅读态 |
| Modify | `NoteEditor.tsx` | 按笔记内容决定移动端入口态 |
| Modify | `NoteManager.tsx` | 新建 Toast 文案微调 |

**验证**：mobile-editor-entry 2 passed；type-check 通过。  
**手测**：手机新建 → 直接可编标题；Toast 在底部不挡顶栏。

## 2026-09-17 — task009 修复 issue007 编辑页统计实时

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Add | `src/lib/note-word-stats.ts` + `tests/lib/note-word-stats.test.ts` | `computeNoteWordStats` 纯函数 |
| Modify | `NoteManager.tsx` | 打开笔记用纯函数；编辑态 content debounce 200ms 刷新 wordStats |
| Modify | `note-word-stats.ts` | 产品确认：字数 = **非空白字符数**（含中英数字标点） |

**验证**：note-word-stats 4 passed；type-check 通过。  
**手测**：编辑正文，约 0.2s 内字数/段落/阅读时间更新；输入 `abc`/`123` 计入字数。

## 2026-09-17 — task008 修复 issue008 编辑态链接防误触

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Add | `src/lib/editor-link-gesture.ts` + `tests/lib/editor-link-gesture.test.ts` | token 识别 + 单击是否应打开 |
| Modify | `SegmentedEditor.tsx` | 编辑态：普通单击不弹窗；Cmd/Ctrl+点击或长按/右键才确认打开 |

**验证**：editor-link-gesture 6 passed；type-check 通过。  
**手测**：编辑态点 URL 不弹窗；Ctrl/Cmd+点或长按弹出确认；预览态链接仍可单击。

## 2026-09-17 — task007 修复 issue004 自动标题上限 10

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Add | `src/lib/note-title.ts` | `AUTO_TITLE_MAX_LENGTH=10`；`deriveAutoTitleFromContent` |
| Add | `tests/lib/note-title.test.ts` | 空/Markdown/截断/自定义上限 |
| Modify | `src/hooks/useNoteSave.ts` | 空标题保存改用纯函数（原 `slice(0,30)`） |

**验证**：note-title 6 passed；type-check 通过。

## 2026-09-17 — task006 修复 issue009 移动无反应

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Add | `src/lib/ui-event-guards.ts` + `tests/lib/ui-event-guards.test.ts` | Dialog/Dock/Portal 点击不应清多选 |
| Modify | `NoteList.tsx` / `FolderManager.tsx` | 捕获阶段空白取消选中忽略浮层；弹窗打开时隐藏 Dock |
| Modify | `FolderManager.tsx` | 统一 `MoveToFolderDialog`；排除后代；快照待移动 id |
| Modify | `NoteManager.tsx` | **打开弹窗时快照 `pendingMove`**；去掉 `fetchNotes` finally 清选中；「正在移动…」Toast |
| Modify | `MoveToFolderDialog.tsx` | 支持 async `onSelect`；busy 锁定；由父组件关窗 |
| Modify | `src/components/ui/dialog.tsx` | overlay/content `z-[60]`，高于 selection dock `z-50` |

**根因**：① 捕获空白点击清选中；② `fetchNotes` finally 清空 `selectedIds`，弹窗确认时读空且曾静默。  
**验证**：ui-event-guards 3 passed；type-check 通过。  
**手测**：单选笔记 → 移动 → 选目标 →「正在移动…」→「移动成功」。

## 2026-09-17 — task005 修复 issue003 最近打开云端/点击

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Add | `docs/sql/create_user_recent_notes.sql` | 云端表 + RLS |
| Modify | `src/lib/recent-notes.ts` | 合并/同步/本地缓存；纯函数可测 |
| Add | `tests/lib/recent-notes.test.ts` | merge/upsert 回归 |
| Modify | `dashboard/page.tsx` | `openNoteById` 状态直开；同步云端列表 |
| Modify | `NoteManager.tsx` | `onInitialNoteOpened`；folder 过期时按 id 回退加载 |

**验证**：recent-notes 3 passed；type-check 通过。  
**运维**：需执行 `create_user_recent_notes.sql`，否则降级为仅本地。

## 2026-09-17 — task004 修复 issue006 统计仪表盘

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Modify | `src/lib/stats.ts` | 单次 fetch + `buildDashboardStats` 纯函数；热力图按日期键比较 |
| Modify | `src/app/dashboard/stats/page.tsx` | 饼图客户端挂载；失败态+重试 |
| Add | `tests/lib/stats.test.ts` | 空数据/汇总/分布/热力/最近 回归 |

**验证**：stats 6 passed；type-check 通过。

## 2026-09-17 — task003 修复 issue005 发布公开页

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Add | `adr_publish-public-page_20260917.md` | 公开 URL=`/p/:id`；RLS 只读已发布 |
| Add | `docs/sql/allow_select_published_notes.sql` | 需在 Supabase 执行 |
| Add | `src/app/p/[id]/page.tsx` | 公开阅读页 |
| Add | `src/lib/note-publish.ts` + `tests/lib/note-publish.test.ts` | 可读性契约 |
| Modify | `note-service.ts` | `getPublishedNoteById` |
| Modify | `useNoteSave.ts` / `NoteManager` / `NoteEditor` | save 返回 boolean；发布失败回滚+Toast |

**验证**：note-publish 4 passed；type-check 通过。  
**运维**：未执行 SQL 前匿名访客可能仍无法读取。

## 2026-09-17 — task002 修复 issue010 删文件夹 FK

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Add | `src/lib/folder-service.ts` | `deleteFoldersCascade`：叶子优先进删 + 可选软删笔记 |
| Modify | `src/lib/folder-utils.ts` | `expandFolderIdsWithDescendants` / `orderFolderIdsLeafFirst` / `resolveFolderIdsForDelete` |
| Add | `tests/lib/folder-utils.test.ts` | 防退化：子先于父 |
| Modify | `NoteManager.tsx` / `FolderManager.tsx` | 删除与合并移动走级联删除 |
| Modify | `ISSUES.md` / `issue_triage` / `task_*` | issue010 勾选；task002 完成 |

**验证**：`vitest tests/lib/folder-utils.test.ts` 5/5；`tsc --noEmit` 通过。  
**行为**：删含有子文件夹的文件夹不再报 `folders_parent_id_fkey`；子树笔记进回收站；Toast 汇报数量；撤销可还原文件夹树与笔记。

## 2026-09-16 — 产品拍板落盘（无代码）

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Add | `adr_product-decisions_recents-title-link_20260916.md` | 最近打开云端全局；标题上限 10；链接防误触手势同意 |
| Modify | `plan_*.md`、`.phrase/docs/ISSUES.md` | 标记 issue003/004/008 已拍板；首页改版记为待讨论 |

**行为/风险**：无运行时变化。明日优先按次序开修（建议自 issue010 起）。

## 2026-09-16 — task001 分诊登记 + 思维笔记下线 ADR

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Add | `spec/plan/task/change/adr/issue_triage_*.md`（本阶段） | 短 phase 最小集 + 分诊 + ADR |
| Modify | `.phrase/docs/ISSUES.md` | 登记 issue001–010；移除未结构化草稿（原文归档进 issue_triage） |
| Modify | `.phrase/docs/CHANGE.md` | 当前阶段切换至本 phase |
| Modify | `docs/changelog/CHANGELOG.md` | 追加本条 |
| Modify | 思维笔记相关 docs 文首状态（计划下线） | 优雅标识，不硬删 |

**行为/风险**：无运行时行为变化。
