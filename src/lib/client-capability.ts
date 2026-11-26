/**
 * 客户端能力探测（issue002 task018；phase-fulltrack-drag-capability task001 收窄）
 *
 * 轻量文件夹仅服务旧机锚点（iPhone 8 Plus 最高 iOS 16）：
 * iPhone/iPod + iOS major ≤ 16 → 轻量；iOS ≥ 17（含 iPhone 12 + iOS 18）→ 完整 NoteManager
 * 安卓 / PC / iPad → 完整
 *
 * UA 无法识别机型，故以 iOS major 代理；解析失败 → 保守轻量。
 */

/** 从 UA 解析 iOS / iPadOS major；无法解析返回 null */
export function parseIOSMajorVersion(userAgent: string): number | null {
  if (!userAgent) return null;
  // iPhone/iPod: "CPU iPhone OS 18_0 like Mac OS X"
  // iPad: "CPU OS 16_0 like Mac OS X" 或 "CPU iPhone OS …"（桌面请求时）
  const match =
    userAgent.match(/iPhone OS (\d+)[_.]/i) ||
    userAgent.match(/CPU OS (\d+)[_.]/i);
  if (!match) return null;
  const major = Number.parseInt(match[1], 10);
  return Number.isFinite(major) ? major : null;
}

export function shouldUseLightFolderNotes(
  userAgent: string = typeof navigator !== "undefined" ? navigator.userAgent : ""
): boolean {
  if (!userAgent) return false;
  if (!/iPhone|iPod/i.test(userAgent)) return false;

  const major = parseIOSMajorVersion(userAgent);
  // 解析失败：保守走轻量，避免旧机误入完整大包
  if (major === null) return true;
  return major <= 16;
}
