# .phrase 体系说明

> **状态**：[权威/现行]  
> **用途**：Sumu Note 的阶段化研发管理（Phase / Task / Change / Issue）

本目录是 **任务与变更过程** 的单一事实来源；产品业务知识仍以 `docs/` 为准。

## 目录

```text
.phrase/
  docs/
    README.md    # 本说明
    CHANGE.md    # 变更总索引（含当前进行阶段）
    ISSUES.md    # 缺陷索引 issueNNN
  phases/
    phase-<purpose>-<YYYYMMDD>/
      spec_*.md | plan_*.md | task_*.md | change_*.md
```

## 使用要点

1. **仅当人类明确开启新阶段**时新建 `phase-*`。
2. 每个原子任务使用三位编号 `taskNNN`，完成后勾选并写 `change_*`。
3. 同步追加 `docs/changelog/CHANGELOG.md`。
4. 最高行为准则见根目录 `AGENTS.md`。
