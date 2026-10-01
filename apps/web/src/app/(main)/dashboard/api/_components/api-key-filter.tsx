"use client";

import { useId, useState } from "react";

import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import type { KeyRecord } from "./api-types";
import { getKeyStatus } from "./key-status";

export function ApiKeyFilter({
  keys,
  value,
  loading,
  onChange,
}: {
  keys: KeyRecord[];
  value: string;
  loading: boolean;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const selected = keys.find((key) => key.id === value);
  let label = value === "all" ? "All keys" : "Selected key unavailable";
  if (selected) label = `${selected.name} · ${selected.prefix}`;
  if (loading) label = "Loading keys…";
  const select = (keyId: string) => {
    onChange(keyId);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label="Filter usage by API key"
          aria-expanded={open}
          aria-controls={id}
          className="w-full min-w-0 justify-between sm:w-72"
          disabled={loading}
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] p-0">
        <Command>
          <CommandInput placeholder="Search key name or prefix…" aria-label="Search API keys" />
          <CommandList id={id} className="max-h-72 overflow-y-auto overscroll-contain">
            <CommandEmpty>No matching keys.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="all" onSelect={() => select("all")}>
                All keys {value === "all" && <Check />}
              </CommandItem>
              {keys.map((key) => (
                <CommandItem
                  key={key.id}
                  value={key.id}
                  keywords={[key.name, key.prefix]}
                  onSelect={() => select(key.id)}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate">{key.name}</span>
                    <span className="truncate text-muted-foreground text-xs">
                      {key.prefix} · {getKeyStatus(key)}
                    </span>
                  </span>
                  {key.id === value && <Check />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
