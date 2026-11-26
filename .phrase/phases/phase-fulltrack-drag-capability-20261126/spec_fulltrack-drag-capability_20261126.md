# Spec — 完整侧拖放 + iOS 分流收窄

> **状态**：[权威/现行]  
> **阶段**：phase-fulltrack-drag-capability-20261126  
> **日期**：2026-11-26

## Summary

收窄 iPhone 轻量双轨判定（仅旧系统走轻量），并在**完整侧**落地长按拖入当前可见子文件夹与拖动删除热区。轻量侧（旧机降级）不加拖拽。

## Goals

- 双轨：`iPhone|iPod` 且 iOS major ≤ 16 → 轻量；iOS ≥ 17（含 iPhone 12 + iOS 18）→ 完整。
- 完整侧：拖入当前列表可见子文件夹；拖动中仅露删除热区。
- 文档与回归测试闭环。

## Non-goals

- 轻量侧 `LightFolderNotes` 任何拖拽。
- 拖到 Dock 做置顶/复制/打开移动弹窗（点击保留）。
- 跨层级树形拖放、根目录文件夹网格大改。
- 结项归档旧 bug-triage 阶段。

## User Flows

| 操作 | 反馈 | 回退 |
| :--- | :--- | :--- |
| iPhone12（iOS18）进文件夹 | 加载完整 `NoteManager` | 旧机 iOS≤16 仍轻量 |
| 长按拖到同页子文件夹 | Toast 成功/失败；退出选中 | 失败不静默；可改用移动弹窗 |
| 拖动中松手在删除热区 | 走现有删除/回收站语义 | 松手空白不删 |

## Edge Cases

- UA 无法识别机型：以 iOS major 代理；解析失败 → 保守轻量。
- 文件夹拖入自身或造成循环引用 → 拒绝并 Toast。
- 跨当前列表外目标 → 仍用「移动」弹窗。

## Acceptance Criteria

- [x] `shouldUseLightFolderNotes` 单测覆盖 iOS16 轻量 / iOS18 完整 / iPad·Android·桌面完整。
- [x] 完整侧可拖入当前可见子文件夹并有 Toast（代码 + 纯函数单测；真机手测待确认）。
- [x] 拖动中仅删除热区可见；非拖动多选 Dock 点击逻辑保留（代码落地；真机手测待确认）。
- [x] 每 task 勾选 + change + CHANGELOG。
