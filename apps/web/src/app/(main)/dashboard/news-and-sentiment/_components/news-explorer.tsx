"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { articleMatchesAsset } from "@marketpilot/market-data";
import { cn } from "cn";
import { Bookmark, Globe2, Newspaper, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import { useMarketCatalog } from "../../_components/market-catalog-provider";
import { MarketSymbolField } from "../../_components/market-symbol-field";
import { ResourceState } from "../../_components/resource-state";
import { NewsArticlePreview } from "./news-article-preview";
import { NewsCoverageSidebar } from "./news-coverage-sidebar";
import { NewsPagination } from "./news-pagination";
import { NewsStoryCard } from "./news-story-card";
import type { Article, NewsResponse } from "./news-types";

const pageSize = 12;

export function NewsExplorer() {
  const catalog = useMarketCatalog();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [asset, setAsset] = useState("");
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Article | null>(null);
  const [saved, setSaved] = useState<Record<string, Article>>({});
  const [view, setView] = useState("all");
  const lastAttempt = useRef(0);
  const requestVersion = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchDraft.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    lastAttempt.current = Date.now();
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set("search", search);
      if (asset) params.set("asset", asset);
      const result = await apiRequest<ApiEnvelope<NewsResponse>>(`/news?${params}`);
      if (version !== requestVersion.current) return;
      if (result.data.totalPages > 0 && page > result.data.totalPages) {
        setPage(result.data.totalPages);
        return;
      }
      setResponse(result.data);
      setError(null);
    } catch (reason) {
      if (version === requestVersion.current)
        setError(reason instanceof Error ? reason.message : "News is unavailable.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [asset, page, search]);

  useEffect(() => {
    setResponse(null);
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5 * 60_000);
    const resume = () => {
      if (document.visibilityState === "visible" && Date.now() - lastAttempt.current >= 5 * 60_000) void load();
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      requestVersion.current++;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [load]);

  const savedArticles = Object.values(saved).filter((article) => {
    const matchesAsset =
      !asset ||
      articleMatchesAsset(article, asset, catalog.data?.instruments.find((item) => item.symbol === asset)?.name);
    const text = `${article.title} ${article.source} ${article.description ?? ""}`.toLowerCase();
    return matchesAsset && (!search || text.includes(search.toLowerCase()));
  });
  const articles = view === "saved" ? savedArticles : (response?.articles ?? []);
  const sources = new Set(articles.map((article) => article.source));
  const toggleSaved = (article: Article) =>
    setSaved((current) => {
      const next = { ...current };
      if (next[article.id]) delete next[article.id];
      else next[article.id] = article;
      return next;
    });
  const savedCount = Object.keys(saved).length;
  let emptyTitle = "No matching headlines";
  if (view === "saved") emptyTitle = savedCount ? "No matching saved stories" : "Your reading list is empty";
  const exploreFromEmptyList = view === "saved" && savedCount === 0;
  const resultsLoading = view === "all" && loading && !response;
  let resultsLabel = "No matching stories";
  if (view === "saved") resultsLabel = `${articles.length} of ${savedCount} saved stories · this visit`;
  else if (loading) resultsLabel = "Finding stories…";
  else if (response?.total)
    resultsLabel = `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, response.total)} of ${response.total} stories`;
  const changePage = (value: number) => {
    setPage(value);
    document.getElementById("news-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-3 gap-2 sm:gap-4" aria-label="News overview">
        {[
          {
            label: "Matching headlines",
            value: response ? String(response.total) : "—",
            detail: search || asset ? "For your current filters" : "In your news library",
            icon: Newspaper,
          },
          {
            label: "Sources in this edition",
            value: response ? String(sources.size) : "—",
            detail: [...sources].join(", ") || "Original publishers",
            icon: Globe2,
          },
          {
            label: "Reading list",
            value: String(Object.keys(saved).length),
            detail: "Saved for this visit",
            icon: Bookmark,
          },
        ].map((item) => (
          <Card key={item.label} className="gap-3 py-4 sm:gap-6 sm:py-6">
            <CardHeader className="px-3 sm:px-6">
              <CardDescription className="text-xs sm:text-sm">{item.label}</CardDescription>
              <CardAction className="hidden sm:block">
                <item.icon className="size-4 text-muted-foreground" />
              </CardAction>
              <CardTitle className="text-2xl tabular-nums">{item.value}</CardTitle>
            </CardHeader>
            <CardContent className="hidden sm:block">
              <p className="truncate text-muted-foreground text-xs">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <Card>
        <CardContent>
          <FieldGroup
            className={cn(
              "grid min-w-0 grid-cols-1 items-end gap-3",
              searchDraft || asset
                ? "@2xl/main:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_auto]"
                : "@2xl/main:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]",
            )}
          >
            <Field className="min-w-0 @2xl/main:max-w-md">
              <FieldLabel htmlFor="news-search">Search coverage</FieldLabel>
              <InputGroup className="h-10">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  id="news-search"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Company, topic or headline…"
                />
              </InputGroup>
            </Field>
            <Field className="min-w-0">
              <FieldLabel htmlFor="news-asset">Asset</FieldLabel>
              <MarketSymbolField
                id="news-asset"
                value={asset}
                onChange={(value) => {
                  setAsset(value);
                  setPage(1);
                }}
                allowAll
                allowUnavailable
              />
            </Field>
            {searchDraft || asset ? (
              <Button
                variant="ghost"
                className="h-10 shrink-0"
                onClick={() => {
                  setSearchDraft("");
                  setSearch("");
                  setAsset("");
                  setPage(1);
                }}
              >
                <X data-icon="inline-start" />
                Clear
              </Button>
            ) : null}
          </FieldGroup>
          {asset && response?.assetFilter?.symbol === asset ? (
            <p className="mt-3 text-muted-foreground text-xs">
              Matching asset tags or headline/excerpt keywords: {response.assetFilter.terms.join(" · ")}. Search
              coverage narrows these results further.
            </p>
          ) : null}
        </CardContent>
      </Card>
      {error ? (
        <ResourceState loading={false} error={error} title="Coverage could not be updated" retry={() => void load()} />
      ) : null}
      <div className={`grid items-start gap-5 ${view === "all" ? "xl:grid-cols-[minmax(0,1fr)_280px]" : ""}`}>
        <section
          id="news-results"
          className="flex min-w-0 scroll-mt-20 flex-col gap-4"
          aria-label="News results"
          aria-busy={view === "all" && loading}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <ToggleGroup
                type="single"
                value={view}
                onValueChange={(value) => {
                  if (value) setView(value);
                }}
                variant="outline"
                size="sm"
                spacing={0}
                aria-label="News view"
              >
                <ToggleGroupItem value="all">Latest coverage</ToggleGroupItem>
                <ToggleGroupItem value="saved">Reading list ({Object.keys(saved).length})</ToggleGroupItem>
              </ToggleGroup>
              <p className="text-muted-foreground text-xs" aria-live="polite">
                {resultsLabel}
              </p>
            </div>
            <NewsPagination
              page={page}
              totalPages={view === "all" ? (response?.totalPages ?? 0) : 0}
              loading={loading}
              onChange={changePage}
            />
          </div>
          {resultsLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((key) => (
                <Card key={key}>
                  <CardContent className="flex flex-col gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
          {!resultsLoading && articles.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {articles.map((article) => (
                <NewsStoryCard
                  key={article.id}
                  article={article}
                  saved={Boolean(saved[article.id])}
                  onSave={toggleSaved}
                  onOpen={setSelected}
                />
              ))}
            </div>
          ) : null}
          {!resultsLoading && (view === "saved" || !loading) && articles.length === 0 ? (
            <Card>
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Search />
                  </EmptyMedia>
                  <EmptyTitle>{emptyTitle}</EmptyTitle>
                  <EmptyDescription>
                    {exploreFromEmptyList
                      ? "Save a story using its bookmark button, or explore more coverage."
                      : "Try another topic or clear your filters to see more stories."}
                  </EmptyDescription>
                </EmptyHeader>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchDraft("");
                    setSearch("");
                    setAsset("");
                    if (exploreFromEmptyList) setView("all");
                  }}
                >
                  {exploreFromEmptyList ? "Explore coverage" : "Clear filters"}
                </Button>
              </Empty>
            </Card>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-muted-foreground text-xs">
              {view === "all" && response ? `Page ${page} of ${Math.max(1, response.totalPages)}` : resultsLabel}
            </p>
            <NewsPagination
              page={page}
              totalPages={view === "all" ? (response?.totalPages ?? 0) : 0}
              loading={loading}
              onChange={changePage}
            />
          </div>
        </section>
        {view === "all" ? <NewsCoverageSidebar articles={articles} /> : null}
      </div>
      <NewsArticlePreview article={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
