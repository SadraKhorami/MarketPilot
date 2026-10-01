"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const ArchitectureFlow = dynamic(() => import("./architecture-flow").then((module) => module.ArchitectureFlow), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col gap-4 rounded-xl border p-6" role="status" aria-label="Loading architecture map">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-80 w-full md:aspect-[3/2] md:h-auto md:max-h-[50rem] md:min-h-[38rem]" />
      <span className="sr-only">Loading interactive architecture…</span>
    </div>
  ),
});

export function ArchitectureOverview() {
  return <ArchitectureFlow />;
}
