/**
 * 判断点击目标是否在「不应取消多选」的浮层内（Dock / Dialog Portal 等）。
 * issue009：捕获阶段空白点击若未忽略 Dialog，会先清空选中导致移动静默失败。
 */
export function isSelectionSafeOverlayTarget(
  target: EventTarget | null
): boolean {
  if (!(target instanceof Element)) return true;
  return !!(
    target.closest("[data-selection-dock]") ||
    target.closest('[data-slot="dialog-content"]') ||
    target.closest('[data-slot="dialog-overlay"]') ||
    target.closest('[data-slot="dialog-portal"]') ||
    target.closest('[role="dialog"]') ||
    target.closest("[data-radix-portal]")
  );
}
