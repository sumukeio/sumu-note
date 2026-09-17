# Spec — 工程治理脚手架落地

> **状态**：[权威/现行]  
> **阶段**：phase-engineering-governance-20260916  
> **日期**：2026-09-16

## Summary

将根目录 `AGENTS.md` 本地化适配 Sumu Note，并补齐文档驱动研发所需的最小治理资产：`.phrase/`、跨 Agent 规则摘要、文档路由与 CHANGELOG 索引。

## Goals

- 提供可执行的人机协作总规范（铁律、五步工作流、单任务刹车）。
- 建立 `.phrase` Phase/Task/Change/Issue 最小闭环。
- 同步 Cursor / Antigravity 规则摘要，仲裁权归 `AGENTS.md`。
- 明确对本仓库**暂缓**的条款，避免假合规。

## Non-goals（本次不做）

- 不重构业务功能代码（编辑器 / Todo / Mind Note）。
- 不整体迁移 `docs/` 至 `ops/architecture/product` 新目录树。
- 不把历史 `BUG_REPORT.md` 拆成全量 `issueNNN`。
- 不新增健康巡检脚本或 CI 大改。
- 不执行 git commit / push。

## User Flows（治理向）

| 操作 | 反馈 | 回退 |
| :--- | :--- | :--- |
| 人类开启新 phase | 出现完整 `spec/plan/task/change` 最小集 | 未经确认不结项、不改名 DONE |
| AI 完成 taskNNN | 勾选任务 + change 条目 + CHANGELOG 追加，并刹车等待 | 人类未确认不得开启下一 task |
| 发现新 Bug | 先登 `ISSUES.md` 再拆 task | 历史报告仅作参考，不硬删 |

## Edge Cases

- 规范路径 `docs/CHANGELOG.md` 与仓库历史路径 `docs/changelog/CHANGELOG.md` 并存：以后者为权威正文，前者为薄索引。
- 规则文件与 `AGENTS.md` 冲突时，以 `AGENTS.md` 为准。

## Acceptance Criteria

- [x] `AGENTS.md` 已去除 DataAnalysisPlatform 强绑定，并写明 Sumu Note 技术栈与暂缓项。
- [x] `.phrase/` 最小集存在且指向本阶段。
- [x] `.agents/rules` 与 `.cursor/rules` + `.cursorrules` 存在。
- [x] `docs/README.md` 路由已包含治理入口；CHANGELOG 有追加记录。
