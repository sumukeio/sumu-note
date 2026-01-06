"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MindNoteManager from "@/components/MindNoteManager";

export default function MindNotesPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [folderName, setFolderName] = useState<string>("");

  const folderId = searchParams.get("folder");

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }
      setUser(user);
      setLoading(false);
    };
    checkUser();
  }, [router]);

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

  if (loading) {
    return null;
  }

  if (!user) {
    return null;
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







