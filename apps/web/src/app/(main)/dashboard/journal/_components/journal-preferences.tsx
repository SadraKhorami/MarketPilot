"use client";
import { useState } from "react";

import { type TradePreferences, TradePreferencesSchema } from "@marketpilot/ai/contracts";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest } from "@/lib/api/client";

import { TradePreferenceFields } from "./trade-preference-fields";
export function JournalPreferences({
  initial,
  close,
  saved,
}: {
  initial: TradePreferences;
  close: () => void;
  saved: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!TradePreferencesSchema.safeParse(value).success || pending) return;
    setPending(true);
    setError(null);
    try {
      await apiRequest("/journal/preferences", { method: "PATCH", body: JSON.stringify(value) });
      saved();
      close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Preferences could not be saved.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) close();
      }}
    >
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Trading preferences</SheetTitle>
          <SheetDescription>Your saved context for AI trade plans. Changes apply to future plans.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <TradePreferenceFields value={value} onChange={setValue} disabled={pending} />
          {error ? (
            <p role="alert" className="mt-4 text-destructive text-sm">
              {error}
            </p>
          ) : null}
        </div>
        <SheetFooter>
          <Button disabled={pending || !TradePreferencesSchema.safeParse(value).success} onClick={() => void save()}>
            {pending ? "Saving…" : "Save preferences"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
