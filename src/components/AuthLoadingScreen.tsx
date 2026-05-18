"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type AuthLoadingScreenProps = {
  loading: boolean;
  authError: string | null;
  onRetry: () => void;
};

export default function AuthLoadingScreen({
  loading,
  authError,
  onRetry,
}: AuthLoadingScreenProps) {
  const router = useRouter();

  if (authError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 bg-background text-foreground">
        <p className="text-sm text-muted-foreground text-center max-w-sm">{authError}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.replace("/")}>
            返回登录
          </Button>
          <Button onClick={onRetry}>重试</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return null;
}
