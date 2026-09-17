"use client";

import { useEffect, useState } from "react";
import {
  isAuthDebugEnabled,
  readAuthDebugLog,
  pushAuthDebug,
} from "@/lib/auth-login-handoff";
import { getAuthStorageMode } from "@/lib/supabase";

/**
 * 手机排错用：URL 加 ?debugAuth=1 或 localStorage.setItem('sumu:debugAuth','1')
 * 在页底显示最近鉴权步骤（无需接 Mac）。
 */
export default function AuthDebugPanel() {
  const [lines, setLines] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const on = isAuthDebugEnabled();
    setEnabled(on);
    if (!on) return;
    pushAuthDebug("debug-panel:mount", {
      path: window.location.pathname,
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
              : ` ${typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail)}`;
          return `${time} ${e.step}${detail}`;
        })
      );
    };
    tick();
    const id = window.setInterval(tick, 800);
    return () => window.clearInterval(id);
  }, []);

  if (!enabled) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[200] max-h-[40vh] overflow-auto bg-black/90 text-green-300 text-[10px] leading-snug p-2 font-mono border-t border-green-700"
      data-auth-debug-panel
    >
      <div className="text-green-100 mb-1 font-bold">
        Sumu Auth Debug（?debugAuth=1）· storage={getAuthStorageMode()}
      </div>
      {lines.length === 0 ? (
        <div>暂无日志</div>
      ) : (
        lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            {l}
          </div>
        ))
      )}
    </div>
  );
}
