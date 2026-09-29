import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AIAnalystLoading() {
  return (
    <div
      className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]"
      aria-label="Loading AI Analyst workspace"
      role="status"
    >
      <Card className="shadow-none">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <Skeleton className="h-6 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
