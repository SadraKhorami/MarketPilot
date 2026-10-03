"use client";

import { ChartCandlestick, List, Search, Target } from "lucide-react";

import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

export const researchCommands = [
  { id: "setup", label: "Entry, SL & targets", description: "Review and confirm a trade scenario", icon: Target },
  { id: "analyze", label: "Analyse market", description: "Price, trend, indicators and news", icon: ChartCandlestick },
  { id: "market", label: "Change market", description: "Search for another asset", icon: Search },
  { id: "watchlist", label: "Summarise watchlist", description: "Research your selected watchlist", icon: List },
] as const;

export type ResearchCommand = (typeof researchCommands)[number]["id"];

export function ResearchCommandMenu({
  commands,
  selected,
  onSelectedChange,
  onSelect,
}: {
  commands: ReadonlyArray<(typeof researchCommands)[number]>;
  selected: string;
  onSelectedChange: (value: string) => void;
  onSelect: (command: ResearchCommand) => void;
}) {
  return (
    <Command shouldFilter={false} value={selected} onValueChange={onSelectedChange} className="h-auto border">
      <CommandList aria-label="Research commands" className="max-h-60">
        <CommandEmpty>No matching command.</CommandEmpty>
        <CommandGroup heading="Commands · use ↑ ↓ and Enter">
          {commands.map((command) => (
            <CommandItem key={command.id} value={command.id} onSelect={() => onSelect(command.id)}>
              <command.icon />
              <div className="flex min-w-0 flex-1 flex-col">
                <span>{command.label}</span>
                <span className="text-muted-foreground text-xs">{command.description}</span>
              </div>
              <span className="text-muted-foreground text-xs">/{command.id}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
