"use client";

import { useState, useEffect } from "react";
import {
  X,
  Loader2,
  Calendar,
  Flag,
  Tag,
  List,
  Trash2,
  Save,
  Plus,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  updateTodo,
  deleteTodo,
  getTodoLists,
  getSubtodos,
  createSubtodo,
  type Todo,
  type TodoList,
  type RepeatRule,
} from "@/lib/todo-storage";
import { formatDateTime, getPriorityColor, parseTaskInput } from "@/lib/todo-utils";
import { getUserSettings } from "@/lib/user-settings";
import { cn } from "@/lib/utils";

interface TodoDetailProps {
  todo: Todo;
  userId: string;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}

export default function TodoDetail({
  todo,
  userId,
  onClose,
  onUpdate,
  onDelete,
}: TodoDetailProps) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description || "");
  const [priority, setPriority] = useState<0 | 1 | 2 | 3>(todo.priority);
  const [status, setStatus] = useState<
    "todo" | "in_progress" | "done" | "archived"
  >(todo.status);
  const [dueDate, setDueDate] = useState(
    todo.due_date ? new Date(todo.due_date).toISOString().split("T")[0] : ""
  );
  const [dueTime, setDueTime] = useState(
    todo.due_date
      ? new Date(todo.due_date).toTimeString().slice(0, 5)
      : ""
  );
  const [reminderTime, setReminderTime] = useState(
    todo.reminder_time
      ? new Date(todo.reminder_time).toISOString().slice(0, 16)
      : ""
  );
  const [listId, setListId] = useState<string | null>(todo.list_id);
  const [tags, setTags] = useState<string[]>(todo.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [lists, setLists] = useState<TodoList[]>([]);
  const [subtodos, setSubtodos] = useState<Todo[]>([]);
  const [subtodoInput, setSubtodoInput] = useState("");
  const [editingSubtodoId, setEditingSubtodoId] = useState<string | null>(null);
  const [editingSubtodoTitle, setEditingSubtodoTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reminderBeforeMinutes, setReminderBeforeMinutes] = useState(15);
  const [isReminderManuallySet, setIsReminderManuallySet] = useState(false);
  
  // 重复规则状态
  const [repeatRule, setRepeatRule] = useState<RepeatRule | null>(todo.repeat_rule);
  const [repeatType, setRepeatType] = useState<"none" | "daily" | "weekly" | "monthly" | "yearly" | "custom">(
    todo.repeat_rule ? todo.repeat_rule.type : "none"
  );
  const [repeatInterval, setRepeatInterval] = useState<number>(
    todo.repeat_rule?.interval || 1
  );
  const [repeatDaysOfWeek, setRepeatDaysOfWeek] = useState<number[]>(
    todo.repeat_rule?.days_of_week || []
  );
  const [repeatDayOfMonth, setRepeatDayOfMonth] = useState<number | undefined>(
    todo.repeat_rule?.day_of_month
  );
  const [repeatEndDate, setRepeatEndDate] = useState<string>(
    todo.repeat_rule?.end_date ? new Date(todo.repeat_rule.end_date).toISOString().split("T")[0] : ""
  );
  const [repeatEndAfterCount, setRepeatEndAfterCount] = useState<number | undefined>(
    todo.repeat_rule?.end_after_count
  );

  // 加载用户设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getUserSettings(userId);
        setReminderBeforeMinutes(settings.reminder_before_minutes);
      } catch (error) {
        console.error("Failed to load user settings:", error);
      }
    };
    loadSettings();
  }, [userId]);

  // 自动设置提醒时间（当截止日期或时间改变时，且用户未手动设置）
  useEffect(() => {
    if (!isReminderManuallySet) {
      if (dueDate && dueTime) {
        const dueDateTime = new Date(`${dueDate}T${dueTime}`);
        const reminderDateTime = new Date(dueDateTime);
        reminderDateTime.setMinutes(reminderDateTime.getMinutes() - reminderBeforeMinutes);
        setReminderTime(reminderDateTime.toISOString().slice(0, 16));
      } else if (dueDate && !dueTime) {
        // 如果只有日期没有时间，设置为当天9点前指定分钟数
        const reminderDateTime = new Date(`${dueDate}T08:${String(60 - reminderBeforeMinutes).padStart(2, '0')}`);
        setReminderTime(reminderDateTime.toISOString().slice(0, 16));
      }
    }
  }, [dueDate, dueTime, reminderBeforeMinutes, isReminderManuallySet]);

  // 加载清单列表和子任务
  useEffect(() => {
    const loadData = async () => {
      try {
        const [listsData, subtodosData] = await Promise.all([
          getTodoLists(userId),
          getSubtodos(todo.id),
        ]);
        setLists(listsData);
        setSubtodos(subtodosData);
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    };
    loadData();
  }, [userId, todo.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 组合日期和时间
      let dueDateValue: string | null = null;
      if (dueDate) {
        const dateTime = dueTime
          ? `${dueDate}T${dueTime}:00`
          : `${dueDate}T00:00:00`;
        dueDateValue = new Date(dateTime).toISOString();
      }

      // 构建重复规则
      let repeatRuleValue: RepeatRule | null = null;
      if (repeatType !== "none") {
        repeatRuleValue = {
          type: repeatType,
          interval: repeatInterval,
          end_date: repeatEndDate || null,
          end_after_count: repeatEndAfterCount || null,
        };
        
        if (repeatType === "weekly" && repeatDaysOfWeek.length > 0) {
          repeatRuleValue.days_of_week = repeatDaysOfWeek;
        }
        if (repeatType === "monthly" && repeatDayOfMonth) {
          repeatRuleValue.day_of_month = repeatDayOfMonth;
        }
      }

      await updateTodo(todo.id, {
        title,
        description: description || null,
        priority,
        status,
        due_date: dueDateValue,
        reminder_time: reminderTime || null,
        list_id: listId,
        tags,
        repeat_rule: repeatRuleValue,
      });
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Failed to update todo:", error);
      alert("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("确定要删除这个任务吗？")) {
      return;
    }

    setLoading(true);
    try {
      await deleteTodo(todo.id);
      onDelete();
      onClose();
    } catch (error) {
      console.error("Failed to delete todo:", error);
      alert("删除失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleAddSubtodo = async () => {
    const title = subtodoInput.trim();
    if (!title) return;

    setLoading(true);
    try {
      // 使用智能识别解析输入
      const parsed = parseTaskInput(title, reminderBeforeMinutes);
      
      await createSubtodo(todo.id, {
        title: parsed.title,
        list_id: listId,
        due_date: parsed.due_date || null,
        reminder_time: parsed.reminder_time || null,
        tags: parsed.tags,
        priority: parsed.priority,
      });
      const updatedSubtodos = await getSubtodos(todo.id);
      setSubtodos(updatedSubtodos);
      setSubtodoInput("");
    } catch (error) {
      console.error("Failed to create subtodo:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubtodo = async (subtodo: Todo) => {
    setLoading(true);
    try {
      await updateTodo(subtodo.id, {
        status: subtodo.status === "done" ? "todo" : "done",
      });
      const updatedSubtodos = await getSubtodos(todo.id);
      setSubtodos(updatedSubtodos);
      onUpdate();
    } catch (error) {
      console.error("Failed to toggle subtodo:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubtodo = (subtodo: Todo) => {
    setEditingSubtodoId(subtodo.id);
    setEditingSubtodoTitle(subtodo.title);
  };

  const handleSaveSubtodo = async (subtodoId: string) => {
    const title = editingSubtodoTitle.trim();
    if (!title) {
      setEditingSubtodoId(null);
      return;
    }

    setLoading(true);
    try {
      await updateTodo(subtodoId, { title });
      const updatedSubtodos = await getSubtodos(todo.id);
      setSubtodos(updatedSubtodos);
      setEditingSubtodoId(null);
      setEditingSubtodoTitle("");
    } catch (error) {
      console.error("Failed to update subtodo:", error);
      alert("更新失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubtodo = async (subtodoId: string) => {
    if (!confirm("确定要删除这个子任务吗？")) {
      return;
    }

    setLoading(true);
    try {
      await deleteTodo(subtodoId);
      const updatedSubtodos = await getSubtodos(todo.id);
      setSubtodos(updatedSubtodos);
    } catch (error) {
      console.error("Failed to delete subtodo:", error);
      alert("删除失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-background rounded-lg border border-border w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border shrink-0">
          <h2 className="text-base sm:text-lg font-semibold">任务详情</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {/* 标题 */}
          <div>
            <Label>标题</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="任务标题"
              className="mt-1"
            />
          </div>

          {/* 描述 */}
          <div>
            <Label>描述</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="任务描述（可选）"
              className="mt-1 min-h-[100px]"
            />
          </div>

          {/* 状态和优先级 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>状态</Label>
              <div className="mt-1 flex gap-2">
                {(
                  [
                    { value: "todo", label: "待办" },
                    { value: "in_progress", label: "进行中" },
                    { value: "done", label: "已完成" },
                    { value: "archived", label: "已归档" },
                  ] as const
                ).map((s) => (
                  <Button
                    key={s.value}
                    variant={status === s.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatus(s.value)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>优先级</Label>
              <div className="mt-1 flex gap-2">
                {[0, 1, 2, 3].map((p) => (
                  <Button
                    key={p}
                    variant={priority === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPriority(p as 0 | 1 | 2 | 3)}
                    className="flex items-center gap-1"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          priority === p ? getPriorityColor(p) : "transparent",
                      }}
                    />
                    {p === 0
                      ? "无"
                      : p === 1
                      ? "低"
                      : p === 2
                      ? "中"
                      : "高"}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* 日期时间 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>截止日期</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>

            <div>
              <Label>提醒时间</Label>
              <Input
                type="datetime-local"
                value={reminderTime}
                onChange={(e) => {
                  setReminderTime(e.target.value);
                  setIsReminderManuallySet(true);
                }}
                className="mt-1"
              />
              {!isReminderManuallySet && (
                <p className="text-xs text-muted-foreground mt-1">
                  将自动设置为截止时间前 {reminderBeforeMinutes} 分钟
                </p>
              )}
            </div>
          </div>

          {/* 清单 */}
          <div>
            <Label>清单</Label>
            <select
              value={listId || ""}
              onChange={(e) => setListId(e.target.value || null)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">无清单</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </div>

          {/* 标签 */}
          <div>
            <Label>标签</Label>
            <div className="mt-1 flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-accent text-accent-foreground text-sm"
                >
                  #{tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="添加标签"
                className="flex-1"
              />
              <Button onClick={handleAddTag} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* 重复规则 */}
          <div>
            <Label>重复规则</Label>
            <div className="mt-1 space-y-3">
              <select
                value={repeatType}
                onChange={(e) => {
                  const newType = e.target.value as typeof repeatType;
                  setRepeatType(newType);
                  if (newType === "none") {
                    setRepeatRule(null);
                  }
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="none">不重复</option>
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
                <option value="yearly">每年</option>
                <option value="custom">自定义</option>
              </select>

              {repeatType !== "none" && (
                <div className="space-y-2 pl-4 border-l-2 border-border">
                  {/* 重复间隔 */}
                  {(repeatType === "daily" || repeatType === "custom") && (
                    <div>
                      <Label className="text-xs">每</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          min="1"
                          value={repeatInterval}
                          onChange={(e) => setRepeatInterval(parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">
                          {repeatType === "daily" ? "天" : "天"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 每周重复 - 选择星期几 */}
                  {repeatType === "weekly" && (
                    <div>
                      <Label className="text-xs">重复于</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {[
                          { value: 0, label: "日" },
                          { value: 1, label: "一" },
                          { value: 2, label: "二" },
                          { value: 3, label: "三" },
                          { value: 4, label: "四" },
                          { value: 5, label: "五" },
                          { value: 6, label: "六" },
                        ].map((day) => (
                          <Button
                            key={day.value}
                            variant={repeatDaysOfWeek.includes(day.value) ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              if (repeatDaysOfWeek.includes(day.value)) {
                                setRepeatDaysOfWeek(repeatDaysOfWeek.filter((d) => d !== day.value));
                              } else {
                                setRepeatDaysOfWeek([...repeatDaysOfWeek, day.value]);
                              }
                            }}
                          >
                            {day.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 每月重复 - 选择日期 */}
                  {repeatType === "monthly" && (
                    <div>
                      <Label className="text-xs">每月第几天</Label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={repeatDayOfMonth || ""}
                        onChange={(e) => setRepeatDayOfMonth(parseInt(e.target.value) || undefined)}
                        className="mt-1 w-32"
                      />
                    </div>
                  )}

                  {/* 重复结束条件 */}
                  <div className="space-y-2">
                    <Label className="text-xs">结束条件</Label>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="repeatEnd"
                          checked={!repeatEndDate && !repeatEndAfterCount}
                          onChange={() => {
                            setRepeatEndDate("");
                            setRepeatEndAfterCount(undefined);
                          }}
                        />
                        <span>永不结束</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="repeatEnd"
                          checked={!!repeatEndDate}
                          onChange={() => {
                            if (!repeatEndDate) {
                              const nextMonth = new Date();
                              nextMonth.setMonth(nextMonth.getMonth() + 1);
                              setRepeatEndDate(nextMonth.toISOString().split("T")[0]);
                            }
                          }}
                        />
                        <span>结束于</span>
                        <Input
                          type="date"
                          value={repeatEndDate}
                          onChange={(e) => setRepeatEndDate(e.target.value)}
                          className="flex-1"
                          disabled={!repeatEndDate}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="repeatEnd"
                          checked={!!repeatEndAfterCount}
                          onChange={() => {
                            if (!repeatEndAfterCount) {
                              setRepeatEndAfterCount(10);
                            }
                          }}
                        />
                        <span>重复</span>
                        <Input
                          type="number"
                          min="1"
                          value={repeatEndAfterCount || ""}
                          onChange={(e) => setRepeatEndAfterCount(parseInt(e.target.value) || undefined)}
                          className="w-20"
                          disabled={!repeatEndAfterCount}
                        />
                        <span>次后结束</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 子任务 */}
          <div>
            <Label>子任务</Label>
            <div className="mt-2 space-y-2">
              {subtodos.map((subtodo) => (
                <div
                  key={subtodo.id}
                  className="flex items-center gap-2 p-2 rounded bg-accent/50"
                >
                  <button
                    onClick={() => handleToggleSubtodo(subtodo)}
                    disabled={loading}
                  >
                    {subtodo.status === "done" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  {editingSubtodoId === subtodo.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={editingSubtodoTitle}
                        onChange={(e) => setEditingSubtodoTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveSubtodo(subtodo.id);
                          } else if (e.key === "Escape") {
                            setEditingSubtodoId(null);
                            setEditingSubtodoTitle("");
                          }
                        }}
                        className="flex-1 h-8 text-sm"
                        autoFocus
                        disabled={loading}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSaveSubtodo(subtodo.id)}
                        disabled={loading}
                      >
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingSubtodoId(null);
                          setEditingSubtodoTitle("");
                        }}
                        disabled={loading}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span
                        className={cn(
                          "flex-1 text-sm cursor-pointer",
                          subtodo.status === "done" && "line-through text-muted-foreground"
                        )}
                        onDoubleClick={() => handleEditSubtodo(subtodo)}
                      >
                        {subtodo.title}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditSubtodo(subtodo)}
                          disabled={loading}
                          className="h-6 w-6 p-0"
                        >
                          <span className="text-xs">✏️</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteSubtodo(subtodo.id)}
                          disabled={loading}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={subtodoInput}
                  onChange={(e) => setSubtodoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSubtodo();
                    }
                  }}
                  placeholder="添加子任务... (支持智能识别：明天下午3点 #工作 @重要)"
                  className="flex-1"
                  disabled={loading}
                />
                <Button onClick={handleAddSubtodo} size="sm" disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || saving}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            删除
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  保存
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

