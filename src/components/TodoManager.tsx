"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  List,
  Calendar,
  LayoutGrid,
  Grid3x3,
  Plus,
  Loader2,
  Search,
  Filter,
  ArrowUpDown,
  BarChart3,
  Settings,
  GitBranch,
  GanttChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTodoLists, type TodoList } from "@/lib/todo-storage";
import TodoListSidebar from "./TodoListSidebar";
import TodoListView from "./TodoListView";
import TodoStats from "./TodoStats";
import TodoFilters, { type FilterOptions } from "./TodoFilters";
import QuickAddTodo from "./QuickAddTodo";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "calendar" | "kanban" | "quadrant" | "timeline" | "gantt" | "stats";

interface TodoManagerProps {
  userId: string;
}

export default function TodoManager({ userId }: TodoManagerProps) {
  const router = useRouter();
  const [lists, setLists] = useState<TodoList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null | "today" | "done">(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "todo" | "in_progress" | "done"
  >("all");
  const [sortBy, setSortBy] = useState<
    "order_index" | "due_date" | "priority" | "created_at" | "title"
  >("order_index");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<FilterOptions>({
    status: "all",
    priority: "all",
    tags: [],
    listId: null,
    dueDateFrom: null,
    dueDateTo: null,
  });
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 加载清单列表
  useEffect(() => {
    const loadLists = async () => {
      try {
        const todoLists = await getTodoLists(userId);
        setLists(todoLists);

        // 设置默认清单
        const defaultList = todoLists.find((list) => list.is_default);
        if (defaultList) {
          setSelectedListId(defaultList.id);
        } else if (todoLists.length > 0) {
          setSelectedListId(todoLists[0].id);
        }
      } catch (error) {
        console.error("Failed to load todo lists:", error);
      } finally {
        setLoading(false);
      }
    };

    loadLists();
  }, [userId]);

  // 搜索防抖
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleListSelect = (listId: string | null | "today" | "done") => {
    setSelectedListId(listId);
  };

  const handleListCreated = (newList: TodoList) => {
    setLists((prev) => [...prev, newList]);
    if (newList.is_default) {
      setSelectedListId(newList.id);
    }
  };

  const handleListUpdated = (updatedList: TodoList) => {
    setLists((prev) =>
      prev.map((list) => (list.id === updatedList.id ? updatedList : list))
    );
  };

  const handleListDeleted = (listId: string) => {
    setLists((prev) => prev.filter((list) => list.id !== listId));
    if (selectedListId === listId) {
      // 使用更新后的列表查找默认清单
      const remainingLists = lists.filter((list) => list.id !== listId);
      const defaultList = remainingLists.find((list) => list.is_default);
      setSelectedListId(defaultList?.id || remainingLists[0]?.id || null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 bg-background/80 backdrop-blur z-20 border-b border-border/40">
        <div className="flex items-center justify-between px-2 sm:px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard")}
              className="shrink-0 -ml-1 sm:-ml-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-base sm:text-lg font-bold truncate">任务管理</h1>
            {/* 移动端侧边栏切换按钮 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="shrink-0 md:hidden"
            >
              <List className="w-5 h-5" />
            </Button>
          </div>

          {/* 视图切换按钮 */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              title="列表视图"
              className="shrink-0"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("calendar")}
              title="日历视图"
              className="shrink-0"
            >
              <Calendar className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("kanban")}
              title="看板视图"
              className="shrink-0"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "quadrant" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("quadrant")}
              title="四象限视图"
              className="shrink-0"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "timeline" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("timeline")}
              title="时间线视图"
              className="shrink-0"
            >
              <GitBranch className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "gantt" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("gantt")}
              title="甘特图视图"
              className="shrink-0"
            >
              <GanttChart className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "stats" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("stats")}
              title="统计视图"
              className="shrink-0"
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/settings")}
              title="设置"
              className="shrink-0"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 搜索和筛选栏（仅在列表视图显示） */}
        {viewMode === "list" && (
          <div className="px-2 sm:px-4 pb-3 space-y-2">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索任务..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-accent/50 border-none h-9"
              />
            </div>

            {/* 筛选和排序 */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                筛选
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (sortOrder === "asc") {
                    setSortOrder("desc");
                  } else {
                    setSortOrder("asc");
                  }
                }}
                className="flex items-center gap-2"
              >
                <ArrowUpDown className="w-4 h-4" />
                排序
              </Button>
            </div>

            {/* 筛选面板 */}
            {showFilters && (
              <div className="space-y-3">
                <TodoFilters
                  lists={lists}
                  filters={advancedFilters}
                  onFiltersChange={(filters) => {
                    setAdvancedFilters(filters);
                    // 同步基础筛选
                    if (filters.status !== "all") {
                      setStatusFilter(filters.status);
                    }
                  }}
                  onClose={() => setShowFilters(false)}
                />
                {/* 排序选择 */}
                <div className="bg-accent/50 rounded-lg p-3">
                  <label className="text-xs text-muted-foreground mb-2 block">
                    排序方式
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {(
                      [
                        { value: "order_index", label: "自定义" },
                        { value: "due_date", label: "截止日期" },
                        { value: "priority", label: "优先级" },
                        { value: "created_at", label: "创建时间" },
                        { value: "title", label: "标题" },
                      ] as const
                    ).map((s) => (
                      <Button
                        key={s.value}
                        variant={sortBy === s.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSortBy(s.value)}
                      >
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside
          className={cn(
            "w-64 border-r border-border bg-background/50 transition-all duration-300",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "hidden md:block"
          )}
        >
          <TodoListSidebar
            lists={lists}
            selectedListId={selectedListId}
            onSelectList={handleListSelect}
            onListCreated={handleListCreated}
            onListUpdated={handleListUpdated}
            onListDeleted={handleListDeleted}
            userId={userId}
          />
        </aside>

        {/* 移动端侧边栏遮罩 */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* 移动端侧边栏 */}
        <aside
          className={cn(
            "fixed left-0 top-0 bottom-0 w-64 bg-background border-r border-border z-40 transition-transform duration-300 md:hidden",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <TodoListSidebar
            lists={lists}
            selectedListId={selectedListId}
            onSelectList={(id) => {
              handleListSelect(id);
              setSidebarOpen(false);
            }}
            onListCreated={handleListCreated}
            onListUpdated={handleListUpdated}
            onListDeleted={handleListDeleted}
            userId={userId}
          />
        </aside>

        {/* 主内容 */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {viewMode === "stats" ? (
            <TodoStats userId={userId} />
          ) : (
            <>
              <TodoListView
                userId={userId}
                listId={selectedListId}
                viewMode={viewMode}
                refreshKey={refreshKey}
                searchQuery={debouncedSearchQuery}
                statusFilter={advancedFilters.status !== "all" ? advancedFilters.status : statusFilter}
                priorityFilter={advancedFilters.priority !== "all" ? advancedFilters.priority : undefined}
                tagsFilter={advancedFilters.tags.length > 0 ? advancedFilters.tags : undefined}
                listIdFilter={advancedFilters.listId !== null ? advancedFilters.listId : undefined}
                dueDateFrom={advancedFilters.dueDateFrom}
                dueDateTo={advancedFilters.dueDateTo}
                sortBy={sortBy}
                sortOrder={sortOrder}
              />

              {/* 快速添加任务 */}
              <QuickAddTodo
                userId={userId}
                listId={selectedListId}
                onTaskCreated={() => {
                  // 任务创建后刷新列表
                  setRefreshKey((prev) => prev + 1);
                }}
                onSwitchToToday={() => {
                  // 自动切换到"今天"清单
                  setSelectedListId("today");
                }}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

