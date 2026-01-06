# 版本历史和离线支持功能实现计划

## 功能 1：版本历史

### 数据库设计

创建 `note_versions` 表：

```sql
CREATE TABLE note_versions (
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
CREATE INDEX idx_note_versions_note_id ON note_versions(note_id);
CREATE INDEX idx_note_versions_created_at ON note_versions(created_at DESC);

-- RLS 策略
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own note versions"
  ON note_versions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own note versions"
  ON note_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own note versions"
  ON note_versions FOR DELETE
  USING (auth.uid() = user_id);
```

### 实现步骤

1. **创建数据库表**（需要在 Supabase 执行 SQL）
2. **修改 saveNote 函数**：每次保存时创建版本
3. **添加版本限制**：保留最近 N 个版本（如 50 个），自动清理旧版本
4. **创建版本历史 UI**：在编辑器工具栏添加"历史"按钮
5. **版本列表组件**：显示版本列表，包含时间、预览
6. **恢复功能**：选择版本后恢复内容

## 功能 2：离线支持

### 技术栈

- **IndexedDB**：使用 `localforage` 或 `Dexie.js` 简化操作
- **Network API**：检测网络状态
- **Service Worker**：可选，用于更高级的离线缓存

### 实现步骤

1. **安装依赖**：`npm install localforage`
2. **创建离线存储模块**：`src/lib/offline-storage.ts`
3. **网络状态检测**：监听 `online/offline` 事件
4. **离线保存逻辑**：
   - 检测到离线时，保存到 IndexedDB
   - 标记为待同步状态
5. **自动同步**：
   - 检测到网络恢复
   - 批量同步 IndexedDB 中的待同步记录
   - 处理冲突（使用 last-write-wins 策略）
6. **UI 状态指示器**：显示在线/离线/同步中状态

### 数据结构

IndexedDB 存储结构：
- `pending_sync_notes`: 待同步的笔记更改
  - note_id
  - title
  - content
  - tags
  - timestamp
  - operation (update/create/delete)

## 实现优先级

1. **第一阶段**：版本历史（相对独立，不影响现有功能）
2. **第二阶段**：离线支持（需要更仔细的测试）












