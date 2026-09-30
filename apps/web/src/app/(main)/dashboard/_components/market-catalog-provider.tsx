"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { MarketInstrument } from "@marketpilot/market-data";
import { useApiResource } from "@/hooks/use-api-resource";

interface Catalog {
  instruments: MarketInstrument[];
  fetchedAt: string | null;
  stale: boolean;
  error: string | null;
  connections: { crypto: string; multiAsset: string };
}
const CatalogContext = createContext<ReturnType<typeof useApiResource<Catalog>> | null>(null);
export function MarketCatalogProvider({ children }: { children: ReactNode }) {
  const catalog = useApiResource<Catalog>("/market-data/catalog", { keepDataOnReload: true });
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}
export function useMarketCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("Market catalog requires MarketCatalogProvider.");
  return context;
}
