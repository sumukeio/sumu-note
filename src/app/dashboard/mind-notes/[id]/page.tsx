"use client";

import { useParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import AuthLoadingScreen from "@/components/AuthLoadingScreen";
import MindNoteEditor from "@/components/MindNoteEditor";

export default function MindNoteDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading, authError, retry } = useRequireAuth();

  if (!user) {
    return (
      <AuthLoadingScreen loading={loading} authError={authError} onRetry={retry} />
    );
  }

  if (!params.id) {
    return null;
  }

  return <MindNoteEditor mindNoteId={params.id} userId={user.id} />;
}
