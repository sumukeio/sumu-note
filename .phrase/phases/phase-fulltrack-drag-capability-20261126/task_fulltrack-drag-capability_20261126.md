# Tasks — 完整侧拖放 + iOS 分流收窄

> **状态**：[权威/现行]  
> **阶段**：phase-fulltrack-drag-capability-20261126

- [x] **task001** 产出：收窄 `shouldUseLightFolderNotes`——仅 iPhone/iPod 且 iOS major ≤ 16 走轻量；导出 `parseIOSMajorVersion`；更新单测与 `IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md`；CHANGELOG + change。  
  **验证**：`npm test -- --run tests/lib/client-capability.test.ts` → 12 passed。  
  **影响范围**：`src/lib/client-capability.ts`、`tests/lib/client-capability.test.ts`、双轨指南、`.phrase/`、CHANGELOG。

- [x] **task002** 产出：完整侧子文件夹 `useDroppable`/`useDraggable`；`handleDragEnd` 移入 `folder-*`（笔记 + 子文件夹、循环引用校验、Toast、退出选中）；`wouldCreateFolderCycle` + vitest。  
  **验证**：`folder-utils` 9 passed；`type-check` 通过。  
  **影响范围**：`NoteList.tsx`、`NoteManager.tsx`、`folder-utils.ts`、`FolderManager.tsx`、测试与文档。

- [x] **task003** 产出：拖动中（`activeId`）隐藏完整 Dock，仅底部 `dock-delete` 热区；松手走现有 `handleDelete`；非拖动 Dock 点击不变；touch 不 `preventDefault` 并转发 dnd listeners。  
  **验证**：`type-check` 通过；与 task002 同测。  
  **影响范围**：`NoteList.tsx`、`NoteManager.tsx`、文档。
