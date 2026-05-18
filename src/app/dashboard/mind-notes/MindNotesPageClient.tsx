"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import AuthLoadingScreen from "@/components/AuthLoadingScreen";
import MindNoteManager from "@/components/MindNoteManager";

export default function MindNotesPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, authError, retry } = useRequireAuth();
  const [folderName, setFolderName] = useState<string>("");

  const folderId = searchParams.get("folder");

  // 获取文件夹名称
  useEffect(() => {
    if (folderId && user) {
      supabase
        .from("folders")
        .select("name")
        .eq("id", folderId)
        .single()
        .then(({ data }) => {
          if (data) {
            setFolderName(data.name);
          }
        });
    } else {
      setFolderName("");
    }
  }, [folderId, user]);

  const handleBack = () => {
    router.push("/dashboard/mind-notes");
  };

  if (!user) {
    return (
      <AuthLoadingScreen loading={loading} authError={authError} onRetry={retry} />
    );
  }

  return (
    <MindNoteManager
      userId={user.id}
      folderId={folderId || null}
      folderName={folderName}
      onBack={folderId ? handleBack : undefined}
    />
  );
}









