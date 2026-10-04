"use client";
import { useId } from "react";

import type { TradePreferences } from "@marketpilot/ai/contracts";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntryPolicyFields } from "./entry-policy-fields";
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
        <FieldLabel htmlFor={`${id}-capital`}>Manual capital · optional</FieldLabel>
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
        <FieldDescription>Your supplied sizing capital, not verified broker free balance.</FieldDescription>
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
        <FieldLabel htmlFor={`${id}-holding`}>Holding style</FieldLabel>
        <Select
          value={value.holding}
          disabled={disabled}
          onValueChange={(holding) => {
            if (holding === "scalp" || holding === "day" || holding === "swing" || holding === "hybrid")
              onChange({ ...value, holding });
          }}
        >
          <SelectTrigger id={`${id}-holding`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="scalp">Scalp · minutes</SelectItem>
              <SelectItem value="day">Intraday · hours</SelectItem>
              <SelectItem value="swing">Swing · several days</SelectItem>
              <SelectItem value="hybrid">Hybrid · flexible duration</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldDescription>
          Holding style bounds Auto entry timeframes. It never sets a deadline to close an open trade.
        </FieldDescription>
      </Field>
      <div className="sm:col-span-2">
        <EntryPolicyFields value={value} onChange={onChange} disabled={disabled} />
      </div>
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
