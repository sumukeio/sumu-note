"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface NoteStatsProps {
  content: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  className?: string;
}

/**
 * 格式化日期为友好格式
 * @param dateString ISO 日期字符串
 * @returns 格式化后的日期字符串，如 "2024年1月20日 14:30"
 */
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "未知";
  
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    
    return `${year}年${month}月${day}日 ${hours}:${minutes}`;
  } catch (error) {
    console.error("Failed to format date:", error);
    return "未知";
  }
}

/**
 * 笔记统计信息组件
 * 显示字数、创建时间、最后编辑时间
 */
export default function NoteStats({
  content,
  createdAt,
  updatedAt,
  className,
}: NoteStatsProps) {
  // 使用 useMemo 优化字数计算
  const wordCount = useMemo(() => {
    return content.length;
  }, [content]);

  return (
    <div
      className={cn(
        "flex items-center gap-4 text-xs text-muted-foreground px-2 py-1.5 border-t border-border/40 bg-background/50",
        className
      )}
    >
      <span>字数: {wordCount}</span>
      {createdAt && (
        <span>创建于 {formatDate(createdAt)}</span>
      )}
      {updatedAt && (
        <span>最后编辑于 {formatDate(updatedAt)}</span>
      )}
    </div>
  );
}
