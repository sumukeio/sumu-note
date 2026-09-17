"use client";

import { supabase } from "./supabase";
import {
  eachDayOfInterval,
  format,
  startOfDay,
  subDays,
  isAfter,
} from "date-fns";

export interface NoteRow {
  id: string;
  title: string | null;
  content: string | null;
  folder_id: string | null;
  updated_at: string | null;
}

export interface FolderRow {
  id: string;
  name: string;
}

export interface UserStats {
  totalNotes: number;
  notesThisWeek: number;
  totalChars: number;
  activeDays: number;
}

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  count: number; // 当天总字数或篇数
  intensity: number; // 0-4 之间，用于映射颜色深浅
}

export interface FolderDistributionItem {
  folderId: string | null;
  folderName: string;
  count: number;
  [key: string]: string | number | null;
}

export interface RecentNote {
  id: string;
  title: string;
  updatedAt: string;
  folderName: string | null;
}

export interface DashboardStats {
  userStats: UserStats;
  heatmap: HeatmapDay[];
  folderDistribution: FolderDistributionItem[];
  recentNotes: RecentNote[];
}

/** 粗略去掉 Markdown 标记，便于统计纯文本长度 */
export function stripMarkdown(markdown: string | null): string {
  if (!markdown) return "";
  return markdown
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/[#>*_~\-]+/g, " ")
    .replace(/(\r\n|\n|\r)/g, " ");
}

export function toDateKey(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return format(d, "yyyy-MM-dd");
}

async function fetchBaseData(userId: string): Promise<{
  notes: NoteRow[];
  folders: FolderRow[];
}> {
  const [notesRes, foldersRes] = await Promise.all([
    supabase
      .from("notes")
      .select("id, title, content, folder_id, updated_at")
      .eq("user_id", userId)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .order("updated_at", { ascending: false }),
    supabase.from("folders").select("id, name").eq("user_id", userId),
  ]);

  if (notesRes.error) {
    throw new Error(notesRes.error.message || "获取笔记失败");
  }
  if (foldersRes.error) {
    throw new Error(foldersRes.error.message || "获取文件夹失败");
  }

  return {
    notes: (notesRes.data || []) as NoteRow[],
    folders: (foldersRes.data || []) as FolderRow[],
  };
}

/** 纯函数：汇总卡片指标（issue006 回归） */
export function computeUserStats(
  notes: NoteRow[],
  now: Date = new Date()
): UserStats {
  const startOfToday = startOfDay(now);
  const weekStart = subDays(startOfToday, 6);

  let totalChars = 0;
  let notesThisWeek = 0;
  const activeDaySet = new Set<string>();

  for (const note of notes) {
    totalChars += stripMarkdown(note.content).length;

    const updatedKey = toDateKey(note.updated_at);
    if (updatedKey) {
      activeDaySet.add(updatedKey);
      const updatedDate = new Date(updatedKey);
      if (
        isAfter(updatedDate, weekStart) ||
        updatedDate.getTime() === weekStart.getTime()
      ) {
        notesThisWeek += 1;
      }
    }
  }

  return {
    totalNotes: notes.length,
    notesThisWeek,
    totalChars,
    activeDays: activeDaySet.size,
  };
}

/** 纯函数：一年热力图 */
export function computeHeatmap(
  notes: NoteRow[],
  now: Date = new Date()
): HeatmapDay[] {
  const today = startOfDay(now);
  const oneYearAgo = subDays(today, 364);
  const dayMap = new Map<string, number>();

  for (const note of notes) {
    const key = toDateKey(note.updated_at);
    if (!key) continue;
    const startKey = format(oneYearAgo, "yyyy-MM-dd");
    const endKey = format(today, "yyyy-MM-dd");
    if (key < startKey || key > endKey) continue;
    dayMap.set(
      key,
      (dayMap.get(key) || 0) + stripMarkdown(note.content).length
    );
  }

  const days = eachDayOfInterval({ start: oneYearAgo, end: today });
  const raw: HeatmapDay[] = days.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return { date: key, count: dayMap.get(key) || 0, intensity: 0 };
  });

  const max = raw.reduce((acc, d) => (d.count > acc ? d.count : acc), 0);
  if (max === 0) return raw;

  return raw.map((d) => {
    if (d.count === 0) return { ...d, intensity: 0 };
    const ratio = d.count / max;
    let level = 1;
    if (ratio <= 0.25) level = 1;
    else if (ratio <= 0.5) level = 2;
    else if (ratio <= 0.75) level = 3;
    else level = 4;
    return { ...d, intensity: level };
  });
}

/** 纯函数：文件夹分布 */
export function computeFolderDistribution(
  notes: NoteRow[],
  folders: FolderRow[]
): FolderDistributionItem[] {
  const folderNameMap = new Map<string, string>();
  folders.forEach((f) => folderNameMap.set(f.id, f.name));

  const counter = new Map<string | null, number>();
  for (const note of notes) {
    const key = note.folder_id ?? null;
    counter.set(key, (counter.get(key) || 0) + 1);
  }

  const items: FolderDistributionItem[] = [];
  counter.forEach((count, folderId) => {
    items.push({
      folderId,
      folderName: (folderId && folderNameMap.get(folderId)) || "未分组",
      count,
    });
  });
  items.sort((a, b) => b.count - a.count);
  return items;
}

/** 纯函数：最近编辑 */
export function computeRecentNotes(
  notes: NoteRow[],
  folders: FolderRow[],
  limit = 8
): RecentNote[] {
  const folderNameMap = new Map<string, string>();
  folders.forEach((f) => folderNameMap.set(f.id, f.name));

  const sorted = [...notes].sort((a, b) => {
    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bTime - aTime;
  });

  return sorted.slice(0, limit).map((n) => ({
    id: n.id,
    title: n.title || "未命名笔记",
    updatedAt: n.updated_at || "",
    folderName: n.folder_id ? folderNameMap.get(n.folder_id) || null : null,
  }));
}

/** 由已拉取数据组装仪表盘（单次 IO） */
export function buildDashboardStats(
  notes: NoteRow[],
  folders: FolderRow[],
  now: Date = new Date()
): DashboardStats {
  return {
    userStats: computeUserStats(notes, now),
    heatmap: computeHeatmap(notes, now),
    folderDistribution: computeFolderDistribution(notes, folders),
    recentNotes: computeRecentNotes(notes, folders),
  };
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const { notes } = await fetchBaseData(userId);
  return computeUserStats(notes);
}

export async function getUserHeatmapData(userId: string): Promise<HeatmapDay[]> {
  const { notes } = await fetchBaseData(userId);
  return computeHeatmap(notes);
}

export async function getFolderDistribution(
  userId: string
): Promise<FolderDistributionItem[]> {
  const { notes, folders } = await fetchBaseData(userId);
  return computeFolderDistribution(notes, folders);
}

export async function getRecentNotes(
  userId: string,
  limit = 8
): Promise<RecentNote[]> {
  const { notes, folders } = await fetchBaseData(userId);
  return computeRecentNotes(notes, folders, limit);
}

/**
 * 仪表盘聚合：只拉取一次笔记/文件夹（issue006：避免 4 次全量并行拖垮页面）
 */
export async function getDashboardStats(
  userId: string
): Promise<DashboardStats> {
  const { notes, folders } = await fetchBaseData(userId);
  return buildDashboardStats(notes, folders);
}
