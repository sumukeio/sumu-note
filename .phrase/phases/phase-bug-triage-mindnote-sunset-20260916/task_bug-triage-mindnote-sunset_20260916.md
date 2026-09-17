# Tasks — Bug 分诊 + 思维笔记计划下线

> **状态**：[权威/现行]

- [x] **task001** 产出：正式登记 `issue001`–`issue010`；撰写分诊详情与优先级表；撰写 ADR「思维笔记计划下线」；更新 `.phrase/docs/ISSUES.md` 与 `CHANGE.md`；CHANGELOG 追加；草稿迁入详情归档。  
  **验证**：索引表 10 条齐全；ADR 存在；`git` 无 `src/` 业务改动（本任务仅文档）。  
  **影响范围**：仅 `.phrase/`、`docs/changelog`、相关文档状态说明。

- [x] **task002** 产出：修复 issue010 删除文件夹 `folders_parent_id_fkey`——叶子优先级联删除 + 子树笔记进回收站；`folder-utils`/`folder-service` + 回归测试；接入 `NoteManager`/`FolderManager`。  
  **验证**：`npm test -- --run tests/lib/folder-utils.test.ts` 通过；`npm run type-check` 通过。  
  **影响范围**：`src/lib/folder-utils.ts`、`src/lib/folder-service.ts`、`NoteManager.tsx`、`FolderManager.tsx`、`tests/lib/folder-utils.test.ts`、文档闭环。

- [x] **task003** 产出：修复 issue005 发布失败——`/p/[id]` 公开页、`getPublishedNoteById`、可读性测试；ADR + RLS SQL；发布失败回滚 UI 并 Toast。  
  **验证**：`npm test -- --run tests/lib/note-publish.test.ts` 通过；`npm run type-check` 通过。  
  **影响范围**：`src/app/p/[id]/page.tsx`、`note-publish.ts`、`note-service.ts`、`useNoteSave.ts`、`NoteManager.tsx`、`NoteEditor.tsx`、`docs/sql/allow_select_published_notes.sql`。

- [x] **task004** 产出：修复 issue006 统计仪表盘——单次拉取 `buildDashboardStats`；Recharts 客户端挂载；失败可见+重试；纯函数回归测试。  
  **验证**：`npm test -- --run tests/lib/stats.test.ts` 通过；`npm run type-check` 通过。  
  **影响范围**：`src/lib/stats.ts`、`src/app/dashboard/stats/page.tsx`、`tests/lib/stats.test.ts`。

- [x] **task005** 产出：修复 issue003 最近打开——云端表 `user_recent_notes` + 本地合并；点击状态直开 `openNoteById`；失败 Toast；SQL 脚本。  
  **验证**：`npm test -- --run tests/lib/recent-notes.test.ts` 通过；`npm run type-check` 通过。  
  **影响范围**：`recent-notes.ts`、`dashboard/page.tsx`、`NoteManager.tsx`、`docs/sql/create_user_recent_notes.sql`。

- [x] **task006** 产出：修复 issue009 移动无反应——选中态空白点击忽略 Dialog Portal；`FolderManager` 统一 `MoveToFolderDialog`；空选中/失败可见 Toast；Dialog `z-[60]` 高于 Dock。  
  **验证**：`npm test -- --run tests/lib/ui-event-guards.test.ts` 通过；`npm run type-check` 通过。  
  **影响范围**：`ui-event-guards.ts`、`NoteList.tsx`、`FolderManager.tsx`、`NoteManager.tsx`、`dialog.tsx`。

- [x] **task007** 产出：修复 issue004 自动标题上限——`deriveAutoTitleFromContent` 上限 10；`useNoteSave` 接入；回归测试。  
  **验证**：`npm test -- --run tests/lib/note-title.test.ts` 通过；`npm run type-check` 通过。  
  **影响范围**：`src/lib/note-title.ts`、`useNoteSave.ts`、`tests/lib/note-title.test.ts`。

- [x] **task008** 产出：修复 issue008 编辑态链接防误触——桌面 Cmd/Ctrl+点击、触摸单击不打开、长按/右键确认；预览态保持单击；手势纯函数 + 回归测试。  
  **验证**：`npm test -- --run tests/lib/editor-link-gesture.test.ts` 通过；`npm run type-check` 通过。  
  **影响范围**：`editor-link-gesture.ts`、`SegmentedEditor.tsx`、`tests/lib/editor-link-gesture.test.ts`。

- [x] **task009** 产出：修复 issue007 编辑页统计非实时——抽出 `computeNoteWordStats`；编辑态 `content` 变更 debounce 200ms 刷新；回归测试。  
  **验证**：`npm test -- --run tests/lib/note-word-stats.test.ts` 通过；`npm run type-check` 通过。  
  **影响范围**：`note-word-stats.ts`、`NoteManager.tsx`、`tests/lib/note-word-stats.test.ts`。

- [x] **task010** 产出：修复 issue001——Toast 全端贴底不挡标题；空白新建手机直进编辑态（`shouldStartInMobileReadingMode`）；回归测试。  
  **验证**：`npm test -- --run tests/lib/mobile-editor-entry.test.ts` 通过；`npm run type-check` 通过。  
  **影响范围**：`toast.tsx`、`mobile-editor-entry.ts`、`NoteEditor.tsx`、`NoteManager.tsx`。

