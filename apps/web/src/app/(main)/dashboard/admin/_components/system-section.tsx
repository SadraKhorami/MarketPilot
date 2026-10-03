"use client";

import type { ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function SystemSection({
  title,
  description,
  icon: Icon,
  summary,
  actions,
  children,
  defaultOpen = true,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  summary?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground"
    >
      <div className="flex min-w-0 items-center gap-3 px-4 py-2">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="group aria-expanded:bg-transparent"
            aria-label={`Toggle ${title}`}
          >
            <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h3 className="shrink-0 font-medium text-sm">{title}</h3>
        <p className="hidden min-w-0 flex-1 truncate text-muted-foreground text-xs sm:block">{description}</p>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {summary}
          {actions}
        </div>
      </div>
      <CollapsibleContent className="border-t">{children}</CollapsibleContent>
    </Collapsible>
  );
}
