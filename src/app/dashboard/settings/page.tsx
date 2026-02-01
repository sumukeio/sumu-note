"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  getUserSettings,
  saveUserSettings,
  getCommonTimezones,
  type UserSettings,
} from "@/lib/user-settings";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    timezone: "Asia/Shanghai",
    reminder_before_minutes: 15,
  });
  const timezones = getCommonTimezones();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

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

        setUser(user);

        // 加载用户设置
        const userSettings = await getUserSettings(user.id);
        setSettings(userSettings);
      } catch (error) {
        console.error("Failed to check user:", error);
        router.replace("/");
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [router]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await saveUserSettings(user.id, settings);
      toast({
        title: "保存成功",
        description: "设置已保存",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        title: "保存失败",
        description: "保存设置时出错，请重试",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 pt-[calc(1rem+env(safe-area-inset-top))] sm:pt-6">
        {/* 头部 */}
        <div className="flex items-center gap-3 sm:gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0 min-w-10 min-h-10 touch-manipulation"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold truncate">设置</h1>
        </div>

        {/* 设置内容 */}
        <div className="space-y-6">
          {/* 时区设置 */}
          <div className="space-y-2">
            <Label htmlFor="timezone">时区</Label>
            <SimpleSelect
              id="timezone"
              value={settings.timezone}
              onValueChange={(value) =>
                setSettings({ ...settings, timezone: value })
              }
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </SimpleSelect>
            <p className="text-sm text-muted-foreground">
              选择您所在的时区，用于显示和解析日期时间
            </p>
          </div>

          {/* 提醒时间设置 */}
          <div className="space-y-2">
            <Label htmlFor="reminder_before_minutes">
              提醒时间提前（分钟）
            </Label>
            <Input
              id="reminder_before_minutes"
              type="number"
              min="0"
              max="1440"
              value={settings.reminder_before_minutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  reminder_before_minutes: parseInt(e.target.value) || 15,
                })
              }
            />
            <p className="text-sm text-muted-foreground">
              任务提醒将在截止时间前多少分钟触发（默认15分钟）
            </p>
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="min-h-10 touch-manipulation">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  保存设置
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

