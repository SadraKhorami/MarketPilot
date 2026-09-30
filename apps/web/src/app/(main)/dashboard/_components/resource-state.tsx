"use client";
import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
export function ResourceState({
  loading,
  error,
  retry,
  title = "Could not load this view",
}: {
  loading: boolean;
  error: string | null;
  retry: () => void;
  title?: string;
}) {
  if (loading)
    return (
      <div className="flex flex-col gap-3 p-4" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  if (error)
    return (
      <Alert variant="destructive" className="shrink-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-start gap-2">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription className="mt-1 [overflow-wrap:anywhere]">{error}</AlertDescription>
          </div>
        </div>
        <Button variant="outline" size="sm" className="justify-self-start sm:justify-self-end" onClick={retry}>
          Try again
        </Button>
      </Alert>
    );
  return null;
}
