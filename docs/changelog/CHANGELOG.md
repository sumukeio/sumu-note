# 更新日志

本文档记录项目的重要更新和修复。

## 2026-02-XX（最新）

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












