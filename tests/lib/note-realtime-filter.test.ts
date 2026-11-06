import { describe, expect, it } from "vitest";
import { decideRealtimeNoteUpdate } from "@/lib/note-realtime-filter";

const base = {
  nowMs: 1_000_000,
  isSaving: false,
  lastSaveTimeMs: 990_000,
  pendingSelfUpdatedAt: null as string | null,
  pendingSelfFingerprint: null as string | null,
  lastSavedUpdatedAt: "2026-11-06T06:00:00.000Z",
  recentSelfFingerprints: [] as string[],
};

describe("decideRealtimeNoteUpdate", () => {
  it("近期自己指纹命中 → ignore（不依赖 updated_at 字符串）", () => {
    const r = decideRealtimeNoteUpdate({
      ...base,
      updatedAt: "2026-11-06T06:00:10.000+00:00",
      payloadFingerprint: "fp-self",
      recentSelfFingerprints: ["fp-other", "fp-self"],
    });
    expect(r).toEqual({ action: "ignore", reason: "recent_self_fingerprint" });
  });

  it("pending 指纹在宽限窗内 → ignore", () => {
    const r = decideRealtimeNoteUpdate({
      ...base,
      updatedAt: "2026-11-06T06:00:05.000Z",
      payloadFingerprint: "fp-pending",
      pendingSelfFingerprint: "fp-pending",
      lastSaveTimeMs: base.nowMs - 2000,
    });
    expect(r.action).toBe("ignore");
    expect(r).toMatchObject({ reason: "pending_fingerprint_grace" });
  });

  it("与 lastSaved 时间极近 → ignore（自写回声）", () => {
    const r = decideRealtimeNoteUpdate({
      ...base,
      updatedAt: "2026-11-06T06:00:00.500Z",
      payloadFingerprint: "fp-unknown",
      lastSavedUpdatedAt: "2026-11-06T06:00:00.000Z",
    });
    expect(r).toEqual({ action: "ignore", reason: "near_last_saved_timestamp" });
  });

  it("明确更新的他端内容 → apply_cloud", () => {
    const r = decideRealtimeNoteUpdate({
      ...base,
      updatedAt: "2026-11-06T06:01:00.000Z",
      payloadFingerprint: "fp-foreign",
      lastSavedUpdatedAt: "2026-11-06T06:00:00.000Z",
      lastSaveTimeMs: base.nowMs - 60_000,
      recentSelfFingerprints: ["fp-old-self"],
    });
    expect(r).toEqual({ action: "apply_cloud", reason: "newer_foreign_update" });
  });

  it("有 pendingSelf 时不 apply（避免保存竞态误覆盖）", () => {
    const r = decideRealtimeNoteUpdate({
      ...base,
      updatedAt: "2026-11-06T06:01:00.000Z",
      payloadFingerprint: "fp-foreign",
      pendingSelfUpdatedAt: "2026-11-06T06:00:50.000Z",
      lastSavedUpdatedAt: "2026-11-06T06:00:00.000Z",
    });
    expect(r.action).toBe("ignore");
    expect(r).toMatchObject({ reason: "pending_self_blocks_apply" });
  });

  it("updated_at 不新于 lastSaved → ignore", () => {
    const r = decideRealtimeNoteUpdate({
      ...base,
      updatedAt: "2026-11-06T05:59:00.000Z",
      payloadFingerprint: "fp-x",
      lastSavedUpdatedAt: "2026-11-06T06:00:00.000Z",
    });
    expect(r.action).toBe("ignore");
  });
});
