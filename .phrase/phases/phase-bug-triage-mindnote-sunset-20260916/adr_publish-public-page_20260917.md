# ADR — 发布笔记公开阅读语义（`/p/:id`）

> **状态**：[已决策]  
> **日期**：2026-09-17  
> **关联**：issue005  
> **依据**：AGENTS 负向禁令 — 公开链接语义 / RLS 变更须先 ADR

## Context

发布按钮将链接设为 `{origin}/p/{noteId}`，但仓库无 `/p` 路由；架构文档将公开阅读写在 `/notes/[id]`，二者不一致。匿名/他端打开发布链接会 404 或因 RLS 无法读取。

## Decision

1. **公开 URL 规范**：已发布笔记的权威公开路径为 **`/p/{noteId}`**（与现有 UI 复制行为一致）。
2. **可读条件**：`is_published = true` 且 `is_deleted` 不为 true；仅暴露 `id/title/content/updated_at` 等阅读所需字段。
3. **RLS**：新增策略，允许对满足上述条件的行执行 `SELECT`（含匿名）；**不**开放 INSERT/UPDATE/DELETE。SQL 落盘于 `docs/sql/allow_select_published_notes.sql`，需在 Supabase 执行后方对匿名访客生效。
4. **`/notes/[id]`**：保留为既有阅读/反链页，不在本期删除；不强制改写历史书签。

## Alternatives

| 方案 | 为何不选 |
| :--- | :--- |
| 仅把复制 URL 改为 `/notes/:id` | 不解决「未发布也可被猜 id 读」与匿名 RLS；且与「发布」语义弱绑定 |
| `ON DELETE`/改表结构 | 超出本期；非根因 |

## Consequences

- 未在 Supabase 执行 SQL 前：登录用户或具备读权限的会话可能能打开 `/p`；**匿名访客仍可能失败**——须在运维上执行 SQL。
- 取消发布后同一 URL 应展示「未发布或已下线」。

## Rollback

删除 `/p` 路由与 RLS 策略；UI 改回既有路径（需再开 ADR）。
