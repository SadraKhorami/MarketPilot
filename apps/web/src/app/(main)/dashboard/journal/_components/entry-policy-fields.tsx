"use client";
import { useId } from "react";
import {
  resolveEntryPolicy,
  EntryPolicySchema,
  IntervalSchema,
  automaticEntryIntervals,
  entryDurations,
  type EntryPolicy,
  type TradePreferences,
} from "@marketpilot/ai/contracts";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function EntryPolicyFields({
  value,
  onChange,
  disabled,
}: {
  value: TradePreferences;
  onChange: (value: TradePreferences) => void;
  disabled: boolean;
}) {
  const id = useId();
  const policy = resolveEntryPolicy(value);
  const update = (patch: Partial<EntryPolicy>) => onChange({ ...value, entryPolicy: { ...policy, ...patch } });
  const mode = (label: string, key: "timeframeMode" | "validityMode") => (
    <Field>
      <FieldLabel id={`${id}-${key}`}>{label}</FieldLabel>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={policy[key]}
        disabled={disabled}
        aria-labelledby={`${id}-${key}`}
        onValueChange={(next) => {
          if (next === "auto" || next === "manual") update({ [key]: next });
        }}
      >
        <ToggleGroupItem value="auto">Auto</ToggleGroupItem>
        <ToggleGroupItem value="manual">Manual</ToggleGroupItem>
      </ToggleGroup>
      <FieldDescription>
        {key === "timeframeMode"
          ? policy.timeframeMode === "auto"
            ? `AI proposes within ${automaticEntryIntervals(value.holding).join(" / ")}; server validates trend alignment.`
            : "Entry and trend timeframes stay exactly as selected."
          : "Only the deadline for a waiting entry. An open trade has no expiry from this setting."}
      </FieldDescription>
    </Field>
  );
  const select = (label: string, key: "trendInterval" | "scenario" | "condition", options: Array<[string, string]>) => (
    <Field>
      <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
      <Select
        value={policy[key]}
        disabled={disabled}
        onValueChange={(next) => {
          const parsed = EntryPolicySchema.safeParse({ ...policy, [key]: next });
          if (parsed.success) update(parsed.data);
        }}
      >
        <SelectTrigger id={`${id}-${key}`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map(([option, name]) => (
              <SelectItem key={option} value={option}>
                {name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
  const invalidTrend =
    policy.timeframeMode === "manual" && entryDurations[policy.trendInterval] <= entryDurations[value.interval];
  return (
    <FieldGroup className="grid gap-4 sm:grid-cols-2">
      {mode("Entry & trend timeframes", "timeframeMode")}
      {mode("Entry validity", "validityMode")}
      {policy.timeframeMode === "manual" ? (
        <Field>
          <FieldLabel htmlFor={`${id}-entry`}>Entry timeframe</FieldLabel>
          <Select
            value={value.interval}
            disabled={disabled}
            onValueChange={(next) => {
              const parsed = IntervalSchema.safeParse(next);
              if (parsed.success) onChange({ ...value, interval: parsed.data });
            }}
          >
            <SelectTrigger id={`${id}-entry`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {["1m", "5m", "15m", "1h", "6h"].map((interval) => (
                  <SelectItem key={interval} value={interval}>
                    {interval}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      {policy.timeframeMode === "manual"
        ? select("Trend timeframe", "trendInterval", [
            ["15m", "15m"],
            ["1h", "1h"],
            ["6h", "6h"],
            ["1d", "1d"],
          ])
        : null}
      {policy.validityMode === "manual" ? (
        <Field data-invalid={policy.validityCandles * entryDurations[value.interval] > 72 * 3_600_000}>
          <FieldLabel htmlFor={`${id}-candles`}>Entry candles · 1–12</FieldLabel>
          <Input
            id={`${id}-candles`}
            type="number"
            min={1}
            max={12}
            step={1}
            value={policy.validityCandles}
            disabled={disabled}
            onChange={(event) => update({ validityCandles: Number(event.target.value) })}
          />
          <FieldDescription>Exact deadline shown with the proposal. Maximum 72 hours.</FieldDescription>
        </Field>
      ) : null}
      {select("Scenario", "scenario", [
        ["auto", "Auto · validated proposal"],
        ["breakout", "Breakout"],
        ["pullback", "Pullback after an observed break"],
      ])}
      {select("Entry condition", "condition", [
        ["auto", "Auto · supported condition"],
        ...(policy.scenario === "breakout" ? [] : ([["touch", "Touch · pullback only"]] as Array<[string, string]>)),
        ["candle_close", "Completed candle beyond Entry"],
        ["break_retest", "Break, then later retest & close"],
      ])}
      {invalidTrend ? (
        <p role="alert" className="text-destructive text-xs sm:col-span-2">
          Trend timeframe must be higher than entry timeframe. Choose both explicitly.
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs sm:col-span-2">
        Reversal is unavailable. Retests require separate completed candles; intrabar order cannot be inferred.
      </p>
    </FieldGroup>
  );
}
