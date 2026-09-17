"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPublishedNoteById, type PublishedNoteView } from "@/lib/note-service";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Loader2 } from "lucide-react";

/**
 * 已发布笔记公开阅读页（issue005）
 * URL：/p/{noteId} —— 与编辑器「发布」复制的链接一致
 */
export default function PublicNotePage() {
  const params = useParams<{ id: string }>();
  const noteId = decodeURIComponent(params.id ?? "");
  const [note, setNote] = useState<PublishedNoteView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!noteId) {
      setError("无效的笔记链接");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getPublishedNoteById(noteId)
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setNote(null);
          setError("这篇笔记未发布或不存在");
          return;
        }
        setNote(row);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("[public-note]", err);
        setError(
          (err as Error)?.message ||
            "加载失败。若你是访客，请确认已在 Supabase 执行公开阅读 RLS 脚本。"
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [noteId]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>加载中…</span>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 text-center gap-2">
        <h1 className="text-lg font-semibold text-foreground">无法查看</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          {error || "这篇笔记未发布或不存在"}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/90 backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Sumu Note · 公开阅读
          </p>
          <h1 className="text-xl font-semibold text-foreground truncate">
            {note.title?.trim() || "无标题"}
          </h1>
          {note.updated_at && (
            <p className="text-xs text-muted-foreground mt-0.5">
              更新于{" "}
              {new Date(note.updated_at).toLocaleString("zh-CN", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <MarkdownRenderer content={note.content ?? ""} noteId={note.id} />
        </article>
      </main>
    </div>
  );
}