- [x] **task011** 产出：修复 issue002 iOS 登录后进不去——`getSession` 短重试；登录成功硬跳转 dashboard；未登录可见回流提示；内存存储告警。  
  **验证**：`npm test -- --run tests/lib/auth-session-resilience.test.ts` 通过；`npm run type-check` 通过。  
  **影响范围**：`auth-utils.ts`、`auth-session-resilience.ts`、`useRequireAuth.ts`、`AuthModal.tsx`、`page.tsx`、`supabase.ts`。

- [x] **task012** 产出：issue002 续修——登录硬跳；handoff/storage 优先放行；根 layout 常驻 AuthDebugPanel；调试日志 localStorage。  
  **验证**：`npm test -- --run tests/lib/auth-login-handoff.test.ts tests/lib/auth-session-resilience.test.ts` 通过；`npm run type-check` 通过。  
  **影响范围**：`auth-login-handoff.ts`、`useRequireAuth.tsx`、`AuthModal.tsx`、`layout.tsx`、`AuthDebugPanel.tsx`。

- [x] **task013** 产出：issue002 续修——鉴权移出 Suspense；`DashboardHomeClient` 动态加载；html-boot 信标。  
  **验证**：`npm test -- --run tests/lib/auth-login-handoff.test.ts` 通过；`npm run type-check` 通过。  
  **影响范围**：`dashboard/page.tsx`、`DashboardHomeClient.tsx`、`layout.tsx`、`AuthBootBeacon.tsx`。

- [x] **task014** 产出：issue002 续修——去掉 dynamic+Suspense；URL 深链改读 location.search；首页硬跳防循环。  
  **验证**：`npm run type-check` 通过。  
  **影响范围**：`dashboard/page.tsx`、`DashboardHomeClient.tsx`、`page.tsx`。

- [x] **task015** 产出：issue002 续修——取消首页自动跳转；加载超时/回首页；轻量鉴权包 + 懒加载工作台。  
  **验证**：`npm run type-check` 通过。  
  **影响范围**：`page.tsx`、`dashboard/page.tsx`、`AuthLoadingScreen.tsx`、`DashboardHomeClient.tsx`。

- [x] **task016** 产出：issue002 续修——进文件夹懒加载超时；笔记拉取超时；清空调试日志。  
  **验证**：`npm run type-check` 通过。  
  **影响范围**：`NoteFolderLazy.tsx`、`NoteManager.tsx`、`DashboardHomeClient.tsx`、`AuthDebugPanel.tsx`。

- [x] **task017** 产出：issue002 续修——`LightFolderNotes` 替代 NoteManager 动态加载（iOS import 挂死）。  
  **验证**：`npm run type-check` 通过。  
  **影响范围**：`LightFolderNotes.tsx`、`DashboardHomeClient.tsx`。

- [x] **task018** 产出：双轨——iPhone/iPod 增强轻量；安卓/PC/iPad 完整 NoteManager；能力探测单测。  
  **验证**：`tests/lib/client-capability.test.ts` 通过；`npm run type-check` 通过。  
  **影响范围**：`client-capability.ts`、`LightFolderNotes.tsx`、`DashboardHomeClient.tsx`、`NoteFolderLazy.tsx`。

- [x] **task019** 产出：轻量侧补齐——Dock 可见、子文件夹多选、新建文件夹、文件夹移动/删除。  
  **验证**：`npm run type-check` 通过。  
  **影响范围**：`LightFolderNotes.tsx`。

- [x] **task020** 产出：多选顶栏不挤字、Toast 不被挡、debugAuth 默认关且不能绕过登录、chrome `select-none`。  
  **验证**：`tests/lib/auth-login-handoff.test.ts` + `client-capability` 通过；`npm run type-check` 通过。  
  **影响范围**：`LightFolderNotes.tsx`、`toast.tsx`、`auth-login-handoff.ts`、`AuthDebugPanel.tsx`、`DashboardHomeClient.tsx`、`NoteList.tsx`、`page.tsx`。

- [x] **task021** 产出：关闭 issue002；结案说明与近期修复落盘（指南 / ISSUES / triage / CHANGELOG）。  
  **验证**：文档交叉链接可跳转；issue002 索引与分诊均为 `[x]`。  
  **影响范围**：`.phrase/docs/*`、`issue_triage_*`、`docs/guides/IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md`、`docs/changelog/CHANGELOG.md`、`MOBILE_TESTING.md`、`docs/README.md`。

- [x] **task022** 产出：砍掉首页「进入工作台」；已登录访问 `/` 硬跳 `/dashboard`。  
  **验证**：`npm run type-check` 通过。  
  **影响范围**：`src/app/page.tsx`、结案指南、MOBILE_TESTING、CHANGELOG。

## 未开启（待人类确认下一 task）

- 下一建议：**思维笔记下线实施**（另开 phase，产品已 ADR）。  
- **不要默认开**「NoteManager 拆包 / 轻量功能增量」——动机与受众见结案指南「可选后续」；无痛点/无指标则搁置。  
- **运维提醒**：
  - `docs/sql/allow_select_published_notes.sql`（公开页）
  - `docs/sql/create_user_recent_notes.sql`（最近打开云端）
