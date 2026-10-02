"use client";
import { toast } from "sonner";
import { useAccountPreference } from "../../_components/use-account-preference";
const defaults: string[] = [];
const valid = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= 100 &&
  value.every((item) => typeof item === "string" && /^[A-Z0-9.-]{1,40}$/.test(item));
export function useMarketFavorites() {
  const preference = useAccountPreference("market-favorites", defaults, valid);
  return {
    symbols: preference.value,
    ready: preference.ready,
    toggle: (symbol: string) => {
      const exists = preference.value.includes(symbol);
      if (!exists && preference.value.length >= 100) {
        toast.info("You can save up to 100 favorite markets. Remove one to add another.");
        return;
      }
      preference.update(exists ? preference.value.filter((item) => item !== symbol) : [...preference.value, symbol]);
    },
  };
}
