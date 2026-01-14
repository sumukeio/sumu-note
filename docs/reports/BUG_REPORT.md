# Next.js 项目 Bug 报告

## 文档说明

本文档记录了在开发过程中遇到的所有 bug，以及 Next.js 项目常见的 bug 类型和解决方案。本文档将作为项目维护和开发参考。

---

## 目录

1. [Next.js 常见 Bug 类型](#nextjs-常见-bug-类型)
2. [实际遇到的 Bug 案例](#实际遇到的-bug-案例)
3. [Bug 预防建议](#bug-预防建议)
4. [调试技巧](#调试技巧)

---

## Next.js 常见 Bug 类型

### 1. 认证和会话管理

#### 1.1 Refresh Token 失效
**常见场景：**
- 用户长时间未操作，refresh token 过期
- 多设备登录导致 token 冲突
- 服务器端 token 被清除但客户端仍保留

**典型错误：**
```
AuthApiError Invalid Refresh Token: Refresh Token Not Found
JWT expired
Invalid Refresh Token
```

**解决方案：**
- 实现全局错误处理，检测 refresh token 错误
- 自动清除本地 session 并重定向到登录页
- 使用 `handleAuthError` 工具函数统一处理

#### 1.2 会话持久化问题
**常见场景：**
- 页面刷新后用户状态丢失
- 跨标签页状态不同步
- SSR/CSR 状态不一致

**解决方案：**
- 配置 Supabase 客户端使用 `persistSession: true`
- 使用 `localStorage` 或 `sessionStorage` 持久化
- 实现服务端和客户端状态同步

---

### 2. TypeScript 和 JSX 语法错误

#### 2.1 JSX 在 .ts 文件中使用
**常见场景：**
- 在 `.ts` 文件中直接使用 JSX 语法
- 工具函数返回 JSX 元素但文件扩展名错误

**典型错误：**
```
Parsing ecmascript source code failed
Expected '>', got 'key'
```

**解决方案：**
- 将文件扩展名改为 `.tsx`
- 或使用 `React.createElement` 替代 JSX 语法
- 确保工具函数文件使用正确的扩展名

**案例代码：**
```typescript
// ❌ 错误：在 .ts 文件中使用 JSX
export function highlightText(text: string, query: string) {
  return <mark>{text}</mark>;
}

// ✅ 正确：使用 React.createElement
export function highlightText(text: string, query: string) {
  return React.createElement("mark", null, text);
}

// ✅ 正确：将文件改为 .tsx
// highlightText.tsx
export function highlightText(text: string, query: string) {
  return <mark>{text}</mark>;
}
```

#### 2.2 类型导入错误
**常见场景：**
- 导入不存在的导出
- 导入路径错误
- 类型和值混用

**典型错误：**
```
Export highlightText doesn't exist in target module
Module not found: Can't resolve '@/lib/todo-utils'
```

**解决方案：**
- 检查导出是否存在
- 使用 IDE 的自动导入功能
- 区分类型导入和值导入：`import type { ... }`

---

### 3. React Hooks 和状态管理

#### 3.1 状态更新使用旧值
**常见场景：**
- 在 `useState` 更新中使用旧的 state 值
- 闭包捕获旧的状态值
- 异步操作中使用过期的状态

**典型错误：**
```typescript
// ❌ 错误：使用旧的状态值
const handleListDeleted = (listId: string) => {
  setLists((prev) => prev.filter((list) => list.id !== listId));
  if (selectedListId === listId) {
    // 这里使用的是旧的 lists，可能找不到默认清单
    const defaultList = lists.find((list) => list.is_default && list.id !== listId);
    setSelectedListId(defaultList?.id || null);
  }
};

// ✅ 正确：使用更新后的状态
const handleListDeleted = (listId: string) => {
  setLists((prev) => {
    const newLists = prev.filter((list) => list.id !== listId);
    // 使用更新后的列表
    if (selectedListId === listId) {
      const defaultList = newLists.find((list) => list.is_default);
      setSelectedListId(defaultList?.id || newLists[0]?.id || null);
    }
    return newLists;
  });
};
```

#### 3.2 未使用的状态变量
**常见场景：**
- 声明了状态但从未使用
- 重构后遗留的旧状态
- 调试代码未清理

**典型错误：**
```typescript
// ❌ 错误：声明了但未使用
const [updateTodo] = useState<{ id: string; status: KanbanColumn } | null>(null);

// ✅ 正确：删除未使用的状态
// 直接移除这行代码
```

#### 3.3 useEffect 依赖项问题
**常见场景：**
- 缺少依赖项导致闭包问题
- 依赖项过多导致无限循环
- 对象/数组依赖项引用变化

**解决方案：**
- 使用 ESLint 的 `exhaustive-deps` 规则
- 使用 `useCallback` 和 `useMemo` 稳定引用
- 仔细检查依赖项数组

---

### 4. 异步操作和错误处理

#### 4.1 未处理的 Promise 拒绝
**常见场景：**
- `async/await` 未使用 `try-catch`
- 忘记处理错误情况
- 错误信息未正确显示给用户

**典型错误：**
```typescript
// ❌ 错误：未处理错误
const loadData = async () => {
  const data = await fetchData(); // 如果失败会抛出错误
  setData(data);
};

// ✅ 正确：处理错误
const loadData = async () => {
  try {
    const data = await fetchData();
    setData(data);
  } catch (error) {
    console.error("Failed to load data:", error);
    // 显示错误提示给用户
    setError("加载失败，请重试");
  }
};
```

#### 4.2 竞态条件
**常见场景：**
- 快速连续触发多个请求
- 旧请求覆盖新请求的结果
- 组件卸载后仍更新状态

**解决方案：**
- 使用 `AbortController` 取消请求
- 检查组件是否已卸载
- 使用请求 ID 或时间戳验证

---

### 5. 路由和导航

#### 5.1 路由参数类型错误
**常见场景：**
- 路由参数可能是 `undefined`
- 类型断言不正确
- 动态路由参数未验证

**解决方案：**
- 使用类型守卫验证参数
- 提供默认值或重定向
- 使用 `zod` 等库验证参数

#### 5.2 客户端/服务端路由不一致
**常见场景：**
- SSR 和 CSR 渲染结果不同
- 路由参数在服务端和客户端不一致
- 重定向循环

**解决方案：**
- 使用 `useRouter` 进行客户端导航
- 在服务端使用 `redirect` 函数
- 统一路由逻辑

---

### 6. 样式和响应式设计

#### 6.1 Tailwind CSS 类名未生效
**常见场景：**
- 动态类名未正确拼接
- 条件类名逻辑错误
- 类名被其他样式覆盖

**解决方案：**
- 使用 `cn()` 工具函数合并类名
- 检查 Tailwind 配置和构建
- 使用浏览器开发者工具检查

#### 6.2 移动端适配问题
**常见场景：**
- 固定宽度导致移动端溢出
- 触摸交互不响应
- 字体大小在小屏幕上过小

**解决方案：**
- 使用响应式类名：`sm:`, `md:`, `lg:`
- 测试不同屏幕尺寸
- 使用移动端优先的设计方法

---

### 7. 数据获取和缓存

#### 7.1 数据未刷新
**常见场景：**
- 缓存导致显示旧数据
- 更新后未重新获取数据
- 乐观更新失败后未回滚

**解决方案：**
- 使用 `refreshKey` 强制刷新
- 实现乐观更新和错误回滚
- 使用 React Query 等数据获取库

#### 7.2 无限循环请求
**常见场景：**
- `useEffect` 依赖项导致重复请求
- 状态更新触发新的请求
- 缺少请求去重机制

**解决方案：**
- 使用 `useCallback` 稳定函数引用
- 实现请求去重
- 添加加载状态防止重复请求

---

### 8. 第三方库集成

#### 8.1 库版本不兼容
**常见场景：**
- 依赖版本冲突
- API 变更未更新代码
- 类型定义不匹配

**解决方案：**
- 使用 `npm audit` 检查依赖
- 阅读库的迁移指南
- 锁定依赖版本

#### 8.2 库配置错误
**常见场景：**
- Supabase 客户端配置错误
- 拖拽库传感器配置不当
- 日期库时区问题

**解决方案：**
- 仔细阅读库文档
- 检查配置选项
- 使用官方示例作为参考

---

## 实际遇到的 Bug 案例

### 案例 1: Refresh Token 失效错误

**Bug 描述：**
用户在使用应用时，控制台出现错误：`AuthApiError Invalid Refresh Token: Refresh Token Not Found`，导致用户被意外登出。

**错误信息：**
```
Console AuthApiError Invalid Refresh Token: Refresh Token Not Found
```

**根本原因：**
1. Supabase 客户端未正确配置会话持久化
2. 缺少全局错误处理机制
3. Refresh token 过期后未正确处理

**解决方案：**

1. **配置 Supabase 客户端** (`src/lib/supabase.ts`)：
```typescript
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'supabase.auth.token',
  },
});
```

2. **创建错误处理工具函数**：
```typescript
export async function handleAuthError(error: AuthError | null | undefined): Promise<boolean> {
  if (!error) return false;

  const errorMessage = error.message || '';
  const isRefreshTokenError =
    errorMessage.includes("Refresh Token") ||
    errorMessage.includes("JWT") ||
    errorMessage.includes("Invalid Refresh Token") ||
    errorMessage.includes("Refresh Token Not Found");

  if (isRefreshTokenError) {
    console.warn("Refresh token error detected, signing out:", errorMessage);
    await supabase.auth.signOut();
    return true;
  }

  return false;
}
```

3. **在所有认证相关组件中使用**：
```typescript
const { data: { user }, error } = await supabase.auth.getUser();
if (await handleAuthError(error)) {
  router.push('/');
  return;
}
```

**影响范围：**
- `src/lib/supabase.ts`
- `src/app/dashboard/page.tsx`
- `src/app/page.tsx`
- `src/app/dashboard/mind-notes/MindNotesPageClient.tsx`
- `src/app/dashboard/mind-notes/[id]/page.tsx`
- `src/app/dashboard/stats/page.tsx`
- `src/app/auth/callback/page.tsx`

**修复状态：** ✅ 已修复

---

### 案例 2: highlightText 函数导入错误

**Bug 描述：**
编译错误：`Export highlightText doesn't exist in target module`，导致应用无法启动。

**错误信息：**
```
./src/components/TodoItem.tsx:6:1
Export highlightText doesn't exist in target module
  6 | import { formatDueDate, getPriorityColor, highlightText } from "@/lib/todo-utils";
```

**根本原因：**
- `TodoItem.tsx` 导入了 `highlightText` 函数
- 但 `todo-utils.ts` 中未实现该函数
- 函数在需求文档中提到但未实现

**解决方案：**

在 `src/lib/todo-utils.ts` 中添加 `highlightText` 函数：

```typescript
/**
 * 高亮文本中的关键词
 * 返回包含 <mark> 标签的 JSX 元素
 */
export function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let index = textLower.indexOf(queryLower, lastIndex);

  while (index !== -1) {
    // 添加高亮前的文本
    if (index > lastIndex) {
      parts.push(text.substring(lastIndex, index));
    }

    // 添加高亮文本
    parts.push(
      React.createElement(
        "mark",
        {
          key: index,
          className: "bg-yellow-200 dark:bg-yellow-800 rounded px-0.5",
        },
        text.substring(index, index + query.length)
      )
    );

    lastIndex = index + query.length;
    index = textLower.indexOf(queryLower, lastIndex);
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? React.createElement(React.Fragment, null, ...parts) : text;
}
```

**注意：** 由于文件是 `.ts` 而不是 `.tsx`，必须使用 `React.createElement` 而不是 JSX 语法。

**影响范围：**
- `src/lib/todo-utils.ts`
- `src/components/TodoItem.tsx`

**修复状态：** ✅ 已修复

---

### 案例 3: JSX 语法在 .ts 文件中使用

**Bug 描述：**
编译错误：`Parsing ecmascript source code failed`，在 `.ts` 文件中使用了 JSX 语法。

**错误信息：**
```
./src/lib/todo-utils.ts:610:13
Parsing ecmascript source code failed
> 610 |       <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
      |             ^^^
Expected '>', got 'key'
```

**根本原因：**
- 在 `.ts` 文件中直接使用了 JSX 语法
- TypeScript 编译器无法解析 JSX（需要 `.tsx` 扩展名）

**解决方案：**

将 JSX 语法改为 `React.createElement`：

```typescript
// ❌ 错误：在 .ts 文件中使用 JSX
parts.push(
  <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
    {text.substring(index, index + query.length)}
  </mark>
);

// ✅ 正确：使用 React.createElement
parts.push(
  React.createElement(
    "mark",
    {
      key: index,
      className: "bg-yellow-200 dark:bg-yellow-800 rounded px-0.5",
    },
    text.substring(index, index + query.length)
  )
);
```

**替代方案：**
- 将文件扩展名改为 `.tsx`（如果项目允许）
- 但保持 `.ts` 更符合工具函数的约定

**影响范围：**
- `src/lib/todo-utils.ts`

**修复状态：** ✅ 已修复

---

### 案例 4: 状态更新使用旧值

**Bug 描述：**
删除清单后，如果删除的是当前选中的清单，系统无法正确切换到默认清单。

**错误代码：**
```typescript
const handleListDeleted = (listId: string) => {
  setLists((prev) => prev.filter((list) => list.id !== listId));
  if (selectedListId === listId) {
    // ❌ 问题：这里使用的是旧的 lists 状态
    const defaultList = lists.find((list) => list.is_default && list.id !== listId);
    setSelectedListId(defaultList?.id || null);
  }
};
```

**根本原因：**
- React 状态更新是异步的
- 在 `setLists` 后立即使用 `lists`，获取的是旧值
- 闭包捕获了旧的状态值

**解决方案：**

使用函数式更新，在更新过程中计算新值：

```typescript
const handleListDeleted = (listId: string) => {
  setLists((prev) => {
    const newLists = prev.filter((list) => list.id !== listId);
    // ✅ 使用更新后的列表
    if (selectedListId === listId) {
      const defaultList = newLists.find((list) => list.is_default);
      setSelectedListId(defaultList?.id || newLists[0]?.id || null);
    }
    return newLists;
  });
};
```

**更好的方案：**

使用 `useEffect` 监听 `lists` 变化：

```typescript
const handleListDeleted = (listId: string) => {
  setLists((prev) => prev.filter((list) => list.id !== listId));
};

useEffect(() => {
  if (selectedListId && !lists.find(list => list.id === selectedListId)) {
    const defaultList = lists.find((list) => list.is_default);
    setSelectedListId(defaultList?.id || lists[0]?.id || null);
  }
}, [lists, selectedListId]);
```

**影响范围：**
- `src/components/TodoManager.tsx`

**修复状态：** ✅ 已修复

---

### 案例 5: 未使用的状态变量

**Bug 描述：**
代码中声明了状态变量但从未使用，造成代码冗余和潜在混淆。

**错误代码：**
```typescript
const [activeId, setActiveId] = useState<string | null>(null);
const [updateTodo] = useState<{ id: string; status: KanbanColumn } | null>(null);
// ❌ updateTodo 从未使用
```

**根本原因：**
- 重构过程中遗留的代码
- 调试代码未清理
- 计划使用但最终未实现

**解决方案：**

直接删除未使用的状态：

```typescript
const [activeId, setActiveId] = useState<string | null>(null);
// ✅ 删除未使用的 updateTodo
```

**预防措施：**
- 使用 ESLint 规则 `@typescript-eslint/no-unused-vars`
- 定期代码审查
- 使用 IDE 的未使用变量检测

**影响范围：**
- `src/components/TodoKanban.tsx`

**修复状态：** ✅ 已修复

---

### 案例 6: 空值安全检查缺失

**Bug 描述：**
在筛选和搜索功能中，访问 `todo.tags` 时未检查其是否存在，可能导致运行时错误。

**潜在问题代码：**
```typescript
// ❌ 潜在问题：todo.tags 可能为 undefined
filtered = filtered.filter((todo) =>
  filters.tags!.some((tag) => todo.tags.includes(tag))
);
```

**根本原因：**
- 虽然 TypeScript 类型定义 `tags: string[]`，但实际数据可能不完整
- 从数据库获取的数据可能缺少某些字段
- 防御性编程不足

**解决方案：**

添加空值检查：

```typescript
// ✅ 正确：检查 tags 是否存在
if (filters.tags && filters.tags.length > 0) {
  filtered = filtered.filter((todo) =>
    todo.tags && filters.tags!.some((tag) => todo.tags.includes(tag))
  );
}

// ✅ 搜索功能中也添加检查
filtered = filtered.filter(
  (todo) =>
    todo.title.toLowerCase().includes(searchLower) ||
    (todo.description &&
      todo.description.toLowerCase().includes(searchLower)) ||
    (todo.tags && todo.tags.some((tag) => tag.toLowerCase().includes(searchLower)))
);
```

**影响范围：**
- `src/lib/todo-utils.ts`

**修复状态：** ✅ 已修复

---

## Bug 预防建议

### 1. 代码规范

- **使用 TypeScript 严格模式**
- **启用 ESLint 和 Prettier**
- **使用类型守卫验证数据**
- **避免使用 `any` 类型**

### 2. 测试策略

- **单元测试**：测试工具函数和业务逻辑
- **集成测试**：测试组件交互
- **E2E 测试**：测试完整用户流程
- **类型测试**：使用 `tsd` 测试类型定义

### 3. 代码审查

- **Pull Request 审查清单**
- **自动化 CI/CD 检查**
- **代码质量工具**（SonarQube 等）
- **定期重构和清理**

### 4. 错误处理

- **全局错误边界**
- **统一错误处理函数**
- **用户友好的错误提示**
- **错误日志记录**

### 5. 文档和注释

- **代码注释**：解释复杂逻辑
- **类型定义**：清晰的接口文档
- **变更日志**：记录重要修改
- **README**：项目使用说明

---

## 调试技巧

### 1. 使用浏览器开发者工具

- **Console**：查看错误和日志
- **Network**：检查 API 请求
- **React DevTools**：检查组件状态
- **Sources**：断点调试

### 2. Next.js 特定调试

- **检查编译错误**：终端输出
- **查看服务端日志**：服务器控制台
- **使用 `console.log`**：在服务端和客户端分别输出
- **检查构建输出**：`.next` 目录

### 3. TypeScript 调试

- **类型检查**：`tsc --noEmit`
- **类型定义**：使用 IDE 的类型提示
- **类型断言**：谨慎使用 `as`
- **类型守卫**：运行时类型检查

### 4. React 调试

- **React DevTools Profiler**：性能分析
- **Strict Mode**：检测副作用
- **useEffect 依赖**：检查依赖项
- **状态更新日志**：使用 `useEffect` 监听状态

### 5. 常见调试命令

```bash
# 类型检查
npm run type-check

# 代码检查
npm run lint

# 构建检查
npm run build

# 开发模式（详细日志）
npm run dev -- --debug
```

---

## Bug 统计

### 按类型分类

| Bug 类型 | 数量 | 严重程度 |
|---------|------|---------|
| 认证和会话 | 1 | 高 |
| TypeScript/JSX | 2 | 中 |
| React Hooks | 2 | 中 |
| 空值安全 | 1 | 低 |
| **总计** | **6** | - |

### 按严重程度分类

- **高**：1 个（认证错误，影响用户体验）
- **中**：4 个（编译错误，功能异常）
- **低**：1 个（代码质量，潜在问题）

### 修复时间

- 平均修复时间：15-30 分钟
- 最长修复时间：1 小时（认证错误，需要全局检查）
- 最短修复时间：5 分钟（删除未使用变量）

---

## 总结

通过记录和分析这些 bug，我们能够：

1. **提高代码质量**：避免重复相同的错误
2. **加快开发速度**：快速定位和修复问题
3. **改善用户体验**：减少生产环境的错误
4. **知识积累**：形成项目特定的最佳实践

**建议：**
- 定期更新本文档
- 在代码审查时参考本文档
- 新成员入职时阅读本文档
- 重大重构前检查相关 bug 案例

---

**文档版本：** 1.0  
**最后更新：** 2024年  
**维护者：** 开发团队

