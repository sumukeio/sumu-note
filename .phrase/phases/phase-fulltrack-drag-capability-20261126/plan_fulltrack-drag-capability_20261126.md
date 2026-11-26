# Plan — 完整侧拖放 + iOS 分流收窄

> **状态**：[权威/现行]  
> **阶段**：phase-fulltrack-drag-capability-20261126  
> **日期**：2026-11-26

## Milestones

1. **task001** 收窄轻量分流（先修 iPhone12 误入轻量）。
2. **task002** 完整侧拖入当前可见子文件夹。
3. **task003** 拖动时仅露删除热区。

## Scope

- 改：`src/lib/client-capability.ts`、完整侧 `NoteList` / `NoteManager`、双轨指南、测试与 CHANGELOG。
- 不改：`LightFolderNotes` 拖拽能力。

## Priorities

1. 分流收窄（用户现网痛点）  
2. 拖入文件夹  
3. 删除热区  

## Risks & Dependencies

| 风险 | 缓解 |
| :--- | :--- |
| 现代 iPhone 加载 NoteManager 超时 | 沿用现有 import 超时/返回；本 phase 不拆包 |
| 长按多选与 dnd-kit 手势冲突 | task003 仅最小修复 preventDefault/listeners |
| 文件夹循环引用 | 抽纯函数 + vitest |

## Rollback

- 分流：恢复「凡 iPhone 皆轻量」一行规则。
- 拖放：回退 `NoteList`/`NoteManager` 拖放改动；移动弹窗仍可用。
