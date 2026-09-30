/** The package is JavaScript-only. Keep its untrusted payloads unknown at the adapter boundary. */
declare module "@mathieuc/tradingview" {
	export interface ChartSession {
		readonly periods: unknown;
		readonly infos: unknown;
		onUpdate(callback: (changes: string[]) => void): void;
		onError(callback: (...errors: unknown[]) => void): void;
		setMarket(
			symbol: string,
			options: { timeframe: string; range: number; to: number },
		): void;
		delete(): void;
	}
	export class Client {
		readonly Session: { Chart: new () => ChartSession };
		onError(callback: (...errors: unknown[]) => void): void;
		onConnected(callback: () => void): void;
		onDisconnected(callback: () => void): void;
		end(): Promise<void>;
	}
}
