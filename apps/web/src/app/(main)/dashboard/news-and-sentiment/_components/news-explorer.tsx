"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ExternalLink, FileText, RefreshCw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiRequest, type ApiEnvelope } from "@/lib/api/client";

interface Article {
  id: string;
  source: string;
  title: string;
  description: string | null;
  originalUrl: string;
  publishedAt: string | null;
  fetchedAt: string;
  language: string | null;
  sourceCategories: string[];
  affectedAssets: string[];
  category: string | null;
  priority: number | null;
  impactScore: number | null;
  classificationConfidence: number | null;
  classifiedAt: string | null;
}

interface NewsResponse {
  articles: Article[];
  total: number;
  refreshState: {
    enabled?: boolean;
    status?: string;
    checkedAt?: string;
    feeds?: { feedKey: string; status: string; errorCode?: string }[];
  };
  sentiment: null;
}

export function NewsExplorer() {
  const [query, setQuery] = useState("");
  const [asset, setAsset] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [refreshState, setRefreshState] = useState<NewsResponse["refreshState"] | null>(null);
  const [selected, setSelected] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const suffix = asset ? `?asset=${encodeURIComponent(asset.trim().toUpperCase())}` : "";
      const response = await apiRequest<ApiEnvelope<NewsResponse>>(`/news${suffix}`);
      setArticles(response.data.articles);
      setRefreshState(response.data.refreshState);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "News is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [asset]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      articles.filter((article) =>
        `${article.title} ${article.description ?? ""} ${article.sourceCategories.join(" ")} ${article.affectedAssets.join(" ")}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [articles, query],
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm">Articles available</p>
            <p className="mt-2 font-semibold text-2xl">{loading ? "…" : articles.length}</p>
            <p className="text-muted-foreground text-xs">Stored normalized articles</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm">News sentiment</p>
            <p className="mt-2 font-semibold text-2xl">Unavailable</p>
            <p className="text-muted-foreground text-xs">No Phase 3 sentiment source/classifier</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm">RSS ingestion</p>
            <p className="mt-2 font-semibold text-lg">{refreshState?.status ?? "Checking"}</p>
            <p className="text-muted-foreground text-xs">
              {refreshState?.enabled ? "Controlled worker refresh" : "Ingestion disabled or not configured"}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="shadow-none">
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">News feed</CardTitle>
            <CardDescription>
              Investing.com RSS metadata, with original source links and publication timestamps.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh news list"
          >
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
          </Button>
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
            <Input
              value={asset}
              onChange={(event) => setAsset(event.target.value)}
              placeholder="Filter asset (e.g. EURUSD)"
              className="sm:max-w-56"
              aria-label="Filter by affected asset"
              onKeyDown={(event) => {
                if (event.key === "Enter") void load();
              }}
            />
            <Button variant="outline" onClick={() => void load()}>
              Apply
            </Button>
          </div>
          {error ? (
            <div className="rounded-md border border-destructive/40 p-4 text-sm" role="alert">
              <p className="font-medium">News could not be loaded</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
              <Button className="mt-3" variant="outline" size="sm" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          ) : null}
          {loading && articles.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground text-sm" role="status">
              Loading stored news…
            </p>
          ) : null}
          {!loading && !error && filtered.length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <FileText className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 font-medium text-sm">
                {articles.length ? "No matching news" : "No news articles available"}
              </p>
              <p className="mt-1 text-muted-foreground text-sm">
                {refreshState?.enabled
                  ? "The feeds may be empty or have failed their last refresh."
                  : "RSS ingestion is disabled until source display permission and feed configuration are in place."}
              </p>
            </div>
          ) : null}
          <div className="divide-y rounded-lg border">
            {filtered.map((article) => (
              <article
                key={article.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{article.source}</Badge>
                    {article.sourceCategories.map((category) => (
                      <Badge key={category} variant="outline">
                        {category}
                      </Badge>
                    ))}
                    {article.affectedAssets.map((symbol) => (
                      <Badge key={symbol} variant="outline">
                        {symbol}
                      </Badge>
                    ))}
                  </div>
                  <h2 className="font-medium leading-6">{article.title}</h2>
                  <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                    {article.description ?? "No description was supplied by this feed."}
                  </p>
                  <p className="mt-2 text-muted-foreground text-xs">
                    {article.publishedAt
                      ? new Date(article.publishedAt).toLocaleString()
                      : "Publication date not provided"}{" "}
                    · fetched {new Date(article.fetchedAt).toLocaleString()}
                  </p>
                  <Button variant="link" className="mt-1 h-auto px-0" onClick={() => setSelected(article)}>
                    Source details
                  </Button>
                </div>
                <div className="shrink-0 text-muted-foreground text-sm">Sentiment unavailable</div>
              </article>
            ))}
          </div>
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
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>
              {selected?.source} ·{" "}
              {selected?.publishedAt ? new Date(selected.publishedAt).toLocaleString() : "Publication date unavailable"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm leading-6">
              {selected?.description ?? "The source did not provide a description."}
            </p>
            <p className="text-muted-foreground text-xs">
              Feed metadata is treated as untrusted external content. Sentiment and AI classification are not provided
              in this phase.
            </p>
            {selected ? (
              <Button variant="outline" asChild>
                <a href={selected.originalUrl} target="_blank" rel="noreferrer">
                  Open original source <ExternalLink className="ml-2 size-4" />
                </a>
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
