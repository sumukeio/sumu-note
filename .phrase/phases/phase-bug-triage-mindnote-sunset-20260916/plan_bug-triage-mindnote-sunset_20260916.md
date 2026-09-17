# Plan — Bug 分诊 + 思维笔记计划下线

> **状态**：[权威/现行]

## Milestones

1. **M1（本 phase / task001）**：分诊登记 + ADR + 优先级表（无代码）。
2. **M2（后续，需人类确认另开 phase 或本 phase 增补 task）**：按 P0→P1 逐 issue 修复，每 issue 至少一 task，修完刹车。
3. **M3（更后）**：思维笔记下线实施 phase（隐藏入口 → 数据保留策略 → 可选 schema 清理）。

## 建议修复顺序（登记结论，尚未开修）

| 次序 | Issue | 级别 | 簇 |
| :--- | :--- | :--- | :--- |
| 1 | issue010 删文件夹 FK | P0 | 数据完整性 |
| 2 | issue005 发布失败 | P0 | 路由/契约缺失（无 `/p/` 页） |
| 3 | issue006 统计页加载 | P0/P1 | 数据加载失败可见性 |
| 4 | issue003 最近打开点击无反应 | P1 | 深链/无 folder_id 路径 |
| 5 | issue009 移动无反应 | P1 | 交互回调 |
| 6 | issue002 iPhone 8P | P1 | ✅ 已关（双轨+handoff，见结案指南） |
| 7 | issue001 Toast/新建编辑页 | P2 | 移动端布局 |
| 8 | issue007 字数非实时 | P2 | 状态订阅 |
| 9 | issue004 自动标题上限 | P2 | 产品确认（代码现为 30） |
| 10 | issue008 链接误触 | P2 | 需产品拍板交互规则后再修 |

## Risks

- ~~最近打开跨端预期未对齐~~ → **已拍板：云端全局**（见 `adr_product-decisions_recents-title-link_20260916.md`）。
- ~~issue002 未复现~~ → **已关**（2026-09-17）：鉴权导航 + NoteManager 大包；双轨落地，见 `docs/guides/IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md`。

## 产品已拍板（2026-09-16，待实施）

1. issue003：最近打开 = **云端全局** + 修手机点击  
2. issue004：自动标题上限 = **10**  
3. issue008：编辑态防误触方案 **同意**（桌面 Cmd/Ctrl+点；移动长按/按钮）

## 待讨论（未立项）

- 首页改版；笔记页 / 文件夹页改版（风格可保留，内容与信息架构待共创）。**明天修 bug 优先，改版另开讨论后再拆 issue/task。**

## Rollback

仅文档资产；删除本 phase 目录并恢复 `ISSUES.md`/`CHANGE.md` 即可。
