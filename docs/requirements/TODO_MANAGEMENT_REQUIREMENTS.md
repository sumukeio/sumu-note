# 任务管理功能需求文档

> 参考标准：滴答清单（TickTick）的设计和功能
> 本文档作为开发参考标准，确保功能完整性和一致性

## 一、核心功能

### 1.1 任务管理基础功能

#### 快速添加任务
- ⏳ **文本输入**：支持快速输入任务标题
- ⏳ **智能识别**：自动识别任务中的日期、时间、优先级信息
  - 示例："明天下午3点开会 #工作 @重要" → 自动设置日期、时间、标签、优先级
- ⏳ **语音输入**：支持语音转文字添加任务（可选，移动端）

#### 任务属性
- ⏳ **基础属性**：
  - 标题（必填）
  - 描述/备注（可选）
  - 创建时间
  - 更新时间
  - 完成时间
- ⏳ **日期时间**：
  - 截止日期（due_date）
  - 提醒时间（reminder_time）
  - 支持"今天"、"明天"、"下周一"等自然语言识别
- ⏳ **优先级**：
  - 高优先级（priority: 3）
  - 中优先级（priority: 2）
  - 低优先级（priority: 1）
  - 无优先级（priority: 0）
- ⏳ **标签系统**：
  - 支持多个标签（tags: string[]）
  - 标签颜色区分（可选）
  - 快速筛选
- ⏳ **清单/项目分组**：
  - 任务可以归属于某个清单（list_id）
  - 支持创建多个清单（工作、生活、学习等）
  - 清单可以设置颜色和图标

#### 子任务
- ⏳ **子任务支持**：
  - 任务可以包含多个子任务
  - 子任务可以独立完成
  - 父任务完成时，自动完成所有子任务（可选）
  - 子任务可以拖拽排序

#### 重复任务
- ⏳ **重复规则**：
  - 每日重复
  - 每周重复（可指定星期几）
  - 每月重复（可指定日期）
  - 每年重复
  - 自定义重复（每N天/周/月）
- ⏳ **重复截止**：
  - 永不截止
  - 重复N次后截止
  - 指定日期截止

### 1.2 多种视图模式

#### 列表视图
- ⏳ **传统待办列表**：
  - 显示所有任务
  - 支持按日期、优先级、标签排序
  - 支持筛选（已完成/未完成/全部）
  - 支持搜索

#### 日历视图
- ⏳ **日历展示**：
  - 按月/周/日显示任务
  - 任务显示在对应日期
  - 支持拖拽任务到不同日期
  - 显示任务时间（如果有设置）
  - 支持订阅第三方日历（Google Calendar、Outlook）（可选）

#### 看板视图（Kanban）
- ⏳ **看板列**：
  - 待办（To Do）
  - 进行中（In Progress）
  - 已完成（Done）
- ⏳ **看板功能**：
  - 任务卡片显示关键信息（标题、日期、优先级、标签）
  - 支持拖拽任务在不同列间移动
  - 支持自定义列（可选）
  - 支持按清单/标签分组显示

#### 四象限视图
- ⏳ **优先级矩阵**：
  - 重要且紧急（第一象限）
  - 重要不紧急（第二象限）
  - 不重要但紧急（第三象限）
  - 不重要不紧急（第四象限）
- ⏳ **自动分类**：
  - 根据截止日期和优先级自动分类
  - 支持手动调整

### 1.3 提醒系统

#### 提醒设置
- ⏳ **提醒时间**：
  - 任务截止时间提醒
  - 自定义提醒时间
  - 多个提醒时间（可选）
- ⏳ **提醒方式**：
  - 浏览器通知（Web Notification API）
  - 桌面通知（可选）
  - 邮件提醒（可选）
- ⏳ **位置提醒**（可选）：
  - 到达指定地点时提醒
  - 需要地理位置权限

### 1.4 任务操作

#### 基础操作
- ⏳ **创建任务**：快速创建新任务
- ⏳ **编辑任务**：修改任务属性
- ⏳ **完成任务**：标记为已完成
- ⏳ **删除任务**：删除任务（支持软删除）
- ⏳ **恢复任务**：从已完成/已删除中恢复

#### 批量操作
- ⏳ **批量选择**：
  - 多选任务
  - 批量完成
  - 批量删除
  - 批量移动清单
  - 批量设置标签
  - 批量设置优先级

#### 任务排序
- ⏳ **排序方式**：
  - 按创建时间
  - 按截止日期
  - 按优先级
  - 按标题（字母顺序）
  - 自定义排序（拖拽）

## 二、数据模型设计

### 2.1 数据库表结构

