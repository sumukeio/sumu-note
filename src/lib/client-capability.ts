/**
 * 客户端能力探测（issue002 task018）
 * iPhone/iPod → 轻量文件夹；安卓 / PC / iPad → 完整 NoteManager
 */

export function shouldUseLightFolderNotes(
  userAgent: string = typeof navigator !== "undefined" ? navigator.userAgent : ""
): boolean {
  if (!userAgent) return false;
  // 明确只要 iPhone/iPod；iPad 走完整编辑器
  return /iPhone|iPod/i.test(userAgent);
}
