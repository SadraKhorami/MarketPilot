import { useMemo } from "react";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

import type { Article } from "./news-types";

export function NewsCoverageSidebar({ articles }: { articles: Article[] }) {
  const coverage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const article of articles) {
      if (!article.publishedAt) continue;
      const day = new Date(article.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return Array.from(counts, ([day, count]) => ({ day, count })).reverse();
  }, [articles]);
  const topics = [...new Set(articles.flatMap((article) => article.sourceCategories))];

  return (
    <aside className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Publication activity</CardTitle>
          <CardDescription>Stories in the current edition</CardDescription>
        </CardHeader>
        <CardContent>
          {coverage.length ? (
            <ChartContainer
              config={{ count: { label: "Stories", color: "var(--color-sky-500)" } }}
              className="aspect-auto h-40 w-full"
            >
              <BarChart accessibilityLayer data={coverage} margin={{ left: -25, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} fontSize={10} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-muted-foreground text-sm">Publication dates will appear when stories load.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Topics in this edition</CardTitle>
          <CardDescription>Publisher categories</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {topics.length ? (
            topics.map((topic) => (
              <Badge key={topic} variant="outline">
                {topic}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-sm">No categories available.</span>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Sentiment</CardTitle>
          <CardAction>
            <Badge variant="outline">Coming later</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-6">
            Read the source to form your own view. Automated sentiment scores are not available yet.
          </p>
        </CardContent>
      </Card>
      <p className="px-1 text-muted-foreground text-xs leading-5">
        Headlines and excerpts are attributed to their publishers. Full articles open at the original source. Coverage
        updates automatically.
      </p>
    </aside>
  );
}