#### todos 表（任务表）
```sql
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id UUID REFERENCES todo_lists(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES todos(id) ON DELETE CASCADE, -- 子任务父ID
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0, -- 0:无, 1:低, 2:中, 3:高
  status TEXT DEFAULT 'todo', -- 'todo', 'in_progress', 'done', 'archived'
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
```

#### todo_lists 表（清单表）
```sql
CREATE TABLE todo_lists (
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
```

### 2.2 索引设计
```sql
-- todos 表索引
CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_list_id ON todos(list_id);
CREATE INDEX idx_todos_parent_id ON todos(parent_id);
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_todos_user_status ON todos(user_id, status);
CREATE INDEX idx_todos_user_list ON todos(user_id, list_id);

-- todo_lists 表索引
CREATE INDEX idx_todo_lists_user_id ON todo_lists(user_id);
```

### 2.3 RLS 策略
```sql
-- todos 表 RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

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

-- todo_lists 表 RLS
ALTER TABLE todo_lists ENABLE ROW LEVEL SECURITY;

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
```

## 三、UI/UX 设计规范

### 3.1 页面布局

#### 独立任务管理页面
- ⏳ **路由**：`/dashboard/todos`
- ⏳ **布局结构**：
  - 顶部导航栏（返回、标题、设置）
  - 左侧边栏（清单列表、视图切换）
  - 主内容区（任务列表/日历/看板）
  - 底部操作栏（快速添加任务）

#### 响应式设计
- ⏳ **桌面端**：
  - 左侧边栏固定显示
  - 主内容区自适应宽度
  - 支持拖拽操作
- ⏳ **移动端**：
  - 侧边栏可收起/展开
  - 底部操作栏固定
  - 触摸优化

### 3.2 视觉设计

#### 颜色系统
- ⏳ **优先级颜色**：
  - 高优先级：红色（#EF4444）
  - 中优先级：橙色（#F59E0B）
  - 低优先级：蓝色（#3B82F6）
  - 无优先级：灰色（#6B7280）
- ⏳ **状态颜色**：
  - 待办：默认颜色
  - 进行中：蓝色
  - 已完成：绿色（#10B981）
  - 已归档：灰色

#### 图标系统
- ⏳ **任务图标**：
  - 未完成：圆形复选框（○）
  - 已完成：圆形复选框（✓）
  - 子任务：缩进显示
- ⏳ **操作图标**：
  - 添加：加号（+）
  - 编辑：铅笔
  - 删除：垃圾桶
  - 更多：三个点

### 3.3 交互设计

#### 快速添加任务
- ⏳ **输入框**：
  - 固定在底部或顶部
  - 占位符："添加任务..."
  - 支持回车快速创建
  - 支持智能识别日期/时间/标签

#### 任务卡片
- ⏳ **显示信息**：
  - 标题（必显示）
  - 截止日期（如果有）
  - 优先级标识（颜色点）
  - 标签（标签块）
  - 子任务进度（X/Y）
- ⏳ **交互**：
  - 点击展开详情
  - 长按进入多选模式
  - 拖拽改变顺序/状态

#### 任务详情
- ⏳ **详情面板**：
  - 标题编辑
  - 描述编辑
  - 日期时间选择器
  - 优先级选择器
  - 标签选择器
  - 清单选择器
  - 重复规则设置
  - 子任务列表

## 四、功能特性

### 4.1 智能识别

#### 日期时间识别
- ⏳ **自然语言识别**：
  - "明天" → 明天
  - "下周一" → 下周一
  - "3月15日" → 3月15日
  - "下午3点" → 今天下午3点
  - "明天下午3点" → 明天下午3点
- ⏳ **识别规则**：
  - 使用正则表达式匹配
  - 解析后自动设置 due_date 和 reminder_time

#### 标签识别
- ⏳ **标签格式**：
  - "#工作" → 自动添加"工作"标签
  - "#生活" → 自动添加"生活"标签
- ⏳ **识别规则**：
  - 以 # 开头，后跟标签名
  - 自动创建新标签（如果不存在）

#### 优先级识别
- ⏳ **优先级格式**：
  - "@重要" → 高优先级
  - "@高" → 高优先级
  - "@中" → 中优先级
  - "@低" → 低优先级

### 4.2 筛选和搜索

#### 筛选功能
- ⏳ **筛选条件**：
  - 按状态（待办/进行中/已完成）
  - 按优先级
  - 按标签
  - 按清单
  - 按日期范围
- ⏳ **组合筛选**：
  - 支持多个条件组合
  - 保存常用筛选（可选）

#### 搜索功能
- ⏳ **搜索范围**：
  - 任务标题
  - 任务描述
  - 标签
