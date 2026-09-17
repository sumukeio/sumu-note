"use client";

import { useEffect, useState } from "react";
import {
  isAuthDebugEnabled,
  readAuthDebugLog,
  pushAuthDebug,
} from "@/lib/auth-login-handoff";
import { getAuthStorageMode } from "@/lib/supabase";

/**
 * 手机排错：打开任意页加 ?debugAuth=1（写入 localStorage），根 layout 底部常驻绿条。
 * 关闭：/?debugAuth=0
 */
export default function AuthDebugPanel() {
  const [lines, setLines] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const on = isAuthDebugEnabled();
    setEnabled(on);
    if (!on) return;
    pushAuthDebug("debug-panel:mount", {
      path: window.location.pathname + window.location.search,
      storageMode: getAuthStorageMode(),
    });
    const tick = () => {
      const log = readAuthDebugLog();
      setLines(
        log.map((e) => {
          const time = new Date(e.t).toLocaleTimeString();
          const detail =
            e.detail === undefined
              ? ""
              : ` ${
                  typeof e.detail === "string"
                    ? e.detail
                    : JSON.stringify(e.detail)
                }`;
          return `${time} ${e.step}${detail}`;
        })
      );
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, []);

  if (!enabled) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] max-h-[45vh] overflow-auto bg-black/95 text-green-300 text-[10px] leading-snug p-2 font-mono border-t-2 border-green-500 pointer-events-auto"
      data-auth-debug-panel
    >
      <div className="text-green-100 mb-1 font-bold sticky top-0 bg-black/95">
        Sumu Auth Debug · path 见下方首条 mount · storage=
        {getAuthStorageMode()}
      </div>
      {lines.length === 0 ? (
        <div>暂无日志（若刚跳转，等 1 秒…）</div>
      ) : (
        lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-all border-b border-green-900/50 py-0.5">
            {l}
          </div>
        ))
      )}
    </div>
  );
}
