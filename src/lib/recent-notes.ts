export interface RecentNoteEntry {
  noteId: string;
  folderId: string | null;
  title: string;
  lastOpenedAt: number;
}

const MAX_RECENTS = 20;

function storageKey(userId: string) {
  return `sumunote:recent-notes:${userId}`;
}

export function getRecentNotes(userId: string): RecentNoteEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === "object")
      .map((x: any) => ({
        noteId: String(x.noteId ?? ""),
        folderId: x.folderId == null ? null : String(x.folderId),
        title: String(x.title ?? ""),
        lastOpenedAt: Number(x.lastOpenedAt ?? 0),
      }))
      .filter((x) => x.noteId && Number.isFinite(x.lastOpenedAt))
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function recordRecentNote(
  userId: string,
  entry: Omit<RecentNoteEntry, "lastOpenedAt"> & { lastOpenedAt?: number }
): void {
  if (typeof window === "undefined") return;
  try {
    const now = entry.lastOpenedAt ?? Date.now();
    const cur = getRecentNotes(userId);
    const next: RecentNoteEntry[] = [
      {
        noteId: entry.noteId,
        folderId: entry.folderId ?? null,
        title: entry.title ?? "",
        lastOpenedAt: now,
      },
      ...cur.filter((x) => x.noteId !== entry.noteId),
    ].slice(0, MAX_RECENTS);
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function removeRecentNote(userId: string, noteId: string): void {
  if (typeof window === "undefined") return;
  try {
    const cur = getRecentNotes(userId);
    const next = cur.filter((x) => x.noteId !== noteId);
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    // ignore
  }
}

