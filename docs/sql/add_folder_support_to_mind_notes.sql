-- 为思维笔记添加文件夹支持
-- 执行此脚本前请确保已登录 Supabase Dashboard 并选择正确的项目

-- 1. 为 mind_notes 表添加 folder_id 字段
ALTER TABLE mind_notes 
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- 2. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_mind_notes_folder_id ON mind_notes(folder_id);

-- 3. 更新 RLS 策略（如果需要）
-- 注意：folders 表应该已经有 RLS 策略，mind_notes 的 RLS 策略已经存在
-- 这里不需要额外修改，因为 mind_notes 的 RLS 策略已经基于 user_id

-- 验证
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'mind_notes' AND column_name = 'folder_id';

