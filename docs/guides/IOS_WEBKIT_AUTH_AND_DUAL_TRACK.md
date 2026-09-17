# iOS WebKit 鉴权与双轨文件夹（issue002 结案说明）

> **状态**：[权威/现行]  
> **关联**：issue002 · task011–task020 · 2026-09-17 关闭  
> **环境锚点**：iPhone 8 Plus · iOS 16.3.1（多浏览器复现）

## 结论（一句话）

旧机 iOS WebKit 上「登录进不去 / 白屏转圈 / 进文件夹卡死」不是单一浏览器问题，而是 **鉴权导航陷阱 + NoteManager 大包动态加载永不完成**；现已用 **硬跳 handoff + 双轨 UI** 落地可用路径。

## 根因簇

| 簇 | 现象 | 根因 |
| :--- | :--- | :--- |
| A 鉴权导航 | 登录成功仍进不去 / 软跳留首页 | `getSession` 在 WebKit 上挂死或空；软路由过渡未挂载 dashboard |
| B Suspense | 白屏「正在验证/加载工作台」 | `useSearchParams` + `dynamic` + Suspense 在 iOS 上卡住 |
| C 大包加载 | 能进工作台，点文件夹永远转圈 | `NoteManager` 动态 import 超时（日志：`import-timeout`，无 `import-ok`） |

## 修复链路（task011–020）

1. **登录放行**：`auth-login-handoff`（session+local 双写）→ 硬跳 `/dashboard`；`getSession` 短重试。
2. **鉴权壳**：鉴权移出 Suspense；去掉易卡死的 dynamic/`useSearchParams` 深链依赖；首页禁止自动跳（手动「进入工作台」）。
3. **双轨文件夹**（`shouldUseLightFolderNotes`）：
   - **iPhone / iPod** → 增强轻量 `LightFolderNotes`（列表/新建/textarea 编辑、置顶、回收站、移动、子文件夹多选、顶栏多选操作、简化版本历史/缓存）。
   - **安卓 / PC / iPad** → 完整 `NoteManager`（动态加载）。
4. **轻量侧 UX**：多选顶栏四格图标、去掉挡 Toast 的底栏 Dock、chrome `select-none`、正文 `select-text`。
5. **调试卫生**：`?debugAuth=1` 仅 **sessionStorage**（关标签失效）；**不参与鉴权、不能绕过登录**；排障完用 `/?debugAuth=0`。

## 能力探测

- 代码：`src/lib/client-capability.ts`
- 单测：`tests/lib/client-capability.test.ts`
- 规则：UA 含 iPhone/iPod → 轻量；其余完整（含 iPad）。

## 手测清单（回归）

**iPhone（轻量）**

- [ ] 登录 → 首页点「进入工作台」→ 见文件夹列表
- [ ] 进文件夹：可新建笔记/文件夹、打开编辑、保存有 Toast
- [ ] 多选：顶栏「已选 N」+ 图标操作；Toast 不被挡
- [ ] 默认无调试绿条；临时 `/?debugAuth=1` 可见，关标签后消失

**安卓 / PC / iPad（完整）**

- [ ] 进文件夹为完整编辑器（分段/格式等）
- [ ] 登录与最近打开仍可用

## 轻量侧：已经增强到哪、还缺什么

**已经做完（issue002 关闭所需，不算「还没增强」）**

- 列表 / 新建 / textarea 读写保存
- 置顶、回收站、批量移动/删除
- 子文件夹：进入、多选、新建文件夹、移动、级联删除
- 顶栏多选操作、同步提示、简化版本历史与列表缓存
- chrome `select-none`、正文可选

**故意砍掉的（双轨矩阵，产品已接受）**

分段编辑、表格、格式条、发布、拖拽 Dock、补全、字数条等——完整侧仍由 NoteManager 提供。

**「轻量功能增量」是什么意思？**

= **可选**地把上述砍掉项里用户真正痛的少数能力，再补进 `LightFolderNotes`。  
≠ 轻量还没做；≠ 安卓/PC 缺功能（安卓/PC/iPad 已走完整轨）。  
**只有**当 iPhone 用户明确需要某项完整能力、又不想/不能上 NoteManager 时，才值得立项。

## 可选后续（均非必须、均未立项）

### 1）NoteManager 拆包——主要服务谁？

| 问题 | 答案 |
| :--- | :--- |
| 为修安卓/PC 现网故障？ | **否**。安卓/PC/iPad 已能加载完整 NoteManager，issue002 不依赖拆包。 |
| 那为什么提？ | 完整包太大是旧 iPhone `import-timeout` 的根因之一；拆包可 **缩短安卓/PC/iPad 首屏**、降低中端机超时风险，并为「将来缩小双轨差距」留空间。 |
| 优先级 | **低**。性能/架构债，有体感或指标再开 phase。 |

### 2）轻量功能增量——主要服务谁？

| 问题 | 答案 |
| :--- | :--- |
| 针对安卓/PC？ | **否**。只影响 **iPhone/iPod 轻量轨**。 |
| 轻量还没增强吗？ | **已经增强**（见上一节）；增量 = 在砍掉矩阵里按需加回。 |
| 优先级 | **按需**。无明确痛点则不做，避免双轨维护成本膨胀。 |

### 3）运维 SQL（与其它 issue 共用，仍建议有空执行）

- `docs/sql/allow_select_published_notes.sql`
- `docs/sql/create_user_recent_notes.sql`

## 关键文件

| 路径 | 职责 |
| :--- | :--- |
| `src/lib/auth-login-handoff.ts` | handoff / debugAuth |
| `src/hooks/useRequireAuth.tsx` | 鉴权门 |
| `src/lib/client-capability.ts` | 双轨探测 |
| `src/components/LightFolderNotes.tsx` | iPhone 轻量文件夹 |
| `src/app/dashboard/DashboardHomeClient.tsx` | 分流入口 |
| `src/components/AuthDebugPanel.tsx` | 调试条（默认关） |
