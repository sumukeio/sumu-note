"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { buildNoteFingerprint } from "@/lib/note-fingerprint";
import { decideRealtimeNoteUpdate } from "@/lib/note-realtime-filter";
import type { NoteSaveRefs } from "./useNoteSave";

export interface UseNoteRealtimeOptions {
  saveRefs: NoteSaveRefs;
  onCloudUpdate: (updatedNote: Record<string, unknown>) => void;
}

/**
 * Realtime 路径（便于后续做协同编辑时在此层引入一致性模型）：
 * 1. 收包：订阅 notes 表 UPDATE，payload.new 为最新行
 * 2. 自更新过滤：decideRealtimeNoteUpdate（指纹/时间窗）
 * 3. 云端更新：onCloudUpdate → 如 NoteManager.handleAutoSyncFromCloud
 */
export function useNoteRealtime(
  noteId: string | null,
  view: "list" | "editor",
  options: UseNoteRealtimeOptions
): void {
  const { saveRefs, onCloudUpdate } = options;
  const saveRefsRef = useRef(saveRefs);
  const onCloudUpdateRef = useRef(onCloudUpdate);
  saveRefsRef.current = saveRefs;
  onCloudUpdateRef.current = onCloudUpdate;

  useEffect(() => {
    if (view !== "editor" || !noteId) return;

    const channel = supabase
      .channel(`note:${noteId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notes",
          filter: `id=eq.${noteId}`,
        },
        (payload) => {
          const updatedNote = payload.new as Record<string, unknown>;
          const updatedAt = updatedNote.updated_at as string | undefined;
          if (!updatedAt) return;

          const payloadFingerprint = buildNoteFingerprint({
            title: updatedNote.title as string | null,
            content: updatedNote.content as string | null,
            tags: (updatedNote.tags as string | null) ?? null,
            is_pinned: updatedNote.is_pinned as boolean | null,
            is_published: updatedNote.is_published as boolean | null,
          });

          const refs = saveRefsRef.current;
          const decision = decideRealtimeNoteUpdate({
            updatedAt,
            payloadFingerprint,
            nowMs: Date.now(),
            isSaving: refs.isSavingRef.current,
            lastSaveTimeMs: refs.lastSaveTimeRef.current,
            pendingSelfUpdatedAt: refs.pendingSelfUpdateRef.current,
            pendingSelfFingerprint: refs.pendingSelfFingerprintRef.current,
            lastSavedUpdatedAt: refs.lastSavedTimestampRef.current,
            recentSelfFingerprints: refs.recentSelfUpdatesRef.current.values(),
            recentSelfByUpdatedAt: refs.recentSelfUpdatesRef.current,
          });

          if (decision.action === "ignore") {
            // 命中自己保存：尽量清掉对应表项，避免 Map 膨胀
            if (
              decision.reason === "recent_self_fingerprint" ||
              decision.reason === "recent_self_updated_at_key"
            ) {
              const map = refs.recentSelfUpdatesRef.current;
              if (map.get(updatedAt) === payloadFingerprint) {
                map.delete(updatedAt);
              } else {
                for (const [k, fp] of map) {
                  if (fp === payloadFingerprint) {
                    map.delete(k);
                    break;
                  }
                }
              }
            }
            return;
          }

          onCloudUpdateRef.current(updatedNote);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [noteId, view]);
}
