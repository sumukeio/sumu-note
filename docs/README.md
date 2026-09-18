# 文档目录

> **状态**：[权威/现行]  
> 本文档目录按类型组织，是「你要找什么 → 打开哪个文件」的路由表。  
> **工程治理总规范**：根目录 [`AGENTS.md`](../AGENTS.md)  
> **阶段任务过程资产**：[`../.phrase/docs/README.md`](../.phrase/docs/README.md)

## 🧭 治理与过程（优先阅读）

| 你要找什么 | 打开哪个文件 |
| :--- | :--- |
| AI/人类协作铁律与工作流 | [`../AGENTS.md`](../AGENTS.md) |
| 当前 Phase / Task / Change | [`.phrase/docs/CHANGE.md`](../.phrase/docs/CHANGE.md) |
| 缺陷索引 issueNNN | [`.phrase/docs/ISSUES.md`](../.phrase/docs/ISSUES.md) |
| iOS 登录/白屏/双轨文件夹（issue002 结案） | [`guides/IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md`](./guides/IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md) |
| 真机/白屏客户端排障 Playbook（可复用） | [`guides/CLIENT_DEBUG_PLAYBOOK.md`](./guides/CLIENT_DEBUG_PLAYBOOK.md) |
| 全量变更日志（只追加） | [`changelog/CHANGELOG.md`](./changelog/CHANGELOG.md) |
| CHANGELOG 路径兼容入口 | [`CHANGELOG.md`](./CHANGELOG.md) |
| AI 协同认知升级手册（仓库镜像） | [`guides/从VibeCoding到专业工程_AI协同认知升级手册.md`](./guides/从VibeCoding到专业工程_AI协同认知升级手册.md) |
| 跨项目 SSOT：认知手册 + 公共 AGENTS + 提示词 | `E:\DAS储备数据\经验积累\`（见该目录 `README.md` · `提示词.md`） |

> **约定**：自 2026-09-16 起，**新的原子任务优先登记在 `.phrase/phases/`**；`docs/tasks/` 中的历史任务文档保留作归档参考，不硬删。

## 📁 目录结构

### 📋 requirements/ - 需求文档
功能需求规格说明文档
- `MIND_NOTE_REQUIREMENTS.md` - 思维笔记功能需求文档
- `TODO_MANAGEMENT_REQUIREMENTS.md` - 任务管理功能需求文档

### ✨ features/ - 功能设计文档
功能设计和实现说明文档
- `MIND_NOTE_FEATURE.md` - 思维笔记功能设计文档
- `TODO_FEATURE_SUGGESTIONS.md` - 任务管理功能建议文档

### 📝 tasks/ - 任务文档
任务分解、实现计划和完成报告
- `MIND_NOTE_TASKS.md` - 思维笔记任务分解文档
- `MIND_NOTE_IMPROVEMENT_TASKS.md` - 思维笔记改进任务文档
- `TODO_MANAGEMENT_TASKS.md` - 任务管理任务分解文档
- `TASK_1.1-1.3_COMPLETION.md` - 任务 1.1-1.3 完成报告
- `TASK_2.1-2.3_COMPLETION.md` - 任务 2.1-2.3 完成报告
- `TASK_3.1-3.2_COMPLETION.md` - 任务 3.1-3.2 完成报告
- `TASK_4.1-4.3_COMPLETION.md` - 任务 4.1-4.3 完成报告
- `TASK_5.1-5.2_COMPLETION.md` - 任务 5.1-5.2 完成报告

### ✅ completions/ - 完成报告
功能完成和优化报告
- `FOLDER_SUPPORT_COMPLETION.md` - 文件夹支持完成报告
- `MIND_NOTE_PERFORMANCE_OPTIMIZATION.md` - 思维笔记性能优化报告
- `VERSION_HISTORY_AND_OFFLINE_IMPLEMENTATION.md` - 版本历史和离线功能实现报告

### 📊 reports/ - 测试和Bug报告
测试报告、Bug报告和代码审查报告
- `BUG_REPORT.md` - Bug报告汇总
- `BUILD_BUG_ANALYSIS.md` - 构建Bug根本原因分析
- `CODE_REVIEW_REPORT.md` - 代码审查报告
- `TEST_REPORT.md` - 测试报告
- `TEST_REPORT_LATEST.md` - 最新测试报告
- `VERSION_MANAGEMENT_BUG_FIX.md` - 版本管理Bug修复报告

### 📖 guides/ - 指南文档
开发指南、测试指南和配置指南
- `CODE_REVIEW_CHECKLIST.md` - 代码审查清单
- `IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md` - **iOS WebKit 鉴权与双轨文件夹（issue002 结案）**
- `CLIENT_DEBUG_PLAYBOOK.md` - **客户端不可见失败排障 Playbook（真机/白屏可复用）**
- `MOBILE_TESTING.md` - 移动端测试指南（含双轨与 debugAuth）
- `REALTIME_SYNC_SETUP.md` - 实时同步配置指南
- `VERSION_HISTORY_AND_OFFLINE.md` - 版本历史和离线功能指南

### 📐 templates/ - 模板文档
文档模板和规范
- `需求描述模板.md` - 需求描述标准模板

### 🗺️ 规划文档
产品规划和架构文档
- `架构审查_笔记模块.md` - 笔记模块架构审查报告（仅笔记相关，不含任务/思维笔记）
- `功能依赖关系图.md` - 功能模块依赖关系图
- `产品路线图.md` - 产品发展规划路线图

### 📅 changelog/ - 变更日志
项目变更记录和文档更新记录
- `CHANGELOG.md` - 项目变更日志
- `DOCUMENTATION_UPDATE.md` - 文档更新总结

### 🗄️ sql/ - SQL脚本
数据库表结构和迁移脚本
- `allow_select_published_notes.sql` - **公开笔记 SELECT RLS**（发布功能 `/p` 匿名可读，issue005）
- `create_user_recent_notes.sql` - **最近打开云端表**（issue003 跨端同步）
- `create_mind_notes_tables.sql` - 创建思维笔记表
- `add_folder_support_to_mind_notes.sql` - 添加文件夹支持
- `create_note_versions.sql` - 创建笔记版本表
- `create_todos_tables.sql` - 创建任务管理表
- `create_user_settings_table.sql` - 创建用户设置表

---

## 🔍 快速查找

### 我想了解功能需求
→ 查看 `requirements/` 文件夹

### 我想查看功能设计
→ 查看 `features/` 文件夹

### 我想查看任务进度
→ 查看 `tasks/` 文件夹

### 我想了解已完成的优化
→ 查看 `completions/` 文件夹

### 我想查看测试和Bug报告
→ 查看 `reports/` 文件夹

### 我想查找开发指南
→ 查看 `guides/` 文件夹

### 我想查看项目变更历史
→ 查看 `changelog/CHANGELOG.md`（或根级薄索引 `docs/CHANGELOG.md`）

### 我需要数据库脚本
→ 查看 `sql/` 文件夹

### 我想按 AGENTS 规范推进任务
→ 查看 `.phrase/docs/CHANGE.md` 定位当前阶段，再打开对应 `task_*.md`

### 我想登记新 Bug
→ 先写 `.phrase/docs/ISSUES.md`（现行 issue001–010）；历史汇编仍可参考 `reports/BUG_REPORT.md`

### 思维笔记还做吗？
→ **计划下线**（ADR：`.phrase/phases/phase-bug-triage-mindnote-sunset-20260916/adr_mind-note-sunset_20260916.md`）；相关需求/设计文档已标状态，不硬删

---

**最后更新**: 2026-09-16





