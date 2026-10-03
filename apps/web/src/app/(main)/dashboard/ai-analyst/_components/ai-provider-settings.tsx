"use client";
import { useState } from "react";
import type { AiSettingsView } from "@marketpilot/ai/contracts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/api/client";
import { AiModelSelect } from "./ai-model-select";
export function AiProviderSettings({ initial, changed }: { initial: AiSettingsView; changed: () => void }) {
  const [source, setSource] = useState(initial.source);
  const [modelId, setModelId] = useState(initial.modelId);
  const [budget, setBudget] = useState(initial.requestBudget);
  const [key, setKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(removeKey = false) {
    setPending(true);
    setError(null);
    try {
      await apiRequest("/ai/settings", {
        method: "PATCH",
        body: JSON.stringify(
          removeKey
            ? { removeKey: true }
            : { source, modelId, requestBudget: budget, ...(key.trim() ? { apiKey: key.trim() } : {}) },
        ),
      });
      setKey("");
      changed();
      toast.success(removeKey ? "Personal key removed. Platform provider selected." : "Provider settings saved.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Settings could not be saved.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="ai-provider-source">Research provider</FieldLabel>
          <Select
            value={source}
            onValueChange={(value) => {
              if (value === "personal" || value === "platform") setSource(value);
            }}
            disabled={pending}
          >
            <SelectTrigger id="ai-provider-source" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="platform">MarketPilot · plan allowance</SelectItem>
                <SelectItem value="personal" disabled={!initial.credentialStorageReady}>
                  My OpenRouter key
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldDescription>
            {source === "personal"
              ? "OpenRouter bills your own account. Research and journal AI comments do not use your MarketPilot daily research allowance. Rate limits still apply."
              : "Uses the app’s configured model and your daily plan allowance."}
          </FieldDescription>
        </Field>
        {source === "personal" ? (
          <>
            <Field>
              <FieldLabel htmlFor="ai-personal-key">OpenRouter API key</FieldLabel>
              <Input
                id="ai-personal-key"
                type="password"
                autoComplete="off"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                disabled={pending}
                placeholder={
                  initial.hasKey ? `Connected · ending ${initial.keyLast4}. Leave blank to keep.` : "sk-or-…"
                }
                required={!initial.hasKey}
              />
              <FieldDescription>
                Verified with OpenRouter, encrypted on the server and never shown again. Use an inference key with a
                spending limit set in OpenRouter.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Model</FieldLabel>
              <AiModelSelect value={modelId} onChange={setModelId} disabled={pending} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ai-personal-budget">Maximum estimated cost per research · USD</FieldLabel>
              <Input
                id="ai-personal-budget"
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={budget}
                disabled={pending}
                onChange={(event) => setBudget(Number(event.target.value))}
                required
              />
              <FieldDescription>
                Requests are rejected if their conservative estimate exceeds this amount. OpenRouter’s key limit
                controls your total spending.
              </FieldDescription>
            </Field>
          </>
        ) : null}
      </FieldGroup>
      {!initial.credentialStorageReady ? (
        <p className="text-muted-foreground text-sm">
          The server needs credential encryption configured before personal keys can be connected.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || (source === "personal" && !modelId)}>
          {pending ? "Saving…" : "Save provider"}
        </Button>
        {initial.hasKey ? (
          <Button type="button" variant="outline" disabled={pending} onClick={() => void save(true)}>
            Remove personal key
          </Button>
        ) : null}
      </div>
    </form>
  );
}
