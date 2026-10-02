"use client";
import { useState } from "react";

import Link from "next/link";

import type { JournalRecord } from "@marketpilot/ai/contracts";
import { BookOpen, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";
export function SaveJournalPlan({ runId, expired, persian }: { runId: string; expired: boolean; persian: boolean }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (pending || saved || expired) return;
    setPending(true);
    setError(null);
    try {
      const response = await apiRequest<ApiEnvelope<JournalRecord>>("/journal", {
        method: "POST",
        body: JSON.stringify({ runId, confirm: true }),
      });
      setSaved(response.data.id);
      window.dispatchEvent(new Event("marketpilot:journal-changed"));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save this plan.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {saved ? (
          <>
            <span role="status" className="flex items-center gap-1 text-sm">
              <Check className="size-4" />
              {persian ? "در جورنال ذخیره شد" : "Saved to Journal"}
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/journal?entry=${saved}`}>{persian ? "مشاهدهٔ پلن" : "View plan"}</Link>
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" disabled={expired || pending} onClick={() => void save()}>
            <BookOpen data-icon="inline-start" />
            {pending ? "Saving…" : persian ? "تأیید و ذخیره در جورنال" : "Confirm & save to Journal"}
          </Button>
        )}
      </div>
      {!saved ? (
        <p className="text-muted-foreground text-xs">
          {persian ? "ذخیرهٔ پلن، معامله‌ای اجرا نمی‌کند." : "Saving a plan does not place a trade."}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
