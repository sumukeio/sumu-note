"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { buildNoteFingerprint } from "@/lib/note-fingerprint";
import type { NoteSaveRefs } from "./useNoteSave";

export interface UseNoteRealtimeOptions {
  saveRefs: NoteSaveRefs;
  onCloudUpdate: (updatedNote: Record<string, unknown>) => void;
}

/**
 * Realtime 路径（便于后续做协同编辑时在此层引入一致性模型）：
 * 1. 收包：订阅 notes 表 UPDATE，payload.new 为最新行
 * 2. 自更新过滤：用 saveRefs 的指纹/时间窗口判断是否为“自己保存”，是则忽略
 * 3. 云端更新处理：通过 onCloudUpdate(updatedNote) 回调给父组件（如 NoteManager 的 handleAutoSyncFromCloud）
 * 与 useNoteSave 的 saveRefs 配合，过滤“自己保存”触发的同一条更新。
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
          const updatedAtTimestamp = new Date(updatedAt).getTime();
          const currentTime = Date.now();

          const payloadFingerprint = buildNoteFingerprint({
            title: updatedNote.title as string | null,
            content: updatedNote.content as string | null,
            tags: (updatedNote.tags as string | null) ?? null,
            is_pinned: updatedNote.is_pinned as boolean | null,
            is_published: updatedNote.is_published as boolean | null,
          });

          const saveRefs = saveRefsRef.current;
          const {
            isSavingRef,
            lastSaveTimeRef,
            pendingSelfUpdateRef,
            pendingSelfFingerprintRef,
            recentSelfUpdatesRef,
            lastSavedTimestampRef,
          } = saveRefs;

          const knownSelfFp = updatedAt
            ? recentSelfUpdatesRef.current.get(updatedAt)
            : undefined;
          if (knownSelfFp && knownSelfFp === payloadFingerprint) {
            recentSelfUpdatesRef.current.delete(updatedAt);
            pendingSelfUpdateRef.current = null;
            return;
          }
          if (
            (isSavingRef.current ||
              currentTime - lastSaveTimeRef.current < 8000) &&
            pendingSelfFingerprintRef.current &&
            payloadFingerprint === pendingSelfFingerprintRef.current
          ) {
            pendingSelfUpdateRef.current = null;
            return;
          }
          if (
            pendingSelfUpdateRef.current &&
            updatedAt === pendingSelfUpdateRef.current
          ) {
            pendingSelfUpdateRef.current = null;
            return;
          }
          if (isSavingRef.current) {
            const timeSinceLastSave =
              updatedAtTimestamp - lastSaveTimeRef.current;
            if (timeSinceLastSave >= 0 && timeSinceLastSave < 3000) return;
          }
          if (
            lastSavedTimestampRef.current &&
            updatedAt !== lastSavedTimestampRef.current
          ) {
            const lastSavedTimestamp = new Date(
              lastSavedTimestampRef.current
            ).getTime();
            const timeDiff = updatedAtTimestamp - lastSavedTimestamp;
            if (timeDiff > 3000 && updatedAtTimestamp > lastSavedTimestamp) {
              const timeSinceLastSave =
                currentTime - lastSaveTimeRef.current;
              if (timeSinceLastSave < 5000 && isSavingRef.current) return;
              if (pendingSelfUpdateRef.current) return;
              onCloudUpdateRef.current(updatedNote);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [noteId, view]);
}
