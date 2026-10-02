"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import { CollectionSearch, FilterSelect } from "../../_components/collection-filters";
import { MarketSymbolField } from "../../_components/market-symbol-field";
import { type NewsPeriod, newsPeriods } from "./news-period";

interface NewsFiltersProps {
  search: string;
  asset: string;
  category: string;
  categories: string[];
  period: NewsPeriod;
  onSearch: (value: string) => void;
  onAsset: (value: string) => void;
  onCategory: (value: string) => void;
  onPeriod: (value: NewsPeriod) => void;
  onClear: () => void;
}

export function NewsFilters(props: NewsFiltersProps) {
  const active = Boolean(props.search || props.asset || props.category || props.period !== "all");
  return (
    <Card>
      <CardHeader>
        <CardTitle>News coverage</CardTitle>
        <CardDescription>Explore headlines by topic, market and publication date.</CardDescription>
        <div className="flex min-w-0 flex-wrap items-center gap-2 pt-2">
          <CollectionSearch value={props.search} onChange={props.onSearch} placeholder="Company, topic or headline…" />
          <FilterSelect
            label="News category"
            value={props.category || "__all__"}
            options={[
              ["__all__", "All categories"],
              ...props.categories.map((category): [string, string] => [category, category]),
            ]}
            onChange={(value) => props.onCategory(value === "__all__" ? "" : value)}
          />
          <Label htmlFor="news-asset" className="sr-only">
            News asset
          </Label>
          <MarketSymbolField
            id="news-asset"
            value={props.asset}
            onChange={props.onAsset}
            className="h-8 sm:w-40"
            compact
            allowAll
            allowUnavailable
          />
          <FilterSelect
            label="Publication date"
            value={props.period}
            options={newsPeriods.map((period) => [period.value, period.label])}
            onChange={(value) => {
              const period = newsPeriods.find((item) => item.value === value);
              if (period) props.onPeriod(period.value);
            }}
          />
          {active && (
            <Button variant="ghost" size="sm" onClick={props.onClear} className="sm:ml-auto">
              <RotateCcw data-icon="inline-start" />
              Reset filters
            </Button>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
