import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import MindNotesPageClient from "./MindNotesPageClient";

export default function MindNotesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MindNotesPageClient />
    </Suspense>
  );
}
