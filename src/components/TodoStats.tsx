"use client";

import { useEffect, useState } from "react";
import { getTodos, type Todo } from "@/lib/todo-storage";
import { getPriorityColor } from "@/lib/todo-utils";
import { Loader2 } from "lucide-react";

interface TodoStatsProps {
  userId: string;
}

interface StatsData {
  today: {
    total: number;
    completed: number;
    completionRate: number;
  };
  week: {
    total: number;
    completed: number;
    completionRate: number;
  };
  month: {
    total: number;
    completed: number;
    completionRate: number;
  };
  byPriority: {
    [key: number]: { total: number; completed: number };
  };
  byTag: {
    [tag: string]: { total: number; completed: number };
  };
}

export default function TodoStats({ userId }: TodoStatsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        // 获取所有任务
        const allTodosResult = await getTodos(userId, {
          parent_id: null, // 只统计顶级任务
        });
        const allTodos = allTodosResult.todos;

        // 计算日期范围
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);

        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 本周一

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // 筛选任务
        const todayTodos = allTodos.filter((todo) => {
          if (!todo.due_date) return false;
          const dueDate = new Date(todo.due_date);
          return dueDate >= todayStart && dueDate < todayEnd;
        });

        const weekTodos = allTodos.filter((todo) => {
          if (!todo.due_date) return false;
          const dueDate = new Date(todo.due_date);
          return dueDate >= weekStart;
        });

        const monthTodos = allTodos.filter((todo) => {
          if (!todo.due_date) return false;
          const dueDate = new Date(todo.due_date);
          return dueDate >= monthStart;
        });

        // 计算统计数据
        const calculateStats = (todos: Todo[]) => {
          const total = todos.length;
          const completed = todos.filter((t) => t.status === "done").length;
          const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
          return { total, completed, completionRate };
        };

        // 按优先级统计
        const byPriority: { [key: number]: { total: number; completed: number } } = {};
        allTodos.forEach((todo) => {
          const priority = todo.priority;
          if (!byPriority[priority]) {
            byPriority[priority] = { total: 0, completed: 0 };
          }
          byPriority[priority].total++;
          if (todo.status === "done") {
            byPriority[priority].completed++;
          }
        });

        // 按标签统计
        const byTag: { [tag: string]: { total: number; completed: number } } = {};
        allTodos.forEach((todo) => {
          todo.tags?.forEach((tag) => {
            if (!byTag[tag]) {
              byTag[tag] = { total: 0, completed: 0 };
            }
            byTag[tag].total++;
            if (todo.status === "done") {
              byTag[tag].completed++;
            }
          });
        });

        setStats({
          today: calculateStats(todayTodos),
          week: calculateStats(weekTodos),
          month: calculateStats(monthTodos),
          byPriority,
          byTag,
        });
      } catch (error) {
        console.error("Failed to load stats:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const priorityLabels: { [key: number]: string } = {
    0: "无优先级",
    1: "低优先级",
    2: "中优先级",
    3: "高优先级",
  };

  return (
    <div className="flex-1 overflow-y-auto p-2 sm:p-4">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* 时间统计 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-lg border border-border bg-card/60 p-4">
            <div className="text-sm font-medium text-muted-foreground mb-3">
              今日
            </div>
            <div className="text-2xl font-bold">
              {stats.today.completed} / {stats.today.total}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              完成率: {stats.today.completionRate}%
            </div>
            <div className="mt-3 h-2 bg-accent rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${stats.today.completionRate}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card/60 p-4">
            <div className="text-sm font-medium text-muted-foreground mb-3">
              本周
            </div>
            <div className="text-2xl font-bold">
              {stats.week.completed} / {stats.week.total}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              完成率: {stats.week.completionRate}%
            </div>
            <div className="mt-3 h-2 bg-accent rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${stats.week.completionRate}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card/60 p-4">
            <div className="text-sm font-medium text-muted-foreground mb-3">
              本月
            </div>
            <div className="text-2xl font-bold">
              {stats.month.completed} / {stats.month.total}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              完成率: {stats.month.completionRate}%
            </div>
            <div className="mt-3 h-2 bg-accent rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${stats.month.completionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* 按优先级统计 */}
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <div className="text-lg font-semibold mb-4">按优先级统计</div>
          <div>
            <div className="space-y-4">
              {[3, 2, 1, 0].map((priority) => {
                const data = stats.byPriority[priority];
                if (!data || data.total === 0) return null;

                const completionRate =
                  data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;

                return (
                  <div key={priority} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor:
                              priority > 0 ? getPriorityColor(priority as 0 | 1 | 2 | 3) : "#6B7280",
                          }}
                        />
                        <span className="text-sm font-medium">
                          {priorityLabels[priority]}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {data.completed} / {data.total} ({completionRate}%)
                      </div>
                    </div>
                    <div className="h-2 bg-accent rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${completionRate}%`,
                          backgroundColor:
                            priority > 0 ? getPriorityColor(priority as 0 | 1 | 2 | 3) : "#6B7280",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 按标签统计 */}
        {Object.keys(stats.byTag).length > 0 && (
          <div className="rounded-lg border border-border bg-card/60 p-4">
            <div className="text-lg font-semibold mb-4">按标签统计</div>
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(stats.byTag)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([tag, data]) => {
                    const completionRate =
                      data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;

                    return (
                      <div key={tag} className="space-y-2 p-3 border border-border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">#{tag}</span>
                          <span className="text-xs text-muted-foreground">
                            {data.completed} / {data.total}
                          </span>
                        </div>
                        <div className="h-2 bg-accent rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          完成率: {completionRate}%
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

