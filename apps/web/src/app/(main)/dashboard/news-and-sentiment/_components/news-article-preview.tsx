import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { type Article, formatDate } from "./news-types";

export function NewsArticlePreview({ article, onClose }: { article: Article | null; onClose: () => void }) {
  return (
    <Sheet
      open={Boolean(article)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="gap-4 pt-12">
          <Badge variant="secondary" className="w-fit">
            {article?.source}
          </Badge>
          <SheetTitle className="text-xl leading-7">{article?.title ?? "Article preview"}</SheetTitle>
          <SheetDescription>{article ? formatDate(article.publishedAt) : ""}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <p className="text-muted-foreground leading-7">
            {article?.description ??
              "The publisher did not include an excerpt. Open the original story to read the full article."}
          </p>
          <div className="flex flex-wrap gap-2">
            {article?.affectedAssets.map((symbol) => (
              <Badge key={symbol} variant="outline">
                {symbol}
              </Badge>
            ))}
          </div>
        </div>
        <SheetFooter>
          {article ? (
            <Button asChild>
              <a href={article.originalUrl} target="_blank" rel="noopener noreferrer">
                Read full story at {article.source}
                <ExternalLink data-icon="inline-end" />
              </a>
            </Button>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Publisher excerpt · MarketPilot does not host the full article.
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
