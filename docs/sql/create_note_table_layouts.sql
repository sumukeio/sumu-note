-- 创建笔记表格布局元数据表（列宽/冻结列）
-- 在 Supabase SQL Editor 中执行此脚本

CREATE TABLE IF NOT EXISTS note_table_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_key TEXT NOT NULL,
  col_widths JSONB NOT NULL DEFAULT '[]'::jsonb,
  freeze_first_col BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_note FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 唯一约束：同一用户同一笔记同一表格 key 只有一份布局
CREATE UNIQUE INDEX IF NOT EXISTS idx_note_table_layouts_unique
  ON note_table_layouts(user_id, note_id, table_key);

-- 常用索引
CREATE INDEX IF NOT EXISTS idx_note_table_layouts_note_id ON note_table_layouts(note_id);
CREATE INDEX IF NOT EXISTS idx_note_table_layouts_user_id ON note_table_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_note_table_layouts_updated_at ON note_table_layouts(updated_at DESC);

-- 启用 RLS
ALTER TABLE note_table_layouts ENABLE ROW LEVEL SECURITY;

-- RLS：用户只能查看自己的布局
DROP POLICY IF EXISTS "Users can view their own table layouts" ON note_table_layouts;
CREATE POLICY "Users can view their own table layouts"
  ON note_table_layouts FOR SELECT
  USING (auth.uid() = user_id);

-- RLS：用户只能写入自己的布局
DROP POLICY IF EXISTS "Users can upsert their own table layouts" ON note_table_layouts;
CREATE POLICY "Users can upsert their own table layouts"
  ON note_table_layouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own table layouts" ON note_table_layouts;
CREATE POLICY "Users can update their own table layouts"
  ON note_table_layouts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS：用户只能删除自己的布局
DROP POLICY IF EXISTS "Users can delete their own table layouts" ON note_table_layouts;
CREATE POLICY "Users can delete their own table layouts"
  ON note_table_layouts FOR DELETE
  USING (auth.uid() = user_id);

