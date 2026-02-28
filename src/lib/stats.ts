"use client";

import { supabase } from "./supabase";
import { getNotesForUser } from "./note-service";
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
  [key: string]: any; // 添加索引签名以兼容 recharts 的 ChartDataInput 类型
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

// --- 工具函数 ---

// 粗略去掉 Markdown 标记，便于统计纯文本长度
const stripMarkdown = (markdown: string | null): string => {
  if (!markdown) return "";
  return markdown
    .replace(/`{1,3}[^`]*`{1,3}/g, "") // 行内/块代码
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // 图片
    .replace(/\[[^\]]*\]\([^)]*\)/g, "") // 链接
    .replace(/[#>*_~\-]+/g, " ") // 标题、引用、列表符号
    .replace(/(\r\n|\n|\r)/g, " "); // 换行
};

const toDateKey = (value: string | null): string | null => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return format(d, "yyyy-MM-dd");
};

async function fetchBaseData(userId: string): Promise<{
  notes: NoteRow[];
  folders: FolderRow[];
}> {
  const [notes, foldersRes] = await Promise.all([
    getNotesForUser(userId),
    supabase.from("folders").select("id, name").eq("user_id", userId),
  ]);

  if (foldersRes.error) {
    throw new Error(foldersRes.error.message || "Failed to fetch folders");
  }

  return {
    notes: notes as NoteRow[],
    folders: (foldersRes.data || []) as FolderRow[],
  };
}

// --- 导出的统计函数 ---

export async function getUserStats(userId: string): Promise<UserStats> {
  const { notes } = await fetchBaseData(userId);

  const now = new Date();
  const startOfToday = startOfDay(now);
  const weekStart = subDays(startOfToday, 6); // 包含今天在内的过去 7 天

  let totalChars = 0;
  let notesThisWeek = 0;
  const activeDaySet = new Set<string>();

  for (const note of notes) {
    const text = stripMarkdown(note.content);
    totalChars += text.length;

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

export async function getUserHeatmapData(userId: string): Promise<HeatmapDay[]> {
  const { notes } = await fetchBaseData(userId);

  const today = startOfDay(new Date());
  const oneYearAgo = subDays(today, 364);

  const dayMap = new Map<string, number>();

  for (const note of notes) {
    const key = toDateKey(note.updated_at);
    if (!key) continue;
    const dateObj = new Date(key);
    if (dateObj < oneYearAgo || dateObj > today) continue;

    const current = dayMap.get(key) || 0;
    // 使用字数作为热力值
    const text = stripMarkdown(note.content);
    dayMap.set(key, current + text.length);
  }

  const days = eachDayOfInterval({ start: oneYearAgo, end: today });

  const raw: HeatmapDay[] = days.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    const count = dayMap.get(key) || 0;
    return { date: key, count, intensity: 0 };
  });

  const max = raw.reduce((acc, d) => (d.count > acc ? d.count : acc), 0);
  if (max === 0) {
    // 全部为空，直接返回 count 为 0，intensity 为 0 的数组
    return raw;
  }

  // 将 count 映射到 0-4 的等级
  const result = raw.map((d) => {
    const ratio = d.count / max;
    let level = 0;
    if (ratio > 0 && ratio <= 0.25) level = 1;
    else if (ratio <= 0.5) level = 2;
    else if (ratio <= 0.75) level = 3;
    else if (ratio > 0.75) level = 4;
    return { ...d, intensity: level };
  });

  return result;
}

export async function getFolderDistribution(
  userId: string
): Promise<FolderDistributionItem[]> {
  const { notes, folders } = await fetchBaseData(userId);

  const folderNameMap = new Map<string, string>();
  folders.forEach((f) => folderNameMap.set(f.id, f.name));

  const counter = new Map<string | null, number>();

  for (const note of notes) {
    const key = note.folder_id ?? null;
    counter.set(key, (counter.get(key) || 0) + 1);
  }

  const items: FolderDistributionItem[] = [];

  counter.forEach((count, folderId) => {
    const name =
      (folderId && folderNameMap.get(folderId)) || "未分组";
    items.push({
      folderId,
      folderName: name,
      count,
    });
  });

  // 按数量降序排序
  items.sort((a, b) => b.count - a.count);
  return items;
}

export async function getRecentNotes(
  userId: string,
  limit = 8
): Promise<RecentNote[]> {
  const { notes, folders } = await fetchBaseData(userId);
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

export async function getDashboardStats(
  userId: string
): Promise<DashboardStats> {
  const [userStats, heatmap, folderDistribution, recentNotes] =
    await Promise.all([
      getUserStats(userId),
      getUserHeatmapData(userId),
      getFolderDistribution(userId),
      getRecentNotes(userId),
    ]);

  return {
    userStats,
    heatmap,
    folderDistribution,
    recentNotes,
  };
}




