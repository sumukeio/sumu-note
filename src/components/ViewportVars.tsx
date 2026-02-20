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

    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return null;
}






