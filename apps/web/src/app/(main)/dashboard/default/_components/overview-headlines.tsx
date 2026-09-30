import Link from "next/link";

import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type OverviewNews = {
  total: number;
  articles: Array<{ id: string; source: string; title: string; originalUrl: string; publishedAt: string | null }>;
};

export function OverviewHeadlines({ news, loading }: { news: OverviewNews | null; loading: boolean }) {
  const articles = news?.articles ?? [];
  const pending = loading && !news;

  return (
    <Card className="h-full min-w-0">
      <CardHeader>
        <CardTitle>Latest headlines</CardTitle>
        <CardDescription>Your market briefing</CardDescription>
        <CardAction>
          <Badge variant="outline">{news?.total ?? "—"} stories</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {pending ? (
          <div className="flex flex-1 flex-col justify-between gap-4" role="status" aria-label="Loading headlines">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <Skeleton key={item} className="h-12 w-full" />
            ))}
          </div>
        ) : null}
        {!pending && articles.length > 0 ? (
          <ol className="flex flex-1 flex-col divide-y">
            {articles.map((article, index) => (
              <li key={article.id} className="flex flex-1 items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="self-start pt-0.5 font-mono text-muted-foreground text-xs" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <a
                    href={article.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-2 font-medium text-sm leading-5 hover:underline"
                  >
                    {article.title}
                  </a>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {article.source}
                    {article.publishedAt ? ` · ${new Date(article.publishedAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
        {!pending && articles.length === 0 ? (
          <p className="flex flex-1 items-center justify-center rounded-lg border bg-muted/20 p-4 text-center text-muted-foreground text-sm">
            {news ? "No stored headlines are available yet." : "Headline data is unavailable."}
          </p>
        ) : null}
        <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
          <Link href="/dashboard/news-and-sentiment">
            Read market news <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
