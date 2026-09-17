# Issues 索引

> **状态**：[权威/现行]  
> **约定**：新缺陷从此处增量登记 `issueNNN`；历史长文 `docs/reports/BUG_REPORT.md` **暂不整库拆分**。  
> **分诊详情**：[issue_triage_20260916.md](../phases/phase-bug-triage-mindnote-sunset-20260916/issue_triage_20260916.md)  
> **产品决策**：[ADR 思维笔记计划下线](../phases/phase-bug-triage-mindnote-sunset-20260916/adr_mind-note-sunset_20260916.md) · [ADR 最近打开/标题/链接](../phases/phase-bug-triage-mindnote-sunset-20260916/adr_product-decisions_recents-title-link_20260916.md)

| ID | 状态 | 级别 | 摘要 | 详情 |
| :--- | :--- | :--- | :--- | :--- |
| issue001 | [x] | P2 | 手机新建 Toast 挡标题 + 页态（task010） | [分诊](../phases/phase-bug-triage-mindnote-sunset-20260916/issue_triage_20260916.md#issue001----手机端新建-toast-挡标题--新建编辑页态不一致) |
| issue002 | [x] | P1 | iOS 登录/白屏/文件夹双轨（task011–020，2026-09-17 关闭） | [分诊](../phases/phase-bug-triage-mindnote-sunset-20260916/issue_triage_20260916.md#issue002-x-iphone-8-plus-登录后进不去) · [结案指南](../../docs/guides/IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md) |
| issue003 | [x] | P1 | 最近打开：云端全局 + 手机点击（task005） | [分诊](../phases/phase-bug-triage-mindnote-sunset-20260916/issue_triage_20260916.md#issue003----手机端最近打开点击无反应--跨端预期偏差) |
| issue004 | [x] | P2 | 自动标题字数上限 10（task007） | [分诊](../phases/phase-bug-triage-mindnote-sunset-20260916/issue_triage_20260916.md#issue004----自动标题字数上限用户期望-10) |
| issue005 | [x] | P0 | 发布功能失败（task003 已修 `/p` + ADR/RLS SQL） | [分诊](../phases/phase-bug-triage-mindnote-sunset-20260916/issue_triage_20260916.md#issue005----发布功能失败) |
| issue006 | [x] | P0/P1 | 统计仪表盘加载（task004 已修） | [分诊](../phases/phase-bug-triage-mindnote-sunset-20260916/issue_triage_20260916.md#issue006----统计仪表盘页面加载不出来) |
| issue007 | [x] | P2 | 编辑页字数/段落/阅读时间实时（task009） | [分诊](../phases/phase-bug-triage-mindnote-sunset-20260916/issue_triage_20260916.md#issue007----编辑页字数段落阅读时间非实时) |
| issue008 | [x] | P2 | 正文链接防误触（task008） | [分诊](../phases/phase-bug-triage-mindnote-sunset-20260916/issue_triage_20260916.md#issue008----正文链接点击易误触弹窗待产品拍板) |
| issue009 | [x] | P1 | 移动功能双端无反应（task006） | [分诊](../phases/phase-bug-triage-mindnote-sunset-20260916/issue_triage_20260916.md#issue009----移动功能双端均无反应) |
| issue010 | [x] | P0 | 删除文件夹 `folders_parent_id_fkey`（task002 已修） | [分诊](../phases/phase-bug-triage-mindnote-sunset-20260916/issue_triage_20260916.md#issue010----删除文件夹违反-folders_parent_id_fkey) |

## 建议修复次序（尚未开修）

1. 本轮分诊 issue001–010 均已关闭；后续按需新开 issue  
2. 或开启思维笔记下线实施（见 ADR）

## 待讨论（未登记为 issue）

- 首页 / 笔记页 / 文件夹页改版：风格可保留，内容与信息架构需共创后再立项。
- **可选后续（澄清，非必做）**：见 [`IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md`](../../docs/guides/IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md)「可选后续」——
  - **NoteManager 拆包**：主要为安卓/PC/iPad **首屏与中端机韧性**，不是修现网故障；旧 iPhone 已由轻量轨绕过。
  - **轻量功能增量**：只服务 iPhone/iPod；轻量 **已增强** 至关闭 issue002 所需，增量=按痛点从砍掉矩阵加回，无痛点则不做。

## 历史参考（非 issueNNN）

- [docs/reports/BUG_REPORT.md](../../docs/reports/BUG_REPORT.md)
- [docs/reports/BUILD_BUG_ANALYSIS.md](../../docs/reports/BUILD_BUG_ANALYSIS.md)
- [docs/reports/VERSION_MANAGEMENT_BUG_FIX.md](../../docs/reports/VERSION_MANAGEMENT_BUG_FIX.md)


记一笔：很多issue，肯定是优先级更高的，更重要的先修。很多任务，肯定是更重要的先做。
所以，一堆任务面前，肯定是先分优先级。
