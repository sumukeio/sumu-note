# Plan — 工程治理脚手架落地

> **状态**：[权威/现行]  
> **阶段**：phase-engineering-governance-20260916

## Milestones

1. **M1（本阶段）**：AGENTS 本地化 + `.phrase` + Agent 规则 + 文档索引/CHANGELOG 闭环。
2. **M2（后续，需人类确认开启）**：按需拆 issue、补巡检脚本、或对关键模块补回归网。

## Scope

- 仅治理与文档脚手架；不改产品运行时行为。

## Priorities

1. 可执行规范（AGENTS）  
2. 可追踪任务体系（.phrase）  
3. Agent 规则摘要同步  
4. 文档路由与变更可追溯  

## Risks & Dependencies

| 风险 | 缓解 |
| :--- | :--- |
| 与旧任务文档（`docs/tasks/*`）双轨 | 新工作优先走 `.phrase`；旧文档加状态说明，不硬删 |
| 规则文件漂移 | `.cursorrules` / rules 仅摘要，细节以 AGENTS 为准 |
| 过度迁移 docs | Non-goals 明确暂缓 |

## Rollback

删除本阶段新增的 `.phrase` / rules / 薄索引文件，并将 `AGENTS.md` 回退到升级前版本即可；不触及业务代码。
