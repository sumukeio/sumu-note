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
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTodoLists, type TodoList, type Todo } from "@/lib/todo-storage";
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
  const [newTodo, setNewTodo] = useState<Todo | null>(null);
  const [mobileViewMenuOpen, setMobileViewMenuOpen] = useState(false);
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
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* 顶部导航栏 - 移动端安全区与触摸区域 */}
      <header className="shrink-0 bg-background/80 backdrop-blur z-20 border-b border-border/40 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-2 sm:px-4 py-3 gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard")}
              className="shrink-0 -ml-1 sm:-ml-2 min-w-10 min-h-10 touch-manipulation md:min-w-9 md:min-h-9"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-base sm:text-lg font-bold truncate">任务管理</h1>
            {/* 移动端侧边栏切换按钮 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="shrink-0 md:hidden min-w-10 min-h-10 touch-manipulation"
            >
              <List className="w-5 h-5" />
            </Button>
          </div>

          {/* 视图切换：移动端仅列表+日历+更多，桌面端全部展示 */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              title="列表视图"
              className="shrink-0 min-w-9 min-h-9 touch-manipulation md:min-w-8 md:min-h-8"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("calendar")}
              title="日历视图"
              className="shrink-0 min-w-9 min-h-9 touch-manipulation md:min-w-8 md:min-h-8"
            >
              <Calendar className="w-4 h-4" />
            </Button>
            {/* 移动端：更多视图（下拉） */}
            <div className="relative md:hidden">
              <Button
                variant={mobileViewMenuOpen ? "default" : "ghost"}
                size="icon"
                onClick={() => setMobileViewMenuOpen((v) => !v)}
                title="更多视图"
                className="shrink-0 min-w-9 min-h-9 touch-manipulation"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
              {mobileViewMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMobileViewMenuOpen(false)}
                    aria-hidden
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 py-1 rounded-lg border border-border bg-background shadow-lg min-w-[140px]">
                    {(
                      [
                        { mode: "kanban" as ViewMode, label: "看板", Icon: LayoutGrid },
                        { mode: "quadrant" as ViewMode, label: "四象限", Icon: Grid3x3 },
                        { mode: "timeline" as ViewMode, label: "时间线", Icon: GitBranch },
                        { mode: "gantt" as ViewMode, label: "甘特图", Icon: GanttChart },
                        { mode: "stats" as ViewMode, label: "统计", Icon: BarChart3 },
                      ] as const
                    ).map(({ mode, label, Icon }) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setViewMode(mode);
                          setMobileViewMenuOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent",
                          viewMode === mode && "bg-accent"
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        router.push("/dashboard/settings");
                        setMobileViewMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent border-t border-border mt-1 pt-2"
                    >
                      <Settings className="w-4 h-4 shrink-0" />
                      设置
                    </button>
                  </div>
                </>
              )}
            </div>
            {/* 桌面端：其余视图与设置 */}
            <div className="hidden md:flex items-center gap-1">
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
        </div>

        {/* 搜索和筛选栏（仅在列表视图显示） */}
        {viewMode === "list" && (
          <div className="px-2 sm:px-4 pb-3 space-y-2">
            {/* 搜索框 - 移动端加大点击区域 */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索任务..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-accent/50 border-none h-10 min-h-10 touch-manipulation sm:h-9 sm:min-h-0"
              />
            </div>

            {/* 筛选和排序 - 移动端加大按钮 */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 min-h-10 touch-manipulation sm:min-h-0"
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
                className="flex items-center gap-2 min-h-10 touch-manipulation sm:min-h-0"
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
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 侧边栏 - 固定在左侧，不随主内容滚动 */}
        <aside
          className={cn(
            "w-64 flex flex-col min-h-0 border-r border-border bg-background/50 transition-all duration-300 shrink-0",
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
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {viewMode === "stats" ? (
            <TodoStats userId={userId} />
          ) : (
            <>
              {/* 列表区域：移动端底部留出固定添加栏+安全区高度 */}
              <div
                className="flex-1 min-h-0 overflow-auto overflow-x-hidden overscroll-contain pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0"
                style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
              >
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
                  newTodo={newTodo}
                />
              </div>
              {/* 快速添加任务 - 移动端固定屏幕底部，桌面端在主区域底部 */}
              <div
                className={cn(
                  "shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
                  "fixed bottom-0 left-0 right-0 z-20 pb-[env(safe-area-inset-bottom)] md:relative md:bottom-auto md:left-auto md:right-auto md:pb-0"
                )}
              >
                <QuickAddTodo
                  userId={userId}
                  listId={selectedListId}
                  onTaskCreated={(todo) => {
                    setNewTodo(todo);
                    setTimeout(() => setNewTodo(null), 100);
                  }}
                  onSwitchToToday={() => {
                    setSelectedListId("today");
                  }}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

