-- 创建用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  reminder_before_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- 添加注释
COMMENT ON TABLE user_settings IS '用户设置表，存储用户的时区、提醒时间等偏好设置';
COMMENT ON COLUMN user_settings.timezone IS '用户时区，使用IANA时区标识符，如Asia/Shanghai';
COMMENT ON COLUMN user_settings.reminder_before_minutes IS '提醒时间提前分钟数，默认15分钟';










