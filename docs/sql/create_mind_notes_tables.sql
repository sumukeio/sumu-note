-- 思维笔记功能 - 数据库表结构
-- 执行此脚本前请确保已登录 Supabase Dashboard 并选择正确的项目

-- 1. 创建 mind_notes 表（思维笔记主表）
CREATE TABLE IF NOT EXISTS mind_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '未命名思维笔记',
  root_node_id UUID,  -- 根节点 ID（自引用，可选）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 2. 创建 mind_note_nodes 表（思维笔记节点表）
CREATE TABLE IF NOT EXISTS mind_note_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mind_note_id UUID NOT NULL REFERENCES mind_notes(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES mind_note_nodes(id) ON DELETE CASCADE,  -- NULL 表示根节点
  content TEXT NOT NULL DEFAULT '',  -- 节点内容（支持格式化标记：**加粗**、==高亮==）
  order_index INTEGER NOT NULL DEFAULT 0,  -- 同级节点排序
  is_expanded BOOLEAN DEFAULT TRUE,  -- 是否展开（用于折叠功能）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_mind_notes_user_id ON mind_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_mind_notes_updated_at ON mind_notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mind_notes_is_deleted ON mind_notes(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_mind_note_nodes_mind_note_id ON mind_note_nodes(mind_note_id);
CREATE INDEX IF NOT EXISTS idx_mind_note_nodes_parent_id ON mind_note_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_mind_note_nodes_order ON mind_note_nodes(mind_note_id, parent_id, order_index);

-- 4. 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 为 mind_notes 表添加更新时间触发器
DROP TRIGGER IF EXISTS trigger_update_mind_notes_updated_at ON mind_notes;
CREATE TRIGGER trigger_update_mind_notes_updated_at
  BEFORE UPDATE ON mind_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. 为 mind_note_nodes 表添加更新时间触发器
DROP TRIGGER IF EXISTS trigger_update_mind_note_nodes_updated_at ON mind_note_nodes;
CREATE TRIGGER trigger_update_mind_note_nodes_updated_at
  BEFORE UPDATE ON mind_note_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. 启用 RLS（Row Level Security）
ALTER TABLE mind_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mind_note_nodes ENABLE ROW LEVEL SECURITY;

-- 8. 创建 RLS 策略 - mind_notes 表

-- 查看策略
DROP POLICY IF EXISTS "Users can view their own mind notes" ON mind_notes;
CREATE POLICY "Users can view their own mind notes"
  ON mind_notes FOR SELECT
  USING (auth.uid() = user_id);

-- 插入策略
DROP POLICY IF EXISTS "Users can insert their own mind notes" ON mind_notes;
CREATE POLICY "Users can insert their own mind notes"
  ON mind_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 更新策略
DROP POLICY IF EXISTS "Users can update their own mind notes" ON mind_notes;
CREATE POLICY "Users can update their own mind notes"
  ON mind_notes FOR UPDATE
  USING (auth.uid() = user_id);

-- 删除策略
DROP POLICY IF EXISTS "Users can delete their own mind notes" ON mind_notes;
CREATE POLICY "Users can delete their own mind notes"
  ON mind_notes FOR DELETE
  USING (auth.uid() = user_id);

-- 9. 创建 RLS 策略 - mind_note_nodes 表

-- 查看策略
DROP POLICY IF EXISTS "Users can view their own mind note nodes" ON mind_note_nodes;
CREATE POLICY "Users can view their own mind note nodes"
  ON mind_note_nodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mind_notes 
      WHERE mind_notes.id = mind_note_nodes.mind_note_id 
      AND mind_notes.user_id = auth.uid()
    )
  );

-- 插入策略
DROP POLICY IF EXISTS "Users can insert their own mind note nodes" ON mind_note_nodes;
CREATE POLICY "Users can insert their own mind note nodes"
  ON mind_note_nodes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mind_notes 
      WHERE mind_notes.id = mind_note_nodes.mind_note_id 
      AND mind_notes.user_id = auth.uid()
    )
  );

-- 更新策略
DROP POLICY IF EXISTS "Users can update their own mind note nodes" ON mind_note_nodes;
CREATE POLICY "Users can update their own mind note nodes"
  ON mind_note_nodes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM mind_notes 
      WHERE mind_notes.id = mind_note_nodes.mind_note_id 
      AND mind_notes.user_id = auth.uid()
    )
  );

-- 删除策略
DROP POLICY IF EXISTS "Users can delete their own mind note nodes" ON mind_note_nodes;
CREATE POLICY "Users can delete their own mind note nodes"
  ON mind_note_nodes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM mind_notes 
      WHERE mind_notes.id = mind_note_nodes.mind_note_id 
      AND mind_notes.user_id = auth.uid()
    )
  );

-- 10. 验证表创建成功
-- 执行以下查询验证表是否创建成功：
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('mind_notes', 'mind_note_nodes');

-- 11. 验证 RLS 策略
-- 执行以下查询验证策略是否创建成功：
-- SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('mind_notes', 'mind_note_nodes');









