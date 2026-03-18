"use client";

import { useEffect } from "react";

/**
 * Writes VisualViewport-derived CSS variables to :root so fixed-position UIs
 * (especially editors) can avoid being covered by the on-screen keyboard.
 *
 * Variables:
 * - --vvh: visual viewport height in px
 * - --vvw: visual viewport width in px
 * - --vv-offset-top: visual viewport offsetTop in px
 * - --vv-offset-left: visual viewport offsetLeft in px
 * - --vv-bottom-inset: layoutViewportHeight - (vv.height + vv.offsetTop) in px (approx keyboard / bottom overlays)
 */
export default function ViewportVars() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;

    const update = () => {
      const vv = window.visualViewport;
      const layoutH = window.innerHeight || 0;
      const layoutW = window.innerWidth || 0;

      if (!vv) {
        root.style.setProperty("--vvh", `${layoutH}px`);
        root.style.setProperty("--vvw", `${layoutW}px`);
        root.style.setProperty("--vv-offset-top", `0px`);
        root.style.setProperty("--vv-offset-left", `0px`);
        root.style.setProperty("--vv-bottom-inset", `0px`);
        return;
      }

      const vvh = Math.round(vv.height);
      const vvw = Math.round(vv.width);
      const top = Math.round(vv.offsetTop);
      const left = Math.round(vv.offsetLeft);
      const bottomInset = Math.max(0, Math.round(layoutH - (vv.height + vv.offsetTop)));

      root.style.setProperty("--vvh", `${vvh}px`);
      root.style.setProperty("--vvw", `${vvw}px`);
      root.style.setProperty("--vv-offset-top", `${top}px`);
      root.style.setProperty("--vv-offset-left", `${left}px`);
      root.style.setProperty("--vv-bottom-inset", `${bottomInset}px`);
    };

    update();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    // 某些移动端浏览器在路由切换/返回前台时不会触发 vv resize/scroll，
    // 导致 --vvh/--vv-offset-top 卡住（表现为全屏层只显示 1/3 或位置错乱）。
    window.addEventListener("pageshow", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);

    // 兜底：下一帧与短延迟各刷新一次，覆盖“首帧 vv 值不准”的情况
    requestAnimationFrame(update);
    setTimeout(update, 120);

    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("pageshow", update);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return null;
}






