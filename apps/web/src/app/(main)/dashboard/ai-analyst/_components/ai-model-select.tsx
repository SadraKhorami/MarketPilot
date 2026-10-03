"use client";
import { useEffect, useState } from "react";
import type { AiModelRecord } from "@marketpilot/ai/contracts";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useApiResource } from "@/hooks/use-api-resource";
import { CollectionPagination, type PagedResult } from "../../_components/collection-pagination";
import { ResourceState } from "../../_components/resource-state";
export function AiModelSelect({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<AiModelRecord | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const resource = useApiResource<PagedResult<AiModelRecord> & { refreshFailed: boolean }>(
    open ? `/ai/models?search=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}` : null,
  );
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Personal OpenRouter model"
            disabled={disabled}
            className="w-full min-w-0 justify-between"
          >
            <span className="truncate">{selected?.id === value ? selected.name : (value ?? "Choose a model")}</span>
            <ChevronsUpDown data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search models or providers…" value={search} onValueChange={setSearch} />
            <CommandList className="max-h-72">
              <ResourceState {...resource} retry={resource.reload} />
              {!resource.loading && !resource.error && !resource.data?.items.length ? (
                <CommandEmpty>No matching models.</CommandEmpty>
              ) : null}
              <CommandGroup>
                {resource.data?.items.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    disabled={!model.compatible}
                    onSelect={() => {
                      setSelected(model);
                      onChange(model.id);
                      setOpen(false);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{model.name}</p>
                      <p className="truncate text-muted-foreground text-xs">{model.id}</p>
                      <p className="text-muted-foreground text-xs">
                        {model.compatible
                          ? `$${(model.promptPrice * 1e6).toLocaleString()} input / $${(model.completionPrice * 1e6).toLocaleString()} output per million tokens`
                          : "Not compatible with analyst tools, structured answers or fixed pricing"}
                      </p>
                    </div>
                    {value === model.id ? <Check /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          {resource.data && resource.data.total > pageSize ? (
            <CollectionPagination
              page={page}
              pageSize={pageSize}
              total={resource.data.total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          ) : null}
        </PopoverContent>
      </Popover>
      {selected?.id === value ? (
        <p className="text-muted-foreground text-xs">
          Conservative request estimate: $
          {(6 * (24_000 * selected.promptPrice + 1200 * selected.completionPrice + selected.requestPrice)).toFixed(4)}{" "}
          USD.
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        All catalog models are searchable. Only models supporting this analyst’s tools and structured answers can be
        selected.
      </p>
      {resource.data?.refreshFailed ? (
        <p role="status" className="text-muted-foreground text-xs">
          Showing the last saved catalog; refresh is temporarily unavailable.
        </p>
      ) : null}
    </div>
  );
}
