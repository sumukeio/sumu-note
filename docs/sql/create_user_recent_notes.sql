-- 用户「最近打开」云端存储（issue003：跨端全局）
-- 在 Supabase SQL Editor 执行。
-- 关联：.phrase/.../adr_product-decisions_recents-title-link_20260916.md

CREATE TABLE IF NOT EXISTS user_recent_notes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_recent_notes IS '用户最近打开的笔记列表（JSON 数组，跨端同步）';
COMMENT ON COLUMN user_recent_notes.entries IS '[{noteId, folderId, title, lastOpenedAt}, ...]，最多约 20 条';

ALTER TABLE user_recent_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own recent notes" ON user_recent_notes;
CREATE POLICY "Users can select own recent notes"
  ON user_recent_notes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own recent notes" ON user_recent_notes;
CREATE POLICY "Users can insert own recent notes"
  ON user_recent_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own recent notes" ON user_recent_notes;
CREATE POLICY "Users can update own recent notes"
  ON user_recent_notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own recent notes" ON user_recent_notes;
CREATE POLICY "Users can delete own recent notes"
  ON user_recent_notes FOR DELETE
  USING (auth.uid() = user_id);
