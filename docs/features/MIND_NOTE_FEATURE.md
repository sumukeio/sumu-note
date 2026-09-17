# 思维笔记功能设计文档

> **状态**：[计划下线 / 冻结新需求]（2026-09-16 ADR：思维笔记计划下线）  
> 保留历史设计上下文，禁止硬删。

## 📋 功能概述

思维笔记是一个类似 Workflowy/Roam Research 的大纲编辑器，支持无限层级的节点结构、富文本格式化、拖拽重排和文档内嵌。

## 🎯 核心功能

### 1. 大纲结构
- **无限层级**：支持任意深度的父子节点关系
- **树形结构**：每个节点可以有多个子节点
- **节点内容**：纯文本 + 格式化（加粗、高亮色）

### 2. 文本格式化
- **加粗**：`**文本**` 或快捷键 `Ctrl/Cmd + B`
- **高亮色**：`==文本==` 或通过工具栏选择颜色
- **纯文本**：默认模式

### 3. 快捷键系统

#### 电脑端
- **Tab**：创建子节点（下一级）
- **Enter**：创建同级节点（兄弟节点）
- **Shift + Tab**：取消缩进（提升层级）
- **Alt + .**：全部展开/折叠
- **Ctrl/Cmd + B**：加粗选中文本
- **Ctrl/Cmd + K**：高亮选中文本

#### 手机端
- **选中节点**：点击任意节点，底部自动弹出工具栏
- **移动/改变层级**：长按节点拖拽到目标位置
  - 拖到节点上方 → 变子节点
  - 拖到节点旁边 → 变同级
- **编辑文字**：双击节点或点击工具栏"编辑"按钮
- **换行（Enter）**：键盘回车直接生成同级节点
- **缩进/升级**：工具栏提供「向右箭头（缩进）」和「向左箭头（升级）」按钮

### 4. 节点拖拽
- 支持拖拽节点改变层级或顺序
- 使用 `@dnd-kit` 实现流畅拖拽体验
- 拖拽时显示视觉反馈

### 5. 文档内嵌
- 在节点中插入另一篇思维笔记
- 语法：`[[mind_note_id|显示名称]]`
- 点击内嵌笔记可跳转或展开预览

## 🗂️ 数据模型设计

### 数据库表：`mind_notes`

```sql
CREATE TABLE mind_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,  -- 思维笔记标题
  root_node_id UUID,    -- 根节点 ID（自引用）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE mind_note_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mind_note_id UUID NOT NULL REFERENCES mind_notes(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES mind_note_nodes(id) ON DELETE CASCADE,  -- NULL 表示根节点
  content TEXT NOT NULL,  -- 节点内容（支持格式化标记）
  order_index INTEGER NOT NULL DEFAULT 0,  -- 同级节点排序
  is_expanded BOOLEAN DEFAULT TRUE,  -- 是否展开（用于折叠功能）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_mind_notes_user_id ON mind_notes(user_id);
CREATE INDEX idx_mind_notes_updated_at ON mind_notes(updated_at DESC);
CREATE INDEX idx_mind_note_nodes_mind_note_id ON mind_note_nodes(mind_note_id);
CREATE INDEX idx_mind_note_nodes_parent_id ON mind_note_nodes(parent_id);
CREATE INDEX idx_mind_note_nodes_order ON mind_note_nodes(mind_note_id, parent_id, order_index);

-- RLS 策略
ALTER TABLE mind_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mind_note_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mind notes"
  ON mind_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mind notes"
  ON mind_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mind notes"
  ON mind_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mind notes"
  ON mind_notes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own mind note nodes"
  ON mind_note_nodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mind_notes 
      WHERE mind_notes.id = mind_note_nodes.mind_note_id 
      AND mind_notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own mind note nodes"
  ON mind_note_nodes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mind_notes 
      WHERE mind_notes.id = mind_note_nodes.mind_note_id 
      AND mind_notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own mind note nodes"
  ON mind_note_nodes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM mind_notes 
      WHERE mind_notes.id = mind_note_nodes.mind_note_id 
      AND mind_notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own mind note nodes"
  ON mind_note_nodes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM mind_notes 
      WHERE mind_notes.id = mind_note_nodes.mind_note_id 
      AND mind_notes.user_id = auth.uid()
    )
  );
```