- ⏳ **搜索高亮**：
  - 搜索结果中高亮关键词
  - 支持正则表达式（可选）

### 4.3 数据统计

#### 统计信息
- ⏳ **完成率统计**：
  - 今日完成数/总数
  - 本周完成数/总数
  - 本月完成数/总数
- ⏳ **时间分布**：
  - 按日期统计任务数
  - 按优先级统计
  - 按标签统计

## 五、技术规范

### 5.1 数据结构（TypeScript）

```typescript
// 任务接口
interface Todo {
  id: string;
  user_id: string;
  list_id: string | null;
  parent_id: string | null;
  title: string;
  description: string | null;
  priority: 0 | 1 | 2 | 3; // 0:无, 1:低, 2:中, 3:高
  status: 'todo' | 'in_progress' | 'done' | 'archived';
  due_date: string | null;
  reminder_time: string | null;
  completed_at: string | null;
  order_index: number;
  tags: string[];
  repeat_rule: RepeatRule | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// 重复规则接口
interface RepeatRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval: number; // 间隔（如每2天）
  days_of_week?: number[]; // 每周的星期几（0-6，0=周日）
  day_of_month?: number; // 每月的第几天
  end_date?: string | null; // 结束日期
  end_after_count?: number | null; // 重复N次后结束
}

// 清单接口
interface TodoList {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  order_index: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
```

### 5.2 API 规范

#### 任务相关 API
- ⏳ `GET /api/todos` - 获取任务列表（支持筛选、排序、分页）
- ⏳ `GET /api/todos/:id` - 获取单个任务详情
- ⏳ `POST /api/todos` - 创建任务
- ⏳ `PUT /api/todos/:id` - 更新任务
- ⏳ `DELETE /api/todos/:id` - 删除任务
- ⏳ `POST /api/todos/:id/complete` - 完成任务
- ⏳ `POST /api/todos/:id/uncomplete` - 取消完成
- ⏳ `POST /api/todos/batch` - 批量操作

#### 清单相关 API
- ⏳ `GET /api/todo-lists` - 获取清单列表
- ⏳ `POST /api/todo-lists` - 创建清单
- ⏳ `PUT /api/todo-lists/:id` - 更新清单
- ⏳ `DELETE /api/todo-lists/:id` - 删除清单

### 5.3 状态管理

- ⏳ **本地状态**：使用 React state 管理任务列表
- ⏳ **乐观更新**：操作后立即更新 UI，异步保存到数据库
- ⏳ **错误处理**：操作失败时回滚到之前状态
- ⏳ **缓存策略**：使用 React Query 或 SWR 缓存数据

## 六、性能优化

### 6.1 数据加载
- ⏳ **分页加载**：大量任务时使用分页
- ⏳ **虚拟滚动**：列表视图使用虚拟滚动
- ⏳ **懒加载**：子任务按需加载

### 6.2 渲染优化
- ⏳ **防抖保存**：编辑时使用防抖，减少 API 调用
- ⏳ **批量更新**：拖拽排序时批量更新
- ⏳ **Memo 优化**：使用 React.memo 优化组件渲染

## 七、测试检查清单

### 7.1 基础功能
- [ ] 创建、编辑、删除任务
- [ ] 完成任务/取消完成
- [ ] 创建、编辑、删除清单
- [ ] 任务移动到不同清单
- [ ] 子任务创建和管理

### 7.2 视图功能
- [ ] 列表视图显示和操作
- [ ] 日历视图显示和拖拽
- [ ] 看板视图显示和拖拽
- [ ] 四象限视图分类

### 7.3 高级功能
- [ ] 智能识别日期/时间/标签/优先级
- [ ] 重复任务创建和完成
- [ ] 提醒通知
- [ ] 筛选和搜索

### 7.4 边界情况
- [ ] 空任务处理
- [ ] 大量任务（1000+）性能
- [ ] 深层嵌套子任务
- [ ] 网络错误处理
- [ ] 并发操作处理

## 八、已知问题和待优化

### 8.1 已知问题
- 暂无

### 8.2 待优化
- [ ] 实时同步（多端协作）
- [ ] 离线支持
- [ ] 数据导出（CSV/JSON）
- [ ] 任务模板
- [ ] 任务评论（协作功能）

---

## 更新日志

- **2025-01-XX**：创建需求文档

---

## 参考资源

- [滴答清单官网](https://dida365.com/)
- [TickTick 官网](https://ticktick.com/)
- [Todoist - 任务管理工具](https://todoist.com/)
- [Things - 任务管理工具](https://culturedcode.com/things/)

