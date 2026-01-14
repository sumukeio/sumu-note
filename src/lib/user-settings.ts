"use client";

import { supabase } from "./supabase";

export interface UserSettings {
  timezone: string; // 时区，如 "Asia/Shanghai"
  reminder_before_minutes: number; // 提醒时间提前分钟数，默认15
}

const DEFAULT_SETTINGS: UserSettings = {
  timezone: "Asia/Shanghai", // 北京时间
  reminder_before_minutes: 15,
};

/**
 * 获取用户设置
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(); // 使用 maybeSingle 而不是 single，避免在没有记录时抛出错误

    // 如果表不存在或其他错误，静默返回默认值
    if (error) {
      // PGRST116 表示没有找到记录，这是正常的（用户还没有设置）
      // 42P01 表示表不存在，这也是正常的（表可能还没创建）
      if (error.code !== "PGRST116" && error.code !== "42P01") {
        // 只在非预期的错误时记录日志
        console.warn("Failed to get user settings:", error.message || error);
      }
      return DEFAULT_SETTINGS;
    }

    // 如果有数据，返回用户设置
    if (data) {
      return {
        timezone: data.timezone || DEFAULT_SETTINGS.timezone,
        reminder_before_minutes: data.reminder_before_minutes ?? DEFAULT_SETTINGS.reminder_before_minutes,
      };
    }

    // 没有数据，返回默认值
    return DEFAULT_SETTINGS;
  } catch (error) {
    // 捕获任何未预期的错误，返回默认值
    console.warn("Unexpected error getting user settings:", error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * 保存用户设置
 */
export async function saveUserSettings(
  userId: string,
  settings: Partial<UserSettings>
): Promise<void> {
  try {
    const { error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: userId,
        timezone: settings.timezone || DEFAULT_SETTINGS.timezone,
        reminder_before_minutes: settings.reminder_before_minutes ?? DEFAULT_SETTINGS.reminder_before_minutes,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id",
      });

    if (error) {
      console.error("Failed to save user settings:", error);
      throw new Error(error.message || "保存设置失败");
    }
  } catch (error) {
    console.error("Failed to save user settings:", error);
    throw error;
  }
}

/**
 * 获取常用时区列表
 */
export function getCommonTimezones(): Array<{ value: string; label: string; offset: string }> {
  const timezones = [
    { value: "Asia/Shanghai", label: "北京时间 (UTC+8)", offset: "+08:00" },
    { value: "Asia/Hong_Kong", label: "香港时间 (UTC+8)", offset: "+08:00" },
    { value: "Asia/Taipei", label: "台北时间 (UTC+8)", offset: "+08:00" },
    { value: "Asia/Singapore", label: "新加坡时间 (UTC+8)", offset: "+08:00" },
    { value: "Asia/Tokyo", label: "东京时间 (UTC+9)", offset: "+09:00" },
    { value: "Asia/Seoul", label: "首尔时间 (UTC+9)", offset: "+09:00" },
    { value: "Asia/Kolkata", label: "印度时间 (UTC+5:30)", offset: "+05:30" },
    { value: "Europe/London", label: "伦敦时间 (UTC+0)", offset: "+00:00" },
    { value: "Europe/Paris", label: "巴黎时间 (UTC+1)", offset: "+01:00" },
    { value: "Europe/Berlin", label: "柏林时间 (UTC+1)", offset: "+01:00" },
    { value: "America/New_York", label: "纽约时间 (UTC-5)", offset: "-05:00" },
    { value: "America/Chicago", label: "芝加哥时间 (UTC-6)", offset: "-06:00" },
    { value: "America/Denver", label: "丹佛时间 (UTC-7)", offset: "-07:00" },
    { value: "America/Los_Angeles", label: "洛杉矶时间 (UTC-8)", offset: "-08:00" },
    { value: "Australia/Sydney", label: "悉尼时间 (UTC+10)", offset: "+10:00" },
    { value: "Pacific/Auckland", label: "奥克兰时间 (UTC+12)", offset: "+12:00" },
  ];

  return timezones;
}

/**
 * 将UTC时间转换为指定时区的时间
 */
export function convertToTimezone(date: Date, timezone: string): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find((p) => p.type === "year")!.value);
  const month = parseInt(parts.find((p) => p.type === "month")!.value) - 1;
  const day = parseInt(parts.find((p) => p.type === "day")!.value);
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value);
  const second = parseInt(parts.find((p) => p.type === "second")!.value);

  return new Date(year, month, day, hour, minute, second);
}

/**
 * 将指定时区的时间转换为UTC时间
 */
export function convertFromTimezone(
  localDate: Date,
  timezone: string
): Date {
  // 获取时区偏移量
  const utcDate = new Date(localDate.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(localDate.toLocaleString("en-US", { timeZone: timezone }));
  const offset = utcDate.getTime() - tzDate.getTime();

  return new Date(localDate.getTime() - offset);
}

