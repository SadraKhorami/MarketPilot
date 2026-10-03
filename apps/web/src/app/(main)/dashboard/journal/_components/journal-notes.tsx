"use client";

import { useEffect, useRef, useState } from "react";
import { journalNoteOutcome, type JournalRecord } from "@marketpilot/ai/contracts";
import { LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api/client";

export function JournalNotes({
  entry,
  notes,
  setNotes,
  pending,
  onSave,
}: {
  entry: JournalRecord;
  notes: string;
  setNotes: (value: string) => void;
  pending: boolean;
  onSave: () => void;
}) {
  const outcome = journalNoteOutcome(entry);
  const [phase, setPhase] = useState<"reading" | "typing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafted, setDrafted] = useState(false);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      generation.current++;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  async function generate() {
    if (!outcome || pending || phase) return;
    const current = ++generation.current;
    const original = notes.trimEnd();
    setPhase("reading");
    setError(null);
    setDrafted(false);
    try {
      const response = await apiRequest<{ data: { note: string; outcome: string } }>(
        `/journal/${entry.id}/note-draft`,
        {
          method: "POST",
        },
      );
      if (generation.current !== current) return;
      const prefix = original ? `${original}\n\n` : "";
      const text = response.data.note.trim();
      if (!text || prefix.length + text.length > 4000) {
        throw new Error("There is not enough room for this review. Shorten your notes and try again.");
      }
      setPhase("typing");
      const characters = Array.from(text);
      let offset = 0;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      function type() {
        if (generation.current !== current) return;
        offset = Math.min(characters.length, offset + (reducedMotion ? characters.length : 16));
        setNotes(prefix + characters.slice(0, offset).join(""));
        if (offset < characters.length) timer.current = setTimeout(type, 24);
        else {
          setPhase(null);
          setDrafted(true);
        }
      }
      type();
    } catch (failure) {
      if (generation.current !== current) return;
      setError(failure instanceof Error ? failure.message : "AI review is unavailable. Try again.");
      setPhase(null);
    }
  }
  return (
    <Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel htmlFor="journal-notes">Your notes</FieldLabel>
        {outcome ? (
          <Button size="sm" variant="outline" disabled={pending || !!phase || drafted} onClick={() => void generate()}>
            {phase ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            {phase === "reading"
              ? "Reviewing trade & market…"
              : phase === "typing"
                ? "Writing review…"
                : drafted
                  ? "AI draft added"
                  : outcome === "sl"
                    ? "Explain stop loss"
                    : outcome === "tp"
                      ? "Explain take profit"
                      : "Explain expiry"}
          </Button>
        ) : null}
      </div>
      <Textarea
        id="journal-notes"
        value={notes}
        maxLength={4000}
        rows={4}
        onChange={(event) => setNotes(event.target.value)}
        disabled={pending || !!phase}
        placeholder="What was your reasoning? What would you change?"
      />
      {phase || drafted ? (
        <p role="status" className="text-muted-foreground text-xs">
          {phase === "reading"
            ? "Reading the recorded outcome and available market data."
            : phase === "typing"
              ? "Adding the AI draft to your notes…"
              : "AI draft · edit it as needed, then save. Uses your AI provider and allowance."}
        </p>
      ) : outcome ? (
        <p className="text-muted-foreground text-xs">AI adds a draft using available evidence · uses allowance.</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={pending || !!phase || notes === entry.notes}
        onClick={onSave}
      >
        Save notes
      </Button>
    </Field>
  );
}
