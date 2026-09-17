"use client";

import { useEffect, useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { pushAuthDebug } from "@/lib/auth-login-handoff";

type NoteManagerProps = {
  userId: string;
  folderId: string;
  folderName: string;
  onBack: () => void;
  onEnterFolder?: (folderId: string, folderName: string) => void;
  initialNoteId?: string | null;
  onInitialNoteOpened?: () => void;
};

/**
 * 进入文件夹时再拉 NoteManager 大包；带超时与返回，避免 iOS 永久白屏转圈。
 */
export default function NoteFolderLazy(props: NoteManagerProps) {
  const [Comp, setComp] = useState<ComponentType<NoteManagerProps> | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setComp(null);
    setError(null);
    pushAuthDebug("note-manager:import-start", {
      folderId: props.folderId,
      folderName: props.folderName,
    });

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      pushAuthDebug("note-manager:import-timeout", {
        folderId: props.folderId,
      });
      setError("笔记模块加载超时，请重试或返回文件夹列表。");
    }, 15_000);

    import("@/components/NoteManager")
      .then((mod) => {
        if (cancelled) return;
        window.clearTimeout(timer);
        pushAuthDebug("note-manager:import-ok", { folderId: props.folderId });
        setComp(() => mod.default);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        window.clearTimeout(timer);
        const msg = e instanceof Error ? e.message : String(e);
        pushAuthDebug("note-manager:import-fail", { msg });
        setError(`笔记模块加载失败：${msg}`);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [props.folderId, props.folderName, tick]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 px-6">
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          {error}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={props.onBack}>
            返回
          </Button>
          <Button onClick={() => setTick((n) => n + 1)}>重试</Button>
        </div>
      </div>
    );
  }

  if (!Comp) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 px-6">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">正在加载笔记列表…</p>
        <Button variant="outline" size="sm" onClick={props.onBack}>
          返回
        </Button>
      </div>
    );
  }

  return <Comp {...props} />;
}

/** 工作台挂载后预取，点击文件夹时更快 */
export function preloadNoteManager(): void {
  pushAuthDebug("note-manager:preload-start");
  void import("@/components/NoteManager")
    .then(() => pushAuthDebug("note-manager:preload-ok"))
    .catch((e: unknown) =>
      pushAuthDebug("note-manager:preload-fail", {
        msg: e instanceof Error ? e.message : String(e),
      })
    );
}
