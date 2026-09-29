import type {
	MarketCandle,
	MarketObservation,
	TechnicalIndicators,
} from "./types";

const RSI_PERIOD = 14;
const ATR_PERIOD = 14;

export function calculateTechnicalIndicators(
	candles: readonly MarketCandle[],
): TechnicalIndicators {
	const closes = candles.map(({ close }) => close);
	const highs = candles.map(({ high }) => high);
	const lows = candles.map(({ low }) => low);
	const macd = calculateMacd(closes);
	const stochastic = calculateStochastic(highs, lows, closes);

	return {
		rsi: calculateRsi(closes, RSI_PERIOD),
		macd,
		sma50: simpleMovingAverage(closes, 50),
		sma200: simpleMovingAverage(closes, 200),
		bollingerBands: calculateBollingerBands(closes, 20, 2),
		stochastic,
		atr: calculateAtr(candles, ATR_PERIOD),
	};
}

export function calculateTrend(
	price: number,
	indicators: TechnicalIndicators,
): MarketObservation["trend"] {
	const { sma50, sma200 } = indicators;
	if (sma50 === null || sma200 === null) return null;
	if (price > sma50 && sma50 > sma200) return "uptrend";
	if (price < sma50 && sma50 < sma200) return "downtrend";
	return "sideways";
}

export function calculateSupportResistance(candles: readonly MarketCandle[]) {
	const closes = candles
		.map(({ close }) => close)
		.sort((left, right) => left - right);
	return {
		support: [percentile(closes, 0.1), percentile(closes, 0.2)].filter(
			isNumber,
		),
		resistance: [percentile(closes, 0.8), percentile(closes, 0.9)].filter(
			isNumber,
		),
	};
}

export function calculateVolatility(
	indicators: TechnicalIndicators,
	price: number,
) {
	const atr = indicators.atr;
	return { atr, atrPercentage: atr === null ? null : (atr / price) * 100 };
}

export function simpleMovingAverage(
	values: readonly number[],
	period: number,
): number | null {
	if (values.length < period) return null;
	const window = values.slice(-period);
	return window.reduce((sum, value) => sum + value, 0) / period;
}

function calculateRsi(
	values: readonly number[],
	period: number,
): number | null {
	if (values.length <= period) return null;
	let gains = 0;
	let losses = 0;
	for (let index = 1; index <= period; index++) {
		const difference = values[index] - values[index - 1];
		gains += Math.max(difference, 0);
		losses += Math.max(-difference, 0);
	}
	let averageGain = gains / period;
	let averageLoss = losses / period;
	for (let index = period + 1; index < values.length; index++) {
		const difference = values[index] - values[index - 1];
		averageGain =
			(averageGain * (period - 1) + Math.max(difference, 0)) / period;
		averageLoss =
			(averageLoss * (period - 1) + Math.max(-difference, 0)) / period;
	}
	if (averageLoss === 0) return averageGain === 0 ? 50 : 100;
	return 100 - 100 / (1 + averageGain / averageLoss);
}

function calculateMacd(values: readonly number[]): TechnicalIndicators["macd"] {
	const fast = exponentialMovingAverage(values, 12);
	const slow = exponentialMovingAverage(values, 26);
	const macdValues: Array<number | null> = values.map((_, index) => {
		const fastValue = fast[index];
		const slowValue = slow[index];
		return fastValue === null || slowValue === null
			? null
			: fastValue - slowValue;
	});
	const validMacd = macdValues.filter(isNumber);
	const signal = exponentialMovingAverage(validMacd, 9).at(-1) ?? null;
	const value = validMacd.at(-1) ?? null;
	if (value === null || signal === null) return null;
	return { value, signal, histogram: value - signal };
}

function exponentialMovingAverage(
	values: readonly number[],
	period: number,
): Array<number | null> {
	const result: Array<number | null> = Array.from(
		{ length: values.length },
		() => null,
	);
	if (values.length < period) return result;
	let current =
		values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
	result[period - 1] = current;
	const multiplier = 2 / (period + 1);
	for (let index = period; index < values.length; index++) {
		current = (values[index] - current) * multiplier + current;
		result[index] = current;
	}
	return result;
}

function calculateBollingerBands(
	values: readonly number[],
	period: number,
	deviations: number,
) {
	if (values.length < period) return null;
	const window = values.slice(-period);
	const middle = window.reduce((sum, value) => sum + value, 0) / period;
	const variance =
		window.reduce((sum, value) => sum + (value - middle) ** 2, 0) / period;
	const spread = Math.sqrt(variance) * deviations;
	return { upper: middle + spread, middle, lower: middle - spread };
}

function calculateStochastic(
	highs: readonly number[],
	lows: readonly number[],
	closes: readonly number[],
) {
	const period = 14;
	const signalPeriod = 3;
	if (closes.length < period + signalPeriod - 1) return null;
	const kValues: number[] = [];
	for (let index = period - 1; index < closes.length; index++) {
		const periodHigh = Math.max(...highs.slice(index - period + 1, index + 1));
		const periodLow = Math.min(...lows.slice(index - period + 1, index + 1));
		kValues.push(
			periodHigh === periodLow
				? 50
				: ((closes[index] - periodLow) / (periodHigh - periodLow)) * 100,
		);
	}
	return {
		k: kValues.at(-1) ?? 50,
		d: simpleMovingAverage(kValues, signalPeriod) ?? 50,
	};
}

function calculateAtr(
	candles: readonly MarketCandle[],
	period: number,
): number | null {
	if (candles.length <= period) return null;
	const ranges = candles.slice(1).map((candle, index) => {
		const previousClose = candles[index].close;
		return Math.max(
			candle.high - candle.low,
			Math.abs(candle.high - previousClose),
			Math.abs(candle.low - previousClose),
		);
	});
	let average =
		ranges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
	for (const range of ranges.slice(period))
		average = (average * (period - 1) + range) / period;
	return average;
}

function percentile(
	sortedValues: readonly number[],
	ratio: number,
): number | null {
	if (sortedValues.length === 0) return null;
	const position = (sortedValues.length - 1) * ratio;
	const lowerIndex = Math.floor(position);
	const upperIndex = Math.ceil(position);
	const fraction = position - lowerIndex;
	return (
		sortedValues[lowerIndex] +
		(sortedValues[upperIndex] - sortedValues[lowerIndex]) * fraction
	);
}

function isNumber(value: number | null | undefined): value is number {
	return typeof value === "number" && Number.isFinite(value);
}
