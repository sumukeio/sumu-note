"use client";

import { useState, useCallback, useRef } from "react";
import { updateNote } from "@/lib/note-service";
import { createNoteVersion } from "@/lib/version-history";
import { isOnline, savePendingSyncNote } from "@/lib/offline-storage";
import { buildNoteFingerprint } from "@/lib/note-fingerprint";
import type { Note } from "@/types/note";

export type SaveStatus = "saved" | "saving" | "error" | "unsaved";

export interface NoteSaveRefs {
  isSavingRef: React.MutableRefObject<boolean>;
  lastSaveTimeRef: React.MutableRefObject<number>;
  pendingSelfUpdateRef: React.MutableRefObject<string | null>;
  pendingSelfFingerprintRef: React.MutableRefObject<string | null>;
  recentSelfUpdatesRef: React.MutableRefObject<Map<string, string>>;
  lastSavedTimestampRef: React.MutableRefObject<string | null>;
}

type ToastFn = (opts: {
  title: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
}) => void;

export interface UseNoteSaveOptions {
  toast: ToastFn;
  onTitleDerived?: (title: string) => void;
}

/**
 * 保存与同步：防抖由调用方做；本 Hook 负责单次保存、重试、离线写入、版本历史。
 *
 * 保存路径（便于后续做协同编辑时在此层引入一致性模型）：
 * 1. 调用方防抖后调用 save(...)
 * 2. 在线：updateNote → 成功则写版本历史、更新 refs；失败则网络错误 → 离线队列，否则 → 最多 3 次重试
 * 3. 离线：直接写离线队列，成功后更新 refs
 */
