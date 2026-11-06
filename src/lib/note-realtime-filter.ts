/**
 * Realtime notes UPDATE 自更新过滤（纯函数，供单测锁死）。
 * 目标：自己保存的回声绝不触发「已同步云端更新」覆盖，避免编辑中光标跳文末。
 */

export type RealtimeFilterInput = {
  updatedAt: string;
  payloadFingerprint: string;
  nowMs: number;
  isSaving: boolean;
  lastSaveTimeMs: number;
  pendingSelfUpdatedAt: string | null;
  pendingSelfFingerprint: string | null;
  lastSavedUpdatedAt: string | null;
  /** updated_at → fingerprint；也可能仅用 value 做指纹命中 */
  recentSelfFingerprints: Iterable<string>;
  /** 可选：按 updated_at 精确查表 */
  recentSelfByUpdatedAt?: ReadonlyMap<string, string>;
};

export type RealtimeFilterResult =
  | { action: "ignore"; reason: string }
  | { action: "apply_cloud"; reason: string };

function tsMs(iso: string): number {
  const n = new Date(iso).getTime();
  return Number.isFinite(n) ? n : NaN;
}

function fingerprintsInclude(
  recent: Iterable<string>,
  fp: string
): boolean {
  for (const x of recent) {
    if (x === fp) return true;
  }
  return false;
}

/**
 * 判定 Realtime UPDATE 应忽略（自己保存回声）还是当作云端更新应用。
 */
export function decideRealtimeNoteUpdate(
  input: RealtimeFilterInput
): RealtimeFilterResult {
  const {
    updatedAt,
    payloadFingerprint,
    nowMs,
    isSaving,
    lastSaveTimeMs,
    pendingSelfUpdatedAt,
    pendingSelfFingerprint,
    lastSavedUpdatedAt,
    recentSelfFingerprints,
    recentSelfByUpdatedAt,
  } = input;

  const updatedAtMs = tsMs(updatedAt);
  if (!Number.isFinite(updatedAtMs)) {
    return { action: "ignore", reason: "invalid_updated_at" };
  }

  // 1) 近期自己保存的指纹命中（不依赖 updated_at 字符串格式）
  if (fingerprintsInclude(recentSelfFingerprints, payloadFingerprint)) {
    return { action: "ignore", reason: "recent_self_fingerprint" };
  }

  // 2) 按 updated_at 键精确命中且指纹一致
  const byKey = recentSelfByUpdatedAt?.get(updatedAt);
  if (byKey && byKey === payloadFingerprint) {
    return { action: "ignore", reason: "recent_self_updated_at_key" };
  }

  // 3) 保存中 / 保存后宽限窗内，指纹与 pending 一致
  const withinSaveGrace = isSaving || nowMs - lastSaveTimeMs < 12_000;
  if (
    withinSaveGrace &&
    pendingSelfFingerprint &&
    payloadFingerprint === pendingSelfFingerprint
  ) {
    return { action: "ignore", reason: "pending_fingerprint_grace" };
  }

  // 4) pending 的 updated_at 与事件一致（允许 ISO 字符串微差：比时间戳）
  if (pendingSelfUpdatedAt) {
    const pendingMs = tsMs(pendingSelfUpdatedAt);
    if (
      Number.isFinite(pendingMs) &&
      Math.abs(pendingMs - updatedAtMs) < 2000
    ) {
      return { action: "ignore", reason: "pending_updated_at_near" };
    }
  }

  // 5) 与上次成功保存的时间戳过近（同一写入的回声），即使指纹表已清
  if (lastSavedUpdatedAt) {
    const lastMs = tsMs(lastSavedUpdatedAt);
    if (Number.isFinite(lastMs) && Math.abs(updatedAtMs - lastMs) < 2000) {
      return { action: "ignore", reason: "near_last_saved_timestamp" };
    }
  }

  // 6) 仍在写入中且事件时间落在保存时刻附近
  if (isSaving) {
    const delta = updatedAtMs - lastSaveTimeMs;
    if (delta >= 0 && delta < 5000) {
      return { action: "ignore", reason: "saving_window" };
    }
  }

  // 7) 明确更「新」于本地记录的上次保存，才视为云端/他端更新
  if (!lastSavedUpdatedAt) {
    return { action: "ignore", reason: "no_last_saved_baseline" };
  }
  const lastSavedMs = tsMs(lastSavedUpdatedAt);
  if (!Number.isFinite(lastSavedMs)) {
    return { action: "ignore", reason: "invalid_last_saved" };
  }
  if (updatedAtMs <= lastSavedMs) {
    return { action: "ignore", reason: "not_newer_than_last_saved" };
  }
  // 至少新过 1.5s，避免同一秒内自写双事件
  if (updatedAtMs - lastSavedMs < 1500) {
    return { action: "ignore", reason: "too_close_to_last_saved" };
  }
  if (pendingSelfUpdatedAt) {
    return { action: "ignore", reason: "pending_self_blocks_apply" };
  }
  if (isSaving && nowMs - lastSaveTimeMs < 5000) {
    return { action: "ignore", reason: "still_saving" };
  }

  return { action: "apply_cloud", reason: "newer_foreign_update" };
}
