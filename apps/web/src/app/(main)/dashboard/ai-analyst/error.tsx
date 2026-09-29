"use client";

import { useEffect } from "react";

import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AIAnalystError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Error details are intentionally not logged from this frontend-only preview.
    void error.digest;
  }, [error.digest]);

  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>AI Analyst could not be loaded</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>No conversation was sent. You can retry loading the workspace.</span>
        <Button variant="outline" size="sm" onClick={reset}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
