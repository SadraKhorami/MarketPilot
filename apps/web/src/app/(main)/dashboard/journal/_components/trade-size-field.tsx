"use client";

import { useRef, useState } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function useTradeSize(price: string, initialQuantity = "") {
  const original = useRef({
    price,
    quantity: initialQuantity,
    amount: initialQuantity && Number(price) > 0 ? String(Number(initialQuantity) * Number(price)) : initialQuantity,
  });
  const [mode, setMode] = useState(initialQuantity && !(Number(price) > 0) ? "units" : "amount");
  const [value, setValue] = useState(() =>
    initialQuantity && Number(price) > 0 ? String(Number(initialQuantity) * Number(price)) : initialQuantity,
  );
  const quantity =
    mode === "units"
      ? value
      : value === original.current.amount && price === original.current.price
        ? original.current.quantity
        : Number(price) > 0 && value
          ? String(Number(value) / Number(price))
          : "";
  function changeMode(next: string) {
    if ((next !== "amount" && next !== "units") || next === mode) return;
    setValue(
      next === "units" ? quantity : quantity && Number(price) > 0 ? String(Number(quantity) * Number(price)) : "",
    );
    setMode(next);
  }
  return { mode, value, setValue, changeMode, quantity };
}

export function TradeSizeField({
  id,
  symbol,
  price,
  size,
  disabled = false,
  label = "Position value",
}: {
  id: string;
  symbol: string;
  price: string;
  size: ReturnType<typeof useTradeSize>;
  disabled?: boolean;
  label?: string;
}) {
  const [base, quote] = symbol.split("-");
  const validPrice = Number(price) > 0 && Number.isFinite(Number(price));
  return (
    <Field data-disabled={disabled}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>
          {size.mode === "amount" ? `${label} · ${quote}` : `Asset amount · ${base}`}
        </FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={size.mode}
          onValueChange={size.changeMode}
          disabled={Boolean(disabled) || !validPrice}
          aria-label="Enter position value or asset amount"
        >
          <ToggleGroupItem value="amount">{quote}</ToggleGroupItem>
          <ToggleGroupItem value="units">{base}</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <Input
        id={id}
        required
        type="number"
        min="0.00000001"
        step="any"
        value={size.value}
        onChange={(event) => size.setValue(event.target.value)}
        disabled={disabled}
        placeholder={size.mode === "amount" ? "e.g. 100" : "e.g. 0.05"}
      />
      <FieldDescription>
        {!validPrice
          ? "Enter the entry price to calculate the asset amount."
          : size.quantity && Number(size.quantity) > 0
            ? `${Number(size.quantity).toLocaleString(undefined, { maximumSignificantDigits: 10 })} ${base} · ${(Number(size.quantity) * Number(price)).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${quote} at your entry price.`
            : "Enter the position value; the asset amount is calculated from your entry price."}{" "}
        Position value excludes fees and is not leveraged margin.
      </FieldDescription>
    </Field>
  );
}
