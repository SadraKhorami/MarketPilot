import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@/components/ui/pagination";

export function NewsPagination({
  page,
  totalPages,
  loading,
  onChange,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (value) => value === 1 || value === totalPages || Math.abs(value - page) <= 1,
  );
  return (
    <Pagination aria-label="News pages" className="mx-0 w-auto">
      <PaginationContent>
        <PaginationItem>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Previous page"
            disabled={loading || page <= 1}
            onClick={() => onChange(page - 1)}
          >
            <ChevronLeft />
          </Button>
        </PaginationItem>
        {pages.map((value, index) => (
          <PaginationItem key={value} className="flex items-center gap-1">
            {index > 0 && value - pages[index - 1] > 1 ? <PaginationEllipsis /> : null}
            <Button
              size="icon"
              className="size-8"
              variant={page === value ? "outline" : "ghost"}
              aria-label={`Page ${value}`}
              aria-current={page === value ? "page" : undefined}
              disabled={loading}
              onClick={() => onChange(value)}
            >
              {value}
            </Button>
          </PaginationItem>
        ))}
        <PaginationItem>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Next page"
            disabled={loading || page >= totalPages}
            onClick={() => onChange(page + 1)}
          >
            <ChevronRight />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
