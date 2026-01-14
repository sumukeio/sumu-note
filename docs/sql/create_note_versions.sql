-- 创建笔记版本历史表
-- 在 Supabase SQL Editor 中执行此脚本

CREATE TABLE IF NOT EXISTS note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  tags TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_note FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON note_versions(note_id);
CREATE INDEX IF NOT EXISTS idx_note_versions_created_at ON note_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_versions_user_id ON note_versions(user_id);

-- 启用 RLS
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能查看自己的版本
DROP POLICY IF EXISTS "Users can view their own note versions" ON note_versions;
CREATE POLICY "Users can view their own note versions"
  ON note_versions FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 策略：用户只能插入自己的版本
DROP POLICY IF EXISTS "Users can insert their own note versions" ON note_versions;
CREATE POLICY "Users can insert their own note versions"
  ON note_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS 策略：用户只能删除自己的版本
DROP POLICY IF EXISTS "Users can delete their own note versions" ON note_versions;
CREATE POLICY "Users can delete their own note versions"
  ON note_versions FOR DELETE
  USING (auth.uid() = user_id);

-- 可选：创建函数自动清理旧版本（保留最近 50 个版本）
CREATE OR REPLACE FUNCTION cleanup_old_note_versions()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM note_versions
  WHERE note_id = NEW.note_id
    AND id NOT IN (
      SELECT id FROM note_versions
      WHERE note_id = NEW.note_id
      ORDER BY created_at DESC
      LIMIT 50
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：每次插入新版本后自动清理旧版本
DROP TRIGGER IF EXISTS trigger_cleanup_old_versions ON note_versions;
CREATE TRIGGER trigger_cleanup_old_versions
  AFTER INSERT ON note_versions
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_old_note_versions();



























