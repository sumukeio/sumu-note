-- 允许匿名/登录用户读取「已发布且未删除」的笔记（issue005 / 公开页 /p/:id）
-- 在 Supabase SQL Editor 执行。执行前请确认与现有 notes RLS 不冲突。
-- 关联 ADR：.phrase/phases/phase-bug-triage-mindnote-sunset-20260916/adr_publish-public-page_20260917.md

-- 若已存在同名策略，先删除再创建（幂等友好）
DROP POLICY IF EXISTS "Public can select published notes" ON notes;

CREATE POLICY "Public can select published notes"
ON notes
FOR SELECT
USING (
  is_published = true
  AND (is_deleted IS NULL OR is_deleted = false)
);

-- 校验（可选）：
-- SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'notes'::regclass;
