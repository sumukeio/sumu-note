"use client";

import { useEffect } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import AuthLoadingScreen from "@/components/AuthLoadingScreen";
import TodoManager from "@/components/TodoManager";
import { initReminderSystem, cleanupReminderSystem } from "@/lib/todo-reminder";

export default function TodosPageClient() {
  const { user, loading, authError, retry } = useRequireAuth();

  useEffect(() => {
    if (!user?.id) return;
    initReminderSystem(user.id).catch((err) => {
      console.error("Failed to init reminder system:", err);
    });
    return () => {
      cleanupReminderSystem();
    };
  }, [user?.id]);

  if (!user) {
    return (
      <AuthLoadingScreen loading={loading} authError={authError} onRetry={retry} />
    );
  }

  return <TodoManager userId={user.id} />;
}

