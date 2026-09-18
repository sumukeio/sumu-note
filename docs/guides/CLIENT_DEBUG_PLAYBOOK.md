# 客户端不可见失败排障 Playbook（真机 / WebView / 白屏）

> **状态**：[权威/现行]  
> **层级**：跨项目可复用工程经验（Level 2 装甲）；本仓库实现为样例指针  
> **来源**：Sumu Note issue002（iPhone 8 Plus / iOS 16.3.1 登录→工作台→进文件夹）  
> **配套**：结案案例 [`IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md`](./IOS_WEBKIT_AUTH_AND_DUAL_TRACK.md) · 认知手册第九章增补 · `AGENTS.md` 负向禁令 6–8

## 1. 何时启用本 Playbook

出现任一信号，优先走本套，而不是反复改业务代码「猜」：

| 信号 | 典型表现 |
| :--- | :--- |
| 真机白屏 / 永久转圈 | 桌面正常，手机无报错、无控制台 |
| 软跳后状态丢失 | `router.push` 后页面挂死或停在旧页 |
| 「成功了」但进不去 | Toast/文案已成功，目标路由未挂载 |
| 动态加载永不完成 | 大包 `import()` 无 `ok`，只有超时 |
| 调试手段本身踩坑 | 带 `?debug=1` 进受保护页反而更卡 |

**核心命题**：用户看不见 DevTools 时，系统必须提供**可复制的时间线证据**；否则 AI 与人类都会在幻觉里修 bug。

## 2. 整体思路（六步）

```text
① 假设分层（鉴权 / 导航 / Suspense / 大包 / 数据）
        ↓
② 关键路径打点（step 字符串时间线，落持久存储）
        ↓
③ 真机可见看板（开关默认关；复制 / 清空）
        ↓
④ 超时与信标（证明「卡在哪一层」，而非永远转圈）
        ↓
⑤ 按最后一条日志改根因（硬跳、handoff、移出 Suspense、降级轨）
        ↓
⑥ 排障完关开关；经验回写 Playbook / 负向禁令 / 单测
```

**原则**：先证明「停在哪」，再改「为什么停」；禁止在无日志证据时连续改三处以上。

## 3. 必备套件（新项目可抄）

### 3.1 日志管道

| 能力 | 要求 | Sumu 样例 |
| :--- | :--- | :--- |
| `push(step, detail?)` | 追加环形缓冲（如最近 50 条）；同步 `console.info` | `pushAuthDebug` |
| 持久化 | **跨软跳/硬跳仍在** → 优先 `localStorage`；勿只靠内存 | `sumu:auth-debug` |
| 读取 / 清空 | 看板轮询读取；一键清空 | `readAuthDebugLog` / `clearAuthDebugLog` |
| 一键复制 | 把时间线打成纯文本进剪贴板，方便微信/邮件发给排障人 | 看板应提供（推荐；本仓可按需补按钮） |

`step` 命名约定：`模块:动作`，例如 `handoff:marked`、`requireAuth:admit:storage`、`note-manager:import-timeout`。

### 3.2 页面日志看板

| 项 | 要求 |
| :--- | :--- |
| 位置 | 固定底栏或顶栏，高 z-index，可滚动 |
| 开关 | **默认关闭**；URL `?debugXxx=1` 打开，`=0` 关闭 |
| 开关存储 | **sessionStorage**（关标签失效）；禁止长期 localStorage 误开 |
| 安全 | **不参与鉴权**；不能当「后门登录」；勿在日志里打 Token/密码 |
| 跨页 | 挂在根 layout，避免只在首页看得见 |

Sumu：`AuthDebugPanel` + `isAuthDebugEnabled()`（`?debugAuth=1/0`）。

### 3.3 最早信标（html-boot）

在 React hydrate 之前用极短 inline script 写一条 `html-boot`：

- 证明：**HTML 已执行**（区分「整页没加载」vs「React 卡死」）
- 仍受 debug 开关约束，避免生产噪音

Sumu：`layout.tsx` 内联 boot + `AuthBootBeacon`。

### 3.4 超时可见化

凡「可能永不结束」的操作必须有上限，并打点：

| 类型 | 建议 | 失败态 |
| :--- | :--- | :--- |
| `import()` 大组件 | 10–15s | `*:import-timeout` + 返回/降级入口 |
| `getSession` / 网络 | 短重试 + 总超时 | 可见错误，禁止空 catch |
| 鉴权门 | safety-timeout | 回登录或明确文案 |

日志成对出现才算健康：`import-start` → `import-ok`；若只有 `timeout` 无 `ok`，就是大包/WebKit 问题，不是「再等一会」。

### 3.5 登录交接（handoff）

当「登录成功但下一页读不到 session」时：

