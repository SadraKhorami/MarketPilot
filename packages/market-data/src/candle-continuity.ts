import type { MarketCandle } from "./types";

const newYorkClock = new Intl.DateTimeFormat("en-US", {
	timeZone: "America/New_York",
	weekday: "short",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

// OANDA metals trade Sun–Fri 18:05–16:59 New York time. A candle
// bucket is expected when any part overlaps trading, including the 18:00 bucket.
// https://www.oanda.com/uk-en/trading/hours-of-operation/
function newYorkSessionIsTrading(time: number, openingMinute: number): boolean {
	const parts = newYorkClock.formatToParts(time);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((item) => item.type === type)?.value;
	const day = part("weekday");
	const minute = Number(part("hour")) * 60 + Number(part("minute"));
	if (day === "Sat") return false;
	if (day === "Sun") return minute >= openingMinute;
	if (day === "Fri") return minute < 17 * 60;
	return minute < 17 * 60 || minute >= openingMinute;
}

const londonClock = new Intl.DateTimeFormat("en-US", {
	timeZone: "Europe/London",
	weekday: "short",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});
// https://www.oanda.com/uk-en/trading/hours-of-operation/
function brentIsTrading(time: number): boolean {
	const parts = londonClock.formatToParts(time);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((item) => item.type === type)?.value;
	const day = part("weekday");
	const minute = Number(part("hour")) * 60 + Number(part("minute"));
	if (day === "Sat") return false;
	if (day === "Sun") return minute >= 23 * 60 + 1;
	if (day === "Fri") return minute >= 61 && minute < 21 * 60 + 59;
	if (day !== "Mon" && minute < 61) return false;
	return (
		minute < 21 * 60 + 59 || (minute >= 22 * 60 + 5 && minute < 22 * 60 + 59)
	);
}
function expectedTrading(time: number, symbol: string) {
	return symbol === "OANDA:BCOUSD"
		? brentIsTrading(time)
		: newYorkSessionIsTrading(
				time,
				symbol === "OANDA:WTICOUSD" ? 18 * 60 + 1 : 18 * 60 + 5,
			);
}

const scheduledSymbols = [
	"OANDA:XAUUSD",
	"OANDA:XAGUSD",
	"OANDA:WTICOUSD",
	"OANDA:BCOUSD",
];
function nextBoundary(time: number, duration: number): number {
	const next = time + duration;
	if (duration !== 86_400_000) return next;
	const localMinute = (value: number) => {
		const parts = newYorkClock.formatToParts(value);
		return (
			Number(parts.find((p) => p.type === "hour")?.value) * 60 +
			Number(parts.find((p) => p.type === "minute")?.value)
		);
	};
	const difference = localMinute(time) - localMinute(next);
	const shift =
		difference > 720
			? difference - 1440
			: difference < -720
				? difference + 1440
				: difference;
	return next + shift * 60_000;
}
function bucketTrades(start: number, end: number, symbol: string): boolean {
	for (let minute = start; minute < end; minute += 60_000) {
		if (expectedTrading(minute, symbol)) return true;
	}
	return false;
}
// Unknown market calendars must never turn missing observations into scheduled closures.
export function candleBucketHasTrading(
	start: number,
	end: number,
	providerSymbol: string,
): boolean {
	return (
		!scheduledSymbols.includes(providerSymbol) ||
		bucketTrades(start, end, providerSymbol)
	);
}
export function hasUnexpectedCandleGaps(
	candles: readonly MarketCandle[],
	duration: number,
	providerSymbol: string,
): boolean {
	const scheduled = scheduledSymbols.includes(providerSymbol);
	for (let index = 1; index < candles.length; index++) {
		const previous = Date.parse(candles[index - 1].time);
		const current = Date.parse(candles[index].time);
		const gap = current - previous;
		if (gap === duration) continue;
		if (
			!scheduled ||
			!Number.isFinite(gap) ||
			gap <= 0 ||
			gap > 31 * 86_400_000 ||
			(duration !== 86_400_000 && gap % duration !== 0)
		)
			return true;
		let bucket = nextBoundary(previous, duration);
		while (bucket < current) {
			const end = nextBoundary(bucket, duration);
			if (bucketTrades(bucket, end, providerSymbol)) return true;
			bucket = end;
		}
		if (bucket !== current) return true;
	}
	return false;
}
// At session reopening, the last completed daily candle may predate the weekend.
// This accepts only scheduled closures, never a missing completed trading bucket.
export function completedCandleIsCurrent(
	time: string,
	now: number,
	duration: number,
	providerSymbol: string,
): boolean {
	const last = Date.parse(time);
	if (!Number.isFinite(last) || !Number.isFinite(now) || duration <= 0)
		return false;
	if (now - last <= duration * 2) return true;
	if (
		!scheduledSymbols.includes(providerSymbol) ||
		now - last > 31 * 86_400_000
	)
		return false;
	for (
		let bucket = nextBoundary(last, duration);
		nextBoundary(bucket, duration) <= now;
		bucket = nextBoundary(bucket, duration)
	) {
		if (bucketTrades(bucket, nextBoundary(bucket, duration), providerSymbol))
			return false;
	}
	return true;
}
