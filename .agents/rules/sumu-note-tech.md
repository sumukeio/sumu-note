# Sumu Note 技术栈（摘要）

> **仲裁**：以根目录 `AGENTS.md` 第六节为准。  
> 原模板中的 `data-platform-tech` 不适用于本仓库，已替换为本文件。

## 栈

- Next.js App Router + React + TypeScript
- Supabase（Auth / DB / Storage / Realtime）
- Tailwind + Radix UI 组件（`src/components/ui`）
- Vitest（`tests/`）

## 命令

- `npm run dev` / `build` / `type-check` / `test` / `lint`

## 分层

- `src/app` 路由；`src/components` UI；`src/lib` 逻辑；`src/hooks`；`src/types`

## 注意

- 破坏性变更（RLS、公开链接语义、Storage 公开性）先写 ADR。
- 移动端编辑改动必须考虑 `visualViewport` / 键盘遮挡（负向禁令）。
