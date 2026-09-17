/**
 * issue002：iOS WebKit 上登录后 getSession 偶发读空，需短重试再判定未登录。
 */
export async function withRetries<T>(
  run: () => Promise<T>,
  options: {
    attempts: number;
    delayMs: number;
    shouldRetry: (value: T) => boolean;
  }
): Promise<T> {
  const { attempts, delayMs, shouldRetry } = options;
  let last: T | undefined;
  for (let i = 0; i < Math.max(1, attempts); i++) {
    last = await run();
    if (!shouldRetry(last)) return last;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return last as T;
}

/** 登录后是否应硬跳转（localStorage 可用时更稳；纯内存会话硬跳会丢） */
export function shouldHardNavigateAfterLogin(
  storageMode: "localStorage" | "memory" | "ssr" | "unknown"
): boolean {
  return storageMode === "localStorage";
}