## 📁 文件结构

```
src/
├── app/
│   └── dashboard/
│       └── mind-notes/              # 思维笔记模块
│           ├── page.tsx             # 思维笔记列表页
│           └── [id]/
│               └── page.tsx         # 思维笔记编辑页
├── components/
│   ├── MindNoteManager.tsx         # 思维笔记列表管理组件
│   ├── MindNoteEditor.tsx          # 思维笔记编辑器组件
│   ├── MindNode.tsx                # 单个节点组件
│   ├── MindNodeToolbar.tsx         # 节点工具栏（移动端）
│   └── MindNodeRenderer.tsx        # 节点内容渲染器（支持格式化）
└── lib/
    ├── mind-note-utils.ts          # 思维笔记工具函数
    └── mind-note-storage.ts        # 思维笔记数据操作
```

## 🎨 UI/UX 设计

### 列表页（`/dashboard/mind-notes`）
- 顶部：标题"思维笔记" + "新建"按钮
- 列表：显示所有思维笔记（标题、更新时间、节点数量）
- 支持搜索、删除、重命名

### 编辑页（`/dashboard/mind-notes/[id]`）
- **顶部工具栏**：
  - 返回按钮
  - 标题编辑
  - 保存状态
  - 更多菜单（导出、删除等）
  
- **编辑区域**：
  - 树形节点列表
  - 每个节点可编辑、可拖拽
  - 支持折叠/展开
  
- **移动端工具栏**（底部）：
  - 编辑按钮
  - 缩进按钮（→）
  - 升级按钮（←）
  - 删除按钮

## 🔧 技术实现要点

### 1. 节点渲染
- 使用递归组件渲染树形结构
- 支持虚拟滚动（如果节点很多）
- 拖拽时使用 `@dnd-kit` 的 `SortableContext`

### 2. 快捷键处理
- 使用 `useEffect` + `keydown` 事件监听
- 区分编辑模式和浏览模式
- 防止与浏览器默认快捷键冲突

### 3. 文本格式化
- 使用简单的标记语法：`**bold**`、`==highlight==`
- 编辑时显示标记，预览时渲染格式化
- 或使用 `contentEditable` + 富文本编辑

### 4. 拖拽实现
- 使用 `@dnd-kit/core` + `@dnd-kit/sortable`
- 支持跨层级拖拽
- 拖拽后更新 `parent_id` 和 `order_index`

### 5. 文档内嵌
- 解析节点内容中的 `[[mind_note_id|名称]]` 语法
- 点击时跳转到对应思维笔记或显示预览弹窗

### 6. 自动保存
- 类似 `NoteManager` 的实现
- 使用 debounce 延迟保存
- 显示保存状态

## 📱 移动端适配

### 触摸交互
- **长按拖拽**：使用 `TouchSensor` 检测长按
- **点击编辑**：双击或工具栏按钮
- **工具栏**：底部固定工具栏，选中节点时显示

### 响应式布局
- 节点缩进在小屏幕上适当减少
- 工具栏按钮大小适合触摸
- 使用 `touch-manipulation` 优化触摸响应

## 🔄 数据同步

- 支持实时同步（使用 Supabase Realtime）
- 支持离线编辑（使用 IndexedDB）
- 版本历史（可选，类似笔记的版本历史）

## ✅ 可行性评估

| 功能 | 可行性 | 技术难度 | 备注 |
|------|--------|----------|------|
| 无限层级节点 | ✅ 高 | 低 | 树形数据结构，递归渲染 |
| 文本格式化 | ✅ 高 | 中 | 标记语法或富文本编辑 |
| 快捷键 | ✅ 高 | 低 | 键盘事件监听 |
| 拖拽重排 | ✅ 高 | 中 | 已有 @dnd-kit |
| 文档内嵌 | ✅ 高 | 中 | 类似双向链接实现 |
| 移动端拖拽 | ✅ 高 | 中 | TouchSensor 支持 |
| 自动保存 | ✅ 高 | 低 | 已有实现参考 |

**总体评估：完全可行** ✅

项目已有相关技术栈（@dnd-kit、Supabase、离线存储），实现思维笔记功能的技术基础完备。