1. 登录成功立刻 `markHandoff(user)`（**session + local 双写**）
2. **硬跳**目标页（`location.assign`），忌依赖软路由过渡
3. 目标页优先承认 handoff / 本地缓存用户，后台再校验 session
4. TTL（如 60s）过期自动清

Sumu：`markAuthHandoff` / `peekAuthHandoff` + `useRequireAuth` admit 路径。

## 4. 假设分层与日志判读

按时间线最后停留点归因：

| 最后可见 step 形态 | 优先怀疑 | 常见处置 |
| :--- | :--- | :--- |
| 无 `html-boot` | 没进站 / 开关未开 / 存储被禁 | 开 debug；查无痕/ITP |
| 有 boot，无业务 mount | 路由/Suspense/layout 卡死 | 鉴权移出 Suspense；去掉危险 `useSearchParams` 深链 |
| `admit` 后停转圈 | 首页壳 dynamic 过大 | 懒加载工作台 + 超时 |
| `*:import-start` 后仅 `timeout` | 大包在弱 WebKit 永不完成 | **降级轨**（轻量 UI）或拆包 |
| `load-error` / 空列表无错 | 数据/RLS/鉴权 | Fail-safe 文案 + 重试 |

issue002 实锤路径简述：

1. 静默进不去 → handoff + 硬跳  
2. 白屏「正在加载」→ 鉴权出 Suspense、去 dynamic/`useSearchParams` 陷阱  
3. 进文件夹永远转圈 → `note-manager:import-timeout` 无 `ok` → iPhone 轻量轨

## 5. 导航与调试开关的负向经验

1. **调试查询参数不要带进易 Suspense 的受保护路由**  
   - 错：`/dashboard?debugAuth=1` 触发 `useSearchParams` 卡死  
   - 对：在落地页写 session 开关，目标 URL 保持干净（Sumu：`dashboardUrlWithDebug()` → `/dashboard`）

2. **软跳 vs 硬跳**  
   - iOS WebKit 上登录后软跳常出现「URL 变了 / 没变但组件未挂载」  
   - 关键跨越（登录→工作台）默认硬跳 + handoff

3. **开关寿命**  
   - 调试开：session；日志内容：local（跨跳可见）  
   - 排障结束必须 `?debug=0` 或关标签，避免挡 UI（Dock/Toast）

4. **看板 z-index**  
   - 调试条很高时会挡业务底栏；业务操作条不要长期压在调试条下（或排障期改顶栏）

## 6. 能力探测与降级（双轨）

当日志证明「某端永远加载不起完整模块」：

1. 用可测的能力探测（UA / 特性）分流，**单测锁规则**  
2. 弱端给「可用子集」，强端给完整体验  
3. 砍掉矩阵写进文档，避免无底洞补齐  
4. 降级不是失败，是**可验证的产品决策**

Sumu：`shouldUseLightFolderNotes`（iPhone/iPod → `LightFolderNotes`）。

## 7. 新项目落地 Checklist

- [ ] `push/read/clear` + 环形缓冲 + console  
- [ ] 根 layout 看板：复制、清空；默认关；session 开关  
- [ ] `html-boot` 信标  
- [ ] 关键 `import`/鉴权有超时打点与可见失败态  
- [ ] 登录跨越：handoff 双写 + 硬跳（若目标平台含 WebKit/WebView）  
- [ ] debug 查询参数不污染受保护深链  
- [ ] 大包失败有降级或拆包计划，不靠「再转一会」  
- [ ] 核心 handoff/探测函数有单测；案例回写本 Playbook / AGENTS

## 8. 本仓库指针（实现）

| 模块 | 路径 |
| :--- | :--- |
| 日志 / handoff / 开关 | `src/lib/auth-login-handoff.ts` |
| 看板 | `src/components/AuthDebugPanel.tsx` |
| 启动信标 | `src/components/AuthBootBeacon.tsx`、`src/app/layout.tsx` |
| 鉴权门 | `src/hooks/useRequireAuth.tsx` |
| 大包超时 | `src/components/NoteFolderLazy.tsx`、`dashboard/page.tsx` |
| 双轨 | `src/lib/client-capability.ts`、`LightFolderNotes.tsx` |
| 单测 | `tests/lib/auth-login-handoff.test.ts`、`client-capability.test.ts` |

## 9. 与「猜代码」对照

| 低效 | 本 Playbook |
| :--- | :--- |
| 真机复述「进不去」无证据 | 复制时间线，看最后一条 step |
| 连续改 Auth / Router / UI | 先分层，一次只动卡点层 |
| 加 `console.log` 但用户看不到 | 页面看板 + 持久日志 |
| 永远转圈 | 超时打点 + 降级入口 |
| 调试开关常开挡业务 | session 开关 + 排障必关 |
