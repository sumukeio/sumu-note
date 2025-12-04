"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// 🔥 修复点：不再去 import 那个不存在的路径
// 而是直接使用 React.ComponentProps 来自动获取 NextThemesProvider 的类型
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}