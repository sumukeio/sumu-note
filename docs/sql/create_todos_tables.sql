-- 创建任务管理相关的数据库表
-- 包括 todos（任务表）和 todo_lists（清单表）

-- 1. 创建 todo_lists 表（清单表）
CREATE TABLE IF NOT EXISTS todo_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT, -- 颜色代码，如 '#FF5733'
  icon TEXT, -- 图标名称
  order_index INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE, -- 默认清单
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建 todos 表（任务表）
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id UUID REFERENCES todo_lists(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES todos(id) ON DELETE CASCADE, -- 子任务父ID
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0 CHECK (priority IN (0, 1, 2, 3)), -- 0:无, 1:低, 2:中, 3:高
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'archived')),
  due_date TIMESTAMPTZ,
  reminder_time TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  order_index INTEGER DEFAULT 0, -- 排序索引
  tags TEXT[], -- 标签数组
  repeat_rule JSONB, -- 重复规则 {type: 'daily'|'weekly'|'monthly'|'yearly'|'custom', interval: 1, end_date: null}
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建索引

-- todo_lists 表索引
CREATE INDEX IF NOT EXISTS idx_todo_lists_user_id ON todo_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_lists_user_default ON todo_lists(user_id, is_default);

-- todos 表索引
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_list_id ON todos(list_id);
CREATE INDEX IF NOT EXISTS idx_todos_parent_id ON todos(parent_id);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_user_status ON todos(user_id, status);
CREATE INDEX IF NOT EXISTS idx_todos_user_list ON todos(user_id, list_id);
CREATE INDEX IF NOT EXISTS idx_todos_user_list_status ON todos(user_id, list_id, status);
CREATE INDEX IF NOT EXISTS idx_todos_is_deleted ON todos(is_deleted);

-- 4. 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建触发器
CREATE TRIGGER update_todo_lists_updated_at
  BEFORE UPDATE ON todo_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. 启用 RLS（Row Level Security）

-- todo_lists 表 RLS
ALTER TABLE todo_lists ENABLE ROW LEVEL SECURITY;

-- 删除现有策略（如果存在）
DROP POLICY IF EXISTS "Users can view their own lists" ON todo_lists;
DROP POLICY IF EXISTS "Users can insert their own lists" ON todo_lists;
DROP POLICY IF EXISTS "Users can update their own lists" ON todo_lists;
DROP POLICY IF EXISTS "Users can delete their own lists" ON todo_lists;

-- 创建 RLS 策略
CREATE POLICY "Users can view their own lists"
  ON todo_lists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lists"
  ON todo_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lists"
  ON todo_lists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lists"
  ON todo_lists FOR DELETE
  USING (auth.uid() = user_id);

-- todos 表 RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- 删除现有策略（如果存在）
DROP POLICY IF EXISTS "Users can view their own todos" ON todos;
DROP POLICY IF EXISTS "Users can insert their own todos" ON todos;
DROP POLICY IF EXISTS "Users can update their own todos" ON todos;
DROP POLICY IF EXISTS "Users can delete their own todos" ON todos;

-- 创建 RLS 策略
CREATE POLICY "Users can view their own todos"
  ON todos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own todos"
  ON todos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own todos"
  ON todos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own todos"
  ON todos FOR DELETE
  USING (auth.uid() = user_id);

-- 7. 创建默认清单的函数（可选）
CREATE OR REPLACE FUNCTION create_default_todo_list(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
  list_id UUID;
BEGIN
  INSERT INTO todo_lists (user_id, name, is_default, order_index)
  VALUES (user_uuid, '默认清单', TRUE, 0)
  RETURNING id INTO list_id;
  RETURN list_id;
END;
$$ LANGUAGE plpgsql;

-- 8. 注释说明
COMMENT ON TABLE todo_lists IS '任务清单表，用于分组管理任务';
COMMENT ON TABLE todos IS '任务表，存储用户的所有任务';
COMMENT ON COLUMN todos.priority IS '优先级：0=无, 1=低, 2=中, 3=高';
COMMENT ON COLUMN todos.status IS '状态：todo=待办, in_progress=进行中, done=已完成, archived=已归档';
COMMENT ON COLUMN todos.repeat_rule IS '重复规则JSON：{type: "daily|weekly|monthly|yearly|custom", interval: 1, days_of_week: [1,2,3], end_date: null, end_after_count: null}';

