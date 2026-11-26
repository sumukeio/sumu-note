# Change — 完整侧拖放 + iOS 分流收窄

> **状态**：[权威/现行]  
> **阶段**：phase-fulltrack-drag-capability-20261126  
> 按时间倒序追加。

## 2026-11-26 — task002/task003 拖入子文件夹 + 删除热区

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Add | `wouldCreateFolderCycle` in `folder-utils.ts` + 单测 | 循环引用纯函数 |
| Modify | `FolderManager.tsx` | 改用共享 `wouldCreateFolderCycle` |
| Modify | `NoteList.tsx` | 子文件夹可拖可放；拖动中仅删除热区；touch 转发 dnd |
| Modify | `NoteManager.tsx` | `handleDropOntoFolder`；`handleDragEnd` 处理 `folder-*`；删除接受 idSet |
| Modify | `docs/changelog/CHANGELOG.md` | 追加 task002/003 |
| Modify | `.phrase/docs/CHANGE.md` | 索引 |

**验证**：`folder-utils` + `client-capability` 共 21 passed；`npm run type-check` 通过。

## 2026-11-26 — task001 收窄轻量分流

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Modify | `src/lib/client-capability.ts` | `parseIOSMajorVersion`；仅 iOS≤16 的 iPhone/iPod 轻量 |
| Modify | `tests/lib/client-capability.test.ts` | iOS16/18/17、解析失败、iPad/Android/桌面 |
| Modify | `docs/guides/IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md` | 能力探测与手测清单 |
| Modify | `docs/changelog/CHANGELOG.md` | 追加 task001 |
| Modify | `.phrase/docs/CHANGE.md` | 索引 |

**验证**：`npm test -- --run tests/lib/client-capability.test.ts` → 12 passed。

## 2026-11-26 — phase 开启

| 动作 | 路径 | 说明 |
| :--- | :--- | :--- |
| Add | `spec/plan/task/change_fulltrack-drag-capability_20261126.md` | 阶段最小集 |
| Modify | `.phrase/docs/CHANGE.md` | 当前进行阶段指向本 phase |
