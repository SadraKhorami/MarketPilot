"use client";
import { useState } from "react";
import { Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketSymbolField, marketName } from "../../_components/market-symbol-field";
import {
  defaultOverviewPreferences,
  historyRanges,
  type HistoryRange,
  type OverviewPreferences,
} from "./overview-preferences";

export type SettingsSection = "pulse" | "history" | "headlines";
export function OverviewSettingsButton({
  section,
  onOpen,
  disabled,
}: {
  section: SettingsSection;
  onOpen: (section: SettingsSection) => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={disabled}
      aria-label={`Configure ${section === "pulse" ? "Market pulse" : section === "history" ? "Market history" : "Latest headlines"}`}
      onClick={() => onOpen(section)}
    >
      <Settings2 />
    </Button>
  );
}
function AssetSelection({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string[];
  onChange: (symbols: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      <MarketSymbolField
        id={id}
        value=""
        placeholder="Add an asset…"
        onChange={(symbol) => {
          if (!value.includes(symbol)) onChange([...value, symbol]);
        }}
        excluded={value}
        disabled={value.length >= 12}
      />
      <ul className="flex flex-wrap gap-2">
        {value.map((symbol) => (
          <li key={symbol} className="flex items-center gap-1 rounded-md border pl-2 text-sm">
            <span>{marketName(symbol)}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${symbol}`}
              onClick={() => onChange(value.filter((item) => item !== symbol))}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
export function OverviewSettings({
  section,
  onClose,
  preferences,
  onChange,
  categories,
}: {
  section: SettingsSection | null;
  onClose: () => void;
  preferences: OverviewPreferences;
  onChange: (value: OverviewPreferences) => void;
  categories: string[];
}) {
  const [tab, setTab] = useState<SettingsSection>(section ?? "pulse");
  const [draft, setDraft] = useState(preferences);
  const patch = (values: Partial<OverviewPreferences>) => setDraft((current) => ({ ...current, ...values }));
  return (
    <Sheet
      open={!!section}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="data-[side=right]:w-full sm:max-w-md">
        <SheetHeader className="border-b pb-4 pr-12">
          <SheetTitle>Customize your dashboard</SheetTitle>
          <SheetDescription>Choose what you follow. Saved for your account in this browser.</SheetDescription>
        </SheetHeader>
        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (value === "pulse" || value === "history" || value === "headlines") setTab(value);
          }}
          className="min-h-0 flex-1 gap-5 overflow-y-auto px-4"
        >
          <TabsList className="w-full">
            <TabsTrigger value="pulse">Pulse</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="headlines">Headlines</TabsTrigger>
          </TabsList>
          <TabsContent value="pulse" className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="pulse-assets">Market pulse assets</FieldLabel>
                <AssetSelection id="pulse-assets" value={draft.pulse} onChange={(pulse) => patch({ pulse })} />
              </Field>
            </FieldGroup>
            <p className="text-muted-foreground text-sm">
              Up to 12 cards. More than four scroll gently on desktop. Hover or focus to pause.
            </p>
          </TabsContent>
          <TabsContent value="history">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="history-asset">Chart asset</FieldLabel>
                <MarketSymbolField
                  id="history-asset"
                  value={draft.historySymbol}
                  onChange={(historySymbol) => patch({ historySymbol })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="history-range">Time range</FieldLabel>
                <Select
                  value={draft.historyRange}
                  onValueChange={(value) => {
                    if (Object.hasOwn(historyRanges, value)) patch({ historyRange: value as HistoryRange });
                  }}
                >
                  <SelectTrigger id="history-range" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.entries(historyRanges).map(([key, range]) => (
                        <SelectItem key={key} value={key}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </TabsContent>
          <TabsContent value="headlines" className="space-y-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="headline-assets">News assets</FieldLabel>
                <AssetSelection
                  id="headline-assets"
                  value={draft.newsAssets}
                  onChange={(newsAssets) => patch({ newsAssets })}
                />
                <p className="text-muted-foreground text-xs">No assets selected means all assets.</p>
              </Field>
              <Field>
                <FieldLabel htmlFor="headline-category">News categories</FieldLabel>
                <Select
                  value=""
                  disabled={!categories.length}
                  onValueChange={(category) => {
                    if (!draft.newsCategories.includes(category))
                      patch({ newsCategories: [...draft.newsCategories, category] });
                  }}
                >
                  <SelectTrigger id="headline-category" className="h-10 w-full">
                    <SelectValue placeholder={categories.length ? "Add a category…" : "No stored categories yet"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {categories
                        .filter((category) => !draft.newsCategories.includes(category))
                        .map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <ul className="flex flex-wrap gap-2">
                  {draft.newsCategories.map((category) => (
                    <li key={category} className="flex items-center gap-1 rounded-md border pl-2 text-sm">
                      <span>{category}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${category}`}
                        onClick={() =>
                          patch({ newsCategories: draft.newsCategories.filter((item) => item !== category) })
                        }
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground text-xs">
                  No categories selected means all categories. Results match any selected asset and any selected
                  category.
                </p>
              </Field>
            </FieldGroup>
          </TabsContent>
        </Tabs>
        <SheetFooter className="border-t">
          <Button
            onClick={() => {
              onChange(draft);
              onClose();
            }}
          >
            Save preferences
          </Button>
          <Button variant="ghost" onClick={() => setDraft(defaultOverviewPreferences)}>
            Restore defaults
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
