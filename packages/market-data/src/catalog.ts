import { z } from "zod";

export const MarketInstrumentSchema = z.object({
	symbol: z.string().min(1).max(40),
	name: z.string().min(1).max(120),
	baseAsset: z.string().min(1).max(30),
	quoteAsset: z.string().min(1).max(30),
	assetClass: z.enum(["crypto", "forex", "commodity", "stock"]),
	provider: z.enum(["coinbase-exchange", "tradingview"]),
	providerSymbol: z.string().min(1).max(40),
	available: z.boolean(),
});
export type MarketInstrument = z.infer<typeof MarketInstrumentSchema>;
export const referenceMarkets: MarketInstrument[] = [
	["XAU-USD", "Gold", "commodity", "OANDA:XAUUSD"],
	["XAG-USD", "Silver", "commodity", "OANDA:XAGUSD"],
	["EUR-USD", "Euro / US Dollar", "forex", "OANDA:EURUSD"],
	["GBP-USD", "British Pound / US Dollar", "forex", "OANDA:GBPUSD"],
	["USD-JPY", "US Dollar / Japanese Yen", "forex", "OANDA:USDJPY"],
	["AUD-USD", "Australian Dollar / US Dollar", "forex", "OANDA:AUDUSD"],
	["USD-CAD", "US Dollar / Canadian Dollar", "forex", "OANDA:USDCAD"],
	["USD-CHF", "US Dollar / Swiss Franc", "forex", "OANDA:USDCHF"],
	["NZD-USD", "New Zealand Dollar / US Dollar", "forex", "OANDA:NZDUSD"],
	["AAPL-USD", "Apple", "stock", "NASDAQ:AAPL"],
	["MSFT-USD", "Microsoft", "stock", "NASDAQ:MSFT"],
	["NVDA-USD", "NVIDIA", "stock", "NASDAQ:NVDA"],
	["TSLA-USD", "Tesla", "stock", "NASDAQ:TSLA"],
].map(([symbol, name, assetClass, providerSymbol]) =>
	MarketInstrumentSchema.parse({
		symbol,
		name,
		assetClass,
		providerSymbol,
		baseAsset: symbol.split("-")[0],
		quoteAsset: symbol.split("-")[1],
		provider: "tradingview",
		available: true,
	}),
);

const aliases: Record<string, string[]> = {
	BTC: ["Bitcoin", "بیت کوین", "بیت‌کوین"],
	ETH: ["Ethereum", "Ether", "اتریوم"],
	SOL: ["Solana", "سولانا"],
	XRP: ["Ripple"],
	ADA: ["Cardano"],
	DOGE: ["Dogecoin"],
	LTC: ["Litecoin"],
	AVAX: ["Avalanche"],
	XAU: ["Gold", "طلا"],
	XAG: ["Silver", "نقره"],
	AAPL: ["Apple"],
	MSFT: ["Microsoft"],
	NVDA: ["Nvidia"],
	TSLA: ["Tesla"],
};
export function assetSearchTerms(symbol: string, name?: string) {
	const base = symbol.trim().toUpperCase().replace("/", "-").split("-")[0];
	return [
		...new Set([base, ...(aliases[base] ?? []), ...(name ? [name] : [])]),
	];
}
export function articleMatchesAsset(
	article: {
		affectedAssets: string[];
		title: string;
		description: string | null;
	},
	symbol: string,
	name?: string,
) {
	const base = symbol.toUpperCase().split("-")[0];
	if (
		article.affectedAssets.some((tag) =>
			[symbol.toUpperCase(), base].includes(tag.toUpperCase()),
		)
	)
		return true;
	const text =
		`${article.title} ${article.description ?? ""}`.toLocaleLowerCase();
	return assetSearchTerms(symbol, name).some((term) =>
		text.includes(term.toLocaleLowerCase()),
	);
}
export function marketSourceLabel(source: string) {
	return source === "tradingview"
		? "TradingView"
		: source === "coinbase-exchange"
			? "Coinbase Exchange"
			: source;
}

export function normalizeInstrumentSymbol(input: string) {
	const normalized = input
		.trim()
		.toUpperCase()
		.replace(/\s*\/\s*/g, "-")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");
	const known = referenceMarkets.find(
		(market) =>
			market.symbol.replace("-", "") === normalized ||
			market.providerSymbol === normalized ||
			market.baseAsset === normalized,
	);
	return (
		known?.symbol ??
		(/^[A-Z0-9]+$/.test(normalized) ? `${normalized}-USD` : normalized)
	);
}
