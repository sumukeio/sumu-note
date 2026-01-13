"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getDashboardStats, DashboardStats } from "@/lib/stats";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  FileText,
  Type,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

const FOLDER_COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#8B5CF6",
  "#F97316",
  "#14B8A6",
  "#3B82F6",
];

function getFolderColor(index: number): string {
  return FOLDER_COLORS[index % FOLDER_COLORS.length];
}

export default function StatsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        // 处理 refresh token 错误
        if (error) {
          console.error("Auth error:", error);
          if (error.message?.includes("Refresh Token") || error.message?.includes("JWT")) {
            await supabase.auth.signOut();
            router.replace("/");
            return;
          }
        }

        if (!user) {
          router.replace("/");
          return;
        }
        setUserId(user.id);
        try {
          const result = await getDashboardStats(user.id);
          setStats(result);
        } catch (err: any) {
          console.error(err);
          setError(err?.message || "加载统计数据失败");
        }
      } catch (err) {
        console.error("Failed to check user:", err);
        router.replace("/");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [router]);

  const handleBack = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-blue-500" />
              统计仪表盘
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              回顾你的写作节奏，看看这一年的笔记足迹。
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回笔记
          </Button>
        </header>

        {loading ? (
          <StatsSkeleton />
        ) : error ? (
          <div className="border border-destructive/40 bg-destructive/5 text-destructive text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : !stats ? (
          <div className="border border-border bg-accent/40 text-sm px-4 py-3 rounded-lg text-muted-foreground">
            暂无统计数据。
          </div>
        ) : (
          <main className="space-y-8">
            <TopCards stats={stats} />
            <HeatmapSection stats={stats} />
            <BottomSection stats={stats} userId={userId} />
          </main>
        )}
      </div>
    </div>
  );
}

// --- Skeleton ---

function StatsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-muted/60 border border-border/60 animate-pulse"
          />
        ))}
      </div>
      <div className="h-56 rounded-xl bg-muted/60 border border-border/60 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl bg-muted/60 border border-border/60 h-64 animate-pulse" />
        <div className="rounded-xl bg-muted/60 border border-border/60 h-64 lg:col-span-2 animate-pulse" />
      </div>
    </div>
  );
}

// --- Top Cards ---

function TopCards({ stats }: { stats: DashboardStats }) {
  const {
    userStats: { totalNotes, notesThisWeek, totalChars, activeDays },
  } = stats;

  const cards = [
    {
      label: "总笔记数",
      value: totalNotes,
      icon: FileText,
    },
    {
      label: "本周新增",
      value: notesThisWeek,
      icon: Calendar,
    },
    {
      label: "总字数",
      value: totalChars,
      icon: Type,
    },
    {
      label: "活跃天数",
      value: activeDays,
      icon: BarChart2,
    },
  ];

  return (
    <section>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-card/60 backdrop-blur-sm px-4 py-3 flex flex-col justify-between shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                {card.label}
              </span>
              <card.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-semibold">
              {card.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- Heatmap ---

function HeatmapSection({ stats }: { stats: DashboardStats }) {
  const { heatmap } = stats;
  const hasData = heatmap.some((d) => d.count > 0);

  return (
    <section className="rounded-xl border border-border bg-card/60 px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-500" />
            一年写作热力图
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            颜色越深代表当天写得越多（基于笔记字数）。
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
          过去一年还没有任何笔记活动。
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <div className="inline-flex gap-3">
            {/* 星期标签 */}
            <div className="flex flex-col justify-between py-1 text-[10px] text-muted-foreground">
              <span>一</span>
              <span>三</span>
              <span>五</span>
              <span>日</span>
            </div>
            {/* 热力格子 */}
            <div className="grid grid-flow-col auto-cols-[10px] grid-rows-7 gap-[3px]">
              {heatmap.map((day) => (
                <div
                  key={day.date}
                  title={`${day.date} · ${day.count} 字`}
                  className={cn(
                    "w-[10px] h-[10px] rounded-[3px] border border-transparent transition-colors",
                    // 字数为 0：纯背景色（白色系）
                    day.count === 0 && "bg-background border-border/30",
                    // 有字数：按强度映射为绿色系
                    day.count > 0 && day.intensity === 0 && "bg-emerald-100",
                    day.count > 0 && day.intensity === 1 && "bg-emerald-100",
                    day.count > 0 && day.intensity === 2 && "bg-emerald-300",
                    day.count > 0 && day.intensity === 3 && "bg-emerald-500",
                    day.count > 0 && day.intensity === 4 && "bg-emerald-700"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// --- Bottom section: folder pie + recent notes ---

function BottomSection({
  stats,
  userId,
}: {
  stats: DashboardStats;
  userId: string | null;
}) {
  const { folderDistribution, recentNotes } = stats;
  const totalForPie = folderDistribution.reduce(
    (acc, item) => acc + item.count,
    0
  );

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Folder pie */}
      <div className="rounded-xl border border-border bg-card/60 px-4 py-4 shadow-sm">
        <h2 className="text-sm font-semibold mb-1">文件夹分布</h2>
        <p className="text-xs text-muted-foreground mb-3">
          不同文件夹下笔记数量的占比情况。
        </p>
        {totalForPie === 0 ? (
          <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
            还没有任何笔记可用于统计。
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="w-full md:w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={folderDistribution}
                    dataKey="count"
                    nameKey="folderName"
                    innerRadius="60%"
                    outerRadius="90%"
                    paddingAngle={2}
                  >
                    {folderDistribution.map((entry, index) => (
                      <Cell
                        key={entry.folderId ?? `none-${index}`}
                        fill={getFolderColor(index)}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: any, _name, props) => {
                      const percent =
                        totalForPie === 0
                          ? 0
                          : ((value as number) / totalForPie) * 100;
                      return [
                        `${value} 篇 (${percent.toFixed(1)}%)`,
                        props.payload?.folderName ?? "",
                      ];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2 text-xs">
              {folderDistribution.map((item, index) => (
                <div
                  key={item.folderId ?? `none-${index}`}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: getFolderColor(index) }}
                    />
                    <span className="truncate max-w-[140px]">
                      {item.folderName}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {item.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent notes */}
      <div className="lg:col-span-2 rounded-xl border border-border bg-card/60 px-4 py-4 shadow-sm">
        <h2 className="text-sm font-semibold mb-1">最近编辑</h2>
        <p className="text-xs text-muted-foreground mb-3">
          最近更新的几篇笔记，可以作为今天写作的起点。
        </p>
        {recentNotes.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
            还没有任何笔记，去 /dashboard 写下第一篇吧。
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {recentNotes.map((note) => (
              <li
                key={note.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate">
                    {note.title || "未命名笔记"}
                  </span>
                  <span className="text-xs text-muted-foreground mt-0.5">
                    {note.folderName || "未分组"} ·{" "}
                    {note.updatedAt
                      ? new Date(note.updatedAt).toLocaleString()
                      : "时间未知"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}


