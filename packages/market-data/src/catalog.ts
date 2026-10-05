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
	["WTI-USD", "WTI Crude Oil", "commodity", "OANDA:WTICOUSD"],
	["BRENT-USD", "Brent Crude Oil", "commodity", "OANDA:BCOUSD"],
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
	WTI: ["WTI", "Crude oil", "Oil", "نفت"],
	BRENT: ["Brent", "Brent oil", "نفت برنت"],
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
function escapePattern(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// PostgreSQL POSIX classes preserve word boundaries for Latin and non-Latin names.
export function assetNewsPattern(symbol: string, name?: string) {
	const alternatives = assetSearchTerms(symbol, name)
		.map(escapePattern)
		.join("|");
	return `(^|[^[:alnum:]_])(${alternatives})([^[:alnum:]_]|$)`;
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
	const exclusion = commodityNewsExclusion(symbol);
	if (
		exclusion &&
		new RegExp(exclusion.corporate, "i").test(article.title) &&
		!new RegExp(exclusion.market, "i").test(article.title)
	)
		return false;
	if (
		article.affectedAssets.some((tag) =>
			[symbol.toUpperCase(), base].includes(tag.toUpperCase()),
		)
	)
		return true;
	const text =
		`${article.title} ${article.description ?? ""}`.toLocaleLowerCase();
	return assetSearchTerms(symbol, name).some((term) =>
		new RegExp(
			`(^|[^\\p{L}\\p{N}_])${escapePattern(term)}([^\\p{L}\\p{N}_]|$)`,
			"iu",
		).test(text),
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

// Generic metal words also occur in mining-company names. Corporate personnel
// announcements are not commodity-market evidence, even when tagged "Gold".
export function commodityNewsExclusion(
	symbol: string,
): { corporate: string; market: string } | null {
	if (!["XAU", "XAG"].includes(symbol.toUpperCase().split("-")[0])) return null;
	return {
		corporate:
			"(^|[^a-z0-9_])(appoints?|names|ceo|cfo|vp|vice president|technical services|board of directors)([^a-z0-9_]|$)",
		market:
			"(^|[^a-z0-9_])(prices?|bullion|futures|spot|per ounce|oz|xau|xag)([^a-z0-9_]|$)",
	};
}
