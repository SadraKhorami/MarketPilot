import { Bookmark, Clock3, ExternalLink, Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { type Article, formatDate } from "./news-types";

export function NewsStoryCard({
  article,
  saved,
  onSave,
  onOpen,
}: {
  article: Article;
  saved: boolean;
  onSave: (article: Article) => void;
  onOpen: (article: Article) => void;
}) {
  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Newspaper className="size-3.5" />
          </span>
          {article.source}
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${saved ? "Unsave" : "Save"} ${article.title}`}
            aria-pressed={saved}
            onClick={() => onSave(article)}
          >
            <Bookmark className={saved ? "fill-current" : undefined} />
          </Button>
        </CardAction>
        <CardTitle>
          <button
            type="button"
            className="text-left leading-6 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onOpen(article)}
          >
            {article.title}
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {article.description ? (
          <p className="line-clamp-3 text-muted-foreground text-sm leading-6">{article.description}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-1.5">
          {[...article.sourceCategories, ...article.affectedAssets].slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <Clock3 className="size-3" />
          {formatDate(article.publishedAt)}
        </span>
        <Button variant="ghost" size="sm" asChild>
          <a href={article.originalUrl} target="_blank" rel="noopener noreferrer">
            Read story <ExternalLink data-icon="inline-end" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
