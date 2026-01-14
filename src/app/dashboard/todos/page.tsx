import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import TodosPageClient from "./TodosPageClient";

export default function TodosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <TodosPageClient />
    </Suspense>
  );
}






