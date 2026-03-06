/**
 * 触觉反馈统一封装
 * 用于勾选、保存、删除等操作的震动反馈，增强确认感
 */

function safeVibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  try {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // 忽略不支持或报错
  }
}

/** 短震：勾选待办/复选框、删除确认等 */
export function vibrateShort(): void {
  safeVibrate(50);
}

/** 成功/完成：保存成功等，略长震动 */
export function vibrateSuccess(): void {
  safeVibrate([50, 30, 50]);
}

/** 警告/危险：删除确认等 */
export function vibrateWarning(): void {
  safeVibrate([80, 40, 80]);
}

/** 长按进入多选：保持与原有 50ms 一致 */
export function vibrateSelection(): void {
  safeVibrate(50);
}
