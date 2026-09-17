"use client";

import { useEffect } from "react";
import { pushAuthDebug, isAuthDebugEnabled } from "@/lib/auth-login-handoff";

/**
 * 尽早写入 boot 信标，证明当前 URL 的 JS 已执行（不依赖 dashboard 大包）。
 */
export default function AuthBootBeacon() {
  useEffect(() => {
    if (!isAuthDebugEnabled()) return;
    pushAuthDebug("boot", {
      path: window.location.pathname + window.location.search,
      ua: navigator.userAgent.slice(0, 80),
    });
  }, []);
  return null;
}