export function useNoteSave(
  currentNote: Note | null,
  userId: string,
  options: UseNoteSaveOptions
): {
  save: (
    currentTitle: string,
    currentContent: string,
    pinned: boolean,
    published: boolean,
    currentTags: string[],
    showToast?: boolean
  ) => Promise<void>;
  saveStatus: SaveStatus;
  setSaveStatus: React.Dispatch<React.SetStateAction<SaveStatus>>;
  refs: NoteSaveRefs;
} {
  const { toast, onTitleDerived } = options;
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  const isSavingRef = useRef(false);
  const lastSaveTimeRef = useRef(0);
  const pendingSelfUpdateRef = useRef<string | null>(null);
  const pendingSelfFingerprintRef = useRef<string | null>(null);
  const recentSelfUpdatesRef = useRef<Map<string, string>>(new Map());
  const lastSavedTimestampRef = useRef<string | null>(null);
  const saveRetryCountRef = useRef(0);
  const saveRetryTimerRef = useRef<NodeJS.Timeout | null>(null);

  const refs: NoteSaveRefs = {
    isSavingRef,
    lastSaveTimeRef,
    pendingSelfUpdateRef,
    pendingSelfFingerprintRef,
    recentSelfUpdatesRef,
    lastSavedTimestampRef,
  };

  const save = useCallback(
    async (
      currentTitle: string,
      currentContent: string,
      pinned: boolean,
      published: boolean,
      currentTags: string[],
      showToast = false
    ) => {
      if (!currentNote) return;

      setSaveStatus("saving");
      const now = new Date();
      const nowTimestamp = now.getTime();
      isSavingRef.current = true;
      lastSaveTimeRef.current = nowTimestamp;

      let finalTitle = currentTitle;
      if (!finalTitle.trim()) {
        finalTitle =
          currentContent.split("\n")[0]?.replace(/[#*`]/g, "").trim().slice(0, 30) || "";
        onTitleDerived?.(finalTitle);
      }

      pendingSelfFingerprintRef.current = buildNoteFingerprint({
        title: finalTitle,
        content: currentContent,
        tags: currentTags.join(","),
        is_pinned: pinned,
        is_published: published,
      });

      const online = isOnline();

      if (online) {
        let latestUpdatedAt: string = now.toISOString();
        let saveError: Error | null = null;

        try {
          const row = await updateNote(currentNote.id, userId, {
            title: finalTitle,
            content: currentContent,
            is_pinned: pinned,
            is_published: published,
            tags: currentTags.join(","),
            updated_at: now.toISOString(),
          });
          latestUpdatedAt = row.updated_at ?? now.toISOString();
        } catch (err: unknown) {
          const msg = (err as Error)?.message ?? String(err);
          const isTagsColumn =
            typeof msg === "string" && msg.includes("column") && msg.includes("tags");
          if (isTagsColumn) {
            try {
              const row = await updateNote(currentNote.id, userId, {
                title: finalTitle,
                content: currentContent,
                is_pinned: pinned,
                is_published: published,
                updated_at: now.toISOString(),
              });
              latestUpdatedAt = row.updated_at ?? now.toISOString();
            } catch (retryErr: unknown) {
              saveError =
                retryErr instanceof Error ? retryErr : new Error(String(retryErr));
            }
          } else {
            saveError = err instanceof Error ? err : new Error(String(err));
          }
        }

        if (!saveError) {
          setSaveStatus("saved");
          saveRetryCountRef.current = 0;
          if (saveRetryTimerRef.current) {
            clearTimeout(saveRetryTimerRef.current);
            saveRetryTimerRef.current = null;
          }
          lastSavedTimestampRef.current = latestUpdatedAt;
          pendingSelfUpdateRef.current = latestUpdatedAt;
          if (pendingSelfFingerprintRef.current) {
            recentSelfUpdatesRef.current.set(
              latestUpdatedAt,
              pendingSelfFingerprintRef.current
            );
            if (recentSelfUpdatesRef.current.size > 20) {
              const firstKey = recentSelfUpdatesRef.current.keys().next()
                .value as string | undefined;
              if (firstKey) recentSelfUpdatesRef.current.delete(firstKey);
            }
          }
          lastSaveTimeRef.current = new Date(latestUpdatedAt).getTime();
          if (showToast) {
            toast({
              title: "保存成功",
              description: "笔记已保存到云端",
              variant: "success",
              duration: 3000,
            });
          }
          setTimeout(() => {
            isSavingRef.current = false;
            pendingSelfUpdateRef.current = null;
            pendingSelfFingerprintRef.current = null;
          }, 3000);
          createNoteVersion(
            currentNote.id,
            userId,
            finalTitle,
            currentContent,
            currentTags
          ).catch((err) => console.warn("Failed to create note version:", err));
          return;
        }

        const errorMessage = saveError.message || String(saveError);
        const isNetworkError =
          errorMessage.includes("Failed to fetch") ||
          errorMessage.includes("ERR_INTERNET_DISCONNECTED") ||
          errorMessage.includes("NetworkError") ||
          errorMessage.includes("network");

        if (isNetworkError) {
          try {
            await savePendingSyncNote({
              note_id: currentNote.id,
              user_id: userId,
              title: finalTitle,
              content: currentContent,
              tags: currentTags.join(","),
              is_pinned: pinned,
              is_published: published,
              operation: "update",
            });
            setSaveStatus("saved");
            lastSavedTimestampRef.current = now.toISOString();
            lastSaveTimeRef.current = nowTimestamp;
            isSavingRef.current = false;
          } catch (err) {
            setSaveStatus("error");
            isSavingRef.current = false;
            toast({
              title: "保存失败",
              description: "无法保存到本地存储，请检查浏览器设置",
              variant: "destructive",
              duration: 5000,
            });
          }
          return;
        }

        if (saveRetryCountRef.current < 3) {
          saveRetryCountRef.current += 1;
          const retryDelay = saveRetryCountRef.current * 1000;
          if (saveRetryTimerRef.current) clearTimeout(saveRetryTimerRef.current);
          saveRetryTimerRef.current = setTimeout(() => {
            save(
              currentTitle,
              currentContent,
              pinned,
              published,
              currentTags,
              showToast
            );
          }, retryDelay);
          setSaveStatus("saving");
          toast({
            title: "保存失败，正在重试",
            description: `第 ${saveRetryCountRef.current}/3 次重试...`,
            variant: "default",
            duration: 2000,
          });
        } else {
          setSaveStatus("error");
          isSavingRef.current = false;
          saveRetryCountRef.current = 0;
          toast({
            title: "保存失败",
            description:
              saveError.message ||
              "保存时发生错误，已重试3次仍失败，请稍后手动保存",
            variant: "destructive",
            duration: 5000,
          });
        }
      } else {
        try {
          await savePendingSyncNote({
            note_id: currentNote.id,
            user_id: userId,
            title: finalTitle,
            content: currentContent,
            tags: currentTags.join(","),
            is_pinned: pinned,
            is_published: published,
            operation: "update",
          });
          setSaveStatus("saved");
          lastSavedTimestampRef.current = now.toISOString();
          lastSaveTimeRef.current = nowTimestamp;
          isSavingRef.current = false;
        } catch (err) {
          setSaveStatus("error");
          isSavingRef.current = false;
        }
      }
    },
    [currentNote, userId, toast, onTitleDerived]
  );

  return { save, saveStatus, setSaveStatus, refs };
}
