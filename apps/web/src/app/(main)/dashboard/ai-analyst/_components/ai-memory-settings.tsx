"use client";
import { useState } from "react";
import { type AiSettingsView, type TradePreferences, TradePreferencesSchema } from "@marketpilot/ai/contracts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest } from "@/lib/api/client";
import { ResourceState } from "../../_components/resource-state";
import { TradePreferenceFields } from "../../journal/_components/trade-preference-fields";
export function AiMemorySettings({ initial, changed }: { initial: AiSettingsView; changed: () => void }) {
  const [language, setLanguage] = useState(initial.language);
  const [memory, setMemory] = useState(initial.memory);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setPending(true);
    setError(null);
    try {
      await apiRequest("/ai/settings", { method: "PATCH", body: JSON.stringify({ language, memory }) });
      changed();
      toast.success("Research memory saved.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Memory could not be saved.");
    } finally {
      setPending(false);
    }
  }
  const trading = useApiResource<TradePreferences>("/journal/preferences");
  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="ai-memory-language">Answer language</FieldLabel>
            <Select
              value={language}
              disabled={pending}
              onValueChange={(value) => {
                if (value === "auto" || value === "fa" || value === "en") setLanguage(value);
              }}
            >
              <SelectTrigger id="ai-memory-language" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="auto">Follow my question</SelectItem>
                  <SelectItem value="fa">فارسی</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="ai-background-memory">Research background</FieldLabel>
            <Textarea
              id="ai-background-memory"
              rows={4}
              maxLength={1200}
              value={memory}
              disabled={pending}
              onChange={(event) => setMemory(event.target.value)}
              placeholder="For example: I’m learning technical analysis, mostly follow crypto, and want uncertainty explained clearly."
            />
            <FieldDescription>
              Optional preferences used in future research. They cannot change the answer structure, authorize trades or
              bypass confirmation. {memory.length}/1200
            </FieldDescription>
          </Field>
        </FieldGroup>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Save research memory"}
        </Button>
      </form>
      <Separator />
      <div className="flex flex-col gap-3">
        <h3 className="font-medium text-sm">Trading memory</h3>
        <p className="text-muted-foreground text-sm">
          Shared with Journal. Trade scenarios still ask you to confirm this context.
        </p>
        <ResourceState {...trading} retry={trading.reload} />
        {trading.data ? <TradingMemory initial={trading.data} changed={trading.reload} /> : null}
      </div>
    </div>
  );
}
function TradingMemory({ initial, changed }: { initial: TradePreferences; changed: () => void }) {
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);
  async function save() {
    setPending(true);
    try {
      await apiRequest("/journal/preferences", { method: "PATCH", body: JSON.stringify(value) });
      changed();
      toast.success("Trading memory saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Memory could not be saved.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <TradePreferenceFields value={value} onChange={setValue} disabled={pending} />
      <Button
        type="submit"
        className="self-start"
        disabled={pending || !TradePreferencesSchema.safeParse(value).success}
      >
        {pending ? "Saving…" : "Save trading memory"}
      </Button>
    </form>
  );
}
