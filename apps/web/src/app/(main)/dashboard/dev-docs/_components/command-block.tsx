"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CommandBlock({ code, label }: { code: string; label: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Could not copy. Select the command and copy it manually.");
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-muted/50 p-3 sm:flex-row sm:items-start sm:justify-between">
      <pre dir="ltr" className="min-w-0 flex-1 overflow-x-auto py-1 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 self-end sm:self-start"
        onClick={() => void copy()}
        aria-label={`Copy ${label}`}
      >
        <Copy data-icon="inline-start" />
        Copy
      </Button>
    </div>
  );
}
