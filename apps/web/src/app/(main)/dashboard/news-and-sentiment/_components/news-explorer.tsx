"use client";

import { useMemo, useState } from "react";

import { FileText, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type DemoNewsArticle, demoAssets, demoNews } from "@/data/marketpilot";

import { FixtureNote, StatusBadge } from "../../_components/marketpilot-page";

export function NewsExplorer() {
  const [query, setQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState("all");
  const [selected, setSelected] = useState<DemoNewsArticle | null>(null);
  const articles = useMemo(
    () =>
      demoNews.filter((article) => {
        const matchesText = `${article.headline} ${article.category} ${article.asset}`
          .toLowerCase()
          .includes(query.toLowerCase());
        return matchesText && (assetFilter === "all" || article.asset === assetFilter);
      }),
    [assetFilter, query],
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Positive", "42%", "sample sentiment"],
          ["Mixed", "38%", "sample sentiment"],
          ["Negative", "20%", "sample sentiment"],
        ].map(([label, value, detail]) => (
          <Card key={label} className="shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm">{label}</p>
                <StatusBadge value={label} />
              </div>
              <p className="mt-2 font-semibold text-2xl">{value}</p>
              <p className="text-muted-foreground text-xs">{detail} · not provider data</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">News feed</CardTitle>
          <CardDescription>Demo articles · no external provider or live headlines</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search headlines or topics"
                className="pl-9"
                aria-label="Search news"
              />
            </div>
            <Select value={assetFilter} onValueChange={setAssetFilter}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Filter by asset">
                <SelectValue placeholder="All assets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assets</SelectItem>
                {demoAssets.map((asset) => (
                  <SelectItem key={asset.symbol} value={asset.symbol}>
                    {asset.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="divide-y rounded-lg border">
            {articles.map((article) => (
              <article
                key={article.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{article.category}</Badge>
                    <Badge variant="outline">{article.asset}</Badge>
                    <span className="text-muted-foreground text-xs">{article.publishedAt} · Demo feed</span>
                  </div>
                  <h2 className="font-medium leading-6">{article.headline}</h2>
                  <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">{article.summary}</p>
                  <Button variant="link" className="mt-2 h-auto px-0" onClick={() => setSelected(article)}>
                    Read article preview
                  </Button>
                </div>
                <div className="shrink-0">
                  <StatusBadge value={article.sentiment} />
                </div>
              </article>
            ))}
            {articles.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
                <p className="mt-2 font-medium text-sm">No matching headlines</p>
                <p className="mt-1 text-muted-foreground text-sm">Change the asset filter or search terms.</p>
              </div>
            ) : null}
          </div>
          <FixtureNote>
            Article text is untrusted sample content. No article has been fetched from an external source.
          </FixtureNote>
        </CardContent>
      </Card>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selected?.headline}</DialogTitle>
            <DialogDescription>
              {selected?.category} · {selected?.asset} · {selected?.publishedAt} · Demo feed
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Illustrative sentiment</span>
              {selected ? <StatusBadge value={selected.sentiment} /> : null}
            </div>
            <p className="text-muted-foreground text-sm leading-6">{selected?.summary}</p>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              This article is a local UI fixture. It is not a live headline, and no external source is connected.
            </div>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
