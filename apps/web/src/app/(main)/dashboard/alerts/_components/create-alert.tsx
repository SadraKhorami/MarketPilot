"use client";
import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { CirclePlus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import { MarketSymbolField, normalizeMarketSymbol } from "../../_components/market-symbol-field";
import { type AlertRecord, conditions } from "./alert-types";

const schema = z
  .object({
    name: z.string().trim().min(1).max(120),
    asset: z.string().min(1),
    condition: z.enum([
      "PRICE_ABOVE",
      "PRICE_BELOW",
      "RSI_ABOVE",
      "RSI_BELOW",
      "PERCENT_CHANGE_ABOVE",
      "PERCENT_CHANGE_BELOW",
    ]),
    threshold: z
      .string()
      .trim()
      .min(1)
      .refine((value) => Number.isFinite(Number(value)) && Math.abs(Number(value)) < 1e14, "Enter a valid threshold."),
    interval: z.enum(["1m", "5m", "15m", "1h", "6h", "1d"]),
    cooldown: z
      .string()
      .refine(
        (value) =>
          value.trim() !== "" && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 10080,
        "Enter 0–10080 whole minutes.",
      ),
  })
  .superRefine((draft, ctx) => {
    const value = Number(draft.threshold);
    if (draft.condition.startsWith("PRICE_") && value <= 0)
      ctx.addIssue({ code: "custom", path: ["threshold"], message: "Price must be positive." });
    if (draft.condition.startsWith("RSI_") && (value < 0 || value > 100))
      ctx.addIssue({ code: "custom", path: ["threshold"], message: "RSI must be between 0 and 100." });
  });
type Draft = z.infer<typeof schema>;
export function CreateAlert({ saved }: { saved: () => void }) {
  const [open, setOpen] = useState(false);
  const form = useForm<Draft>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      asset: "BTC-USD",
      condition: "PRICE_ABOVE",
      threshold: "",
      interval: "15m",
      cooldown: "60",
    },
  });
  const condition = form.watch("condition");
  const thresholdUnit = condition.startsWith("RSI_") ? "RSI, 0–100" : "quote currency";
  const unit = condition.startsWith("PERCENT_") ? "% per completed candle" : thresholdUnit;
  async function create(draft: Draft) {
    try {
      await apiRequest<ApiEnvelope<AlertRecord>>("/alerts", {
        method: "POST",
        body: JSON.stringify({
          name: draft.name,
          assetId: normalizeMarketSymbol(draft.asset),
          condition: draft.condition,
          threshold: Number(draft.threshold),
          interval: draft.interval,
          cooldownMinutes: Number(draft.cooldown),
        }),
      });
      form.reset();
      setOpen(false);
      saved();
      toast.success("Alert saved. Waiting for its first observation.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the alert.");
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full shrink-0 sm:w-auto">
          <CirclePlus data-icon="inline-start" />
          Create alert
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create alert</DialogTitle>
          <DialogDescription>
            Notify on a crossing after the first observation establishes a baseline.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(create)} className="flex flex-col gap-4">
          <FieldGroup>
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="alert-name">Name</FieldLabel>
                  <Input {...field} id="alert-name" aria-invalid={fieldState.invalid} placeholder="BTC breakout" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="asset"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="alert-asset">Market</FieldLabel>
                  <MarketSymbolField id="alert-asset" value={field.value} onChange={field.onChange} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="condition"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="alert-condition">Condition</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="alert-condition" className="w-full" aria-invalid={fieldState.invalid}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {Object.entries(conditions).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="threshold"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="alert-threshold">Threshold ({unit})</FieldLabel>
                  <Input {...field} id="alert-threshold" inputMode="decimal" aria-invalid={fieldState.invalid} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="interval"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="alert-interval">Candle timeframe</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="alert-interval" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {["1m", "5m", "15m", "1h", "6h", "1d"].map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="cooldown"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="alert-cooldown">Minimum minutes between triggers</FieldLabel>
                  <Input {...field} id="alert-cooldown" inputMode="numeric" aria-invalid={fieldState.invalid} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
          <p className="text-muted-foreground text-xs">
            Delivery follows inbox preferences and any verified bots you have opted into. RSI and percentage change use
            completed candles. A new crossing during cooldown is skipped.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : "Save alert"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
