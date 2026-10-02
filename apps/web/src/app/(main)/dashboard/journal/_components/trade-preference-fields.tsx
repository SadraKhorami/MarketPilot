"use client";
import { useId } from "react";

import type { TradePreferences } from "@marketpilot/ai/contracts";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
export function TradePreferenceFields({
  value,
  onChange,
  disabled = false,
}: {
  value: TradePreferences;
  onChange: (value: TradePreferences) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <FieldGroup className="grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor={`${id}-capital`}>Capital · optional</FieldLabel>
        <Input
          id={`${id}-capital`}
          type="number"
          min="0.01"
          max="1000000000000"
          step="any"
          inputMode="decimal"
          placeholder="For position sizing"
          value={value.capital ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, capital: e.target.value === "" ? null : Number(e.target.value) })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-currency`}>Account currency</FieldLabel>
        <Select
          value={value.currency}
          disabled={disabled}
          onValueChange={(currency) => {
            if (currency === "USD" || currency === "EUR" || currency === "GBP") onChange({ ...value, currency });
          }}
        >
          <SelectTrigger id={`${id}-currency`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {["USD", "EUR", "GBP"].map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-risk`}>Risk per trade · %</FieldLabel>
        <Input
          id={`${id}-risk`}
          type="number"
          min="0.01"
          max="10"
          step="0.1"
          value={value.riskPercent}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, riskPercent: Number(e.target.value) })}
        />
        <FieldDescription>Your limit, not an AI recommendation.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-interval`}>Analysis timeframe</FieldLabel>
        <Select
          value={value.interval}
          disabled={disabled}
          onValueChange={(interval) => {
            if (["1m", "5m", "15m", "1h", "6h", "1d"].includes(interval))
              onChange({ ...value, interval: interval as TradePreferences["interval"] });
          }}
        >
          <SelectTrigger id={`${id}-interval`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {["1m", "5m", "15m", "1h", "6h", "1d"].map((interval) => (
                <SelectItem key={interval} value={interval}>
                  {interval}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor={`${id}-holding`}>Expected holding period</FieldLabel>
        <Select
          value={value.holding}
          disabled={disabled}
          onValueChange={(holding) => {
            if (holding === "scalp" || holding === "day" || holding === "swing") onChange({ ...value, holding });
          }}
        >
          <SelectTrigger id={`${id}-holding`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="scalp">Short session · minutes</SelectItem>
              <SelectItem value="day">Intraday · hours</SelectItem>
              <SelectItem value="swing">Swing · several days</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field orientation="horizontal" className="sm:col-span-2">
        <Checkbox
          id={`${id}-review`}
          checked={value.autoReview}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ ...value, autoReview: checked === true })}
        />
        <div>
          <FieldLabel htmlFor={`${id}-review`}>AI comments on important journal events</FieldLabel>
          <FieldDescription>Uses your research allowance. Can be turned off in Journal.</FieldDescription>
        </div>
      </Field>
    </FieldGroup>
  );
}
