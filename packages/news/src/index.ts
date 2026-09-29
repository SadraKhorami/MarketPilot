import { createHash } from "node:crypto";

import { XMLParser, XMLValidator } from "fast-xml-parser";

export interface InvestingRssFeed {
	key: string;
	category: string;
	url: string;
	language?: string;
}

export interface NormalizedNewsArticle {
	source: "Investing.com";
	title: string;
	description: string | null;
	originalUrl: string;
	canonicalUrlHash: string;
	publishedAt: Date | null;
	fetchedAt: Date;
	language: string | null;
	sourceCategories: string[];
	affectedAssets: string[];
}

export interface FeedCacheState {
	etag?: string;
	lastModified?: string;
}

export interface FeedStateStore {
	get(feedKey: string): Promise<FeedCacheState | null>;
	set(feedKey: string, state: FeedCacheState): Promise<void>;
}

export interface NewsSourceLogger {
	warn(
		message: string,
		context: Record<string, string | number | undefined>,
	): void;
}

export interface FeedFetchResult {
	feedKey: string;
	category: string;
	articles: NormalizedNewsArticle[];
	status: "updated" | "not_modified" | "failed";
	errorCode?: "timeout" | "rate_limited" | "unavailable" | "invalid_feed";
}

export type NewsSourceErrorCode =
	| "timeout"
	| "rate_limited"
	| "unavailable"
	| "invalid_feed";

export class NewsSourceError extends Error {
	constructor(
		message: string,
		readonly code: NewsSourceErrorCode,
	) {
		super(message);
		this.name = "NewsSourceError";
	}
}

const XML_LIMIT_BYTES = 2 * 1024 * 1024;
const MAX_ARTICLES_PER_FEED = 500;
const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	textNodeName: "#text",
	parseTagValue: false,
	trimValues: false,
	processEntities: false,
	cdataPropName: "__cdata",
});

export function parseInvestingRssFeeds(
	value: string | undefined,
): InvestingRssFeed[] {
	if (!value?.trim()) return [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new Error("INVESTING_RSS_FEEDS_JSON must be a JSON array.");
	}
	if (!Array.isArray(parsed))
		throw new Error("INVESTING_RSS_FEEDS_JSON must be a JSON array.");
	if (parsed.length > 20)
		throw new Error("INVESTING_RSS_FEEDS_JSON supports up to 20 feeds.");

	const feeds = parsed.map((entry, index) => {
		if (!entry || typeof entry !== "object")
			throw new Error(`News feed ${index + 1} is invalid.`);
		const feed = entry as Record<string, unknown>;
		if (typeof feed.key !== "string" || !/^[a-z0-9-]{1,80}$/i.test(feed.key))
			throw new Error(`News feed ${index + 1} has an invalid key.`);
		if (
			typeof feed.category !== "string" ||
			!feed.category.trim() ||
			feed.category.length > 120
		)
			throw new Error(`News feed ${index + 1} has an invalid category.`);
		if (typeof feed.url !== "string")
			throw new Error(`News feed ${index + 1} has an invalid URL.`);
		const url = parseFeedUrl(feed.url);
		if (url.hostname !== "www.investing.com")
			throw new Error(
				`News feed ${index + 1} must use the official Investing.com host.`,
			);
		const language =
			typeof feed.language === "string" && feed.language.trim()
				? feed.language.trim().slice(0, 16)
				: undefined;
		return {
			key: feed.key,
			category: feed.category.trim(),
			url: url.toString(),
			...(language ? { language } : {}),
		};
	});
	if (new Set(feeds.map((feed) => feed.key)).size !== feeds.length)
		throw new Error("News feed keys must be unique.");
	return feeds;
}

export class InvestingRssSource {
	private readonly fetcher: typeof fetch;
	private readonly logger: NewsSourceLogger;

	constructor(
		private readonly options: {
			feeds: InvestingRssFeed[];
			stateStore: FeedStateStore;
			fetcher?: typeof fetch;
			timeoutMs?: number;
			logger?: NewsSourceLogger;
		},
	) {
		this.fetcher = options.fetcher ?? fetch;
		this.logger = options.logger ?? {
			warn: (message, context) => console.warn(message, context),
		};
	}

	async fetchFeeds(knownAssets: string[] = []): Promise<FeedFetchResult[]> {
		return Promise.all(
			this.options.feeds.map((feed) => this.fetchFeed(feed, knownAssets)),
		);
	}

	private async fetchFeed(
		feed: InvestingRssFeed,
		knownAssets: string[],
	): Promise<FeedFetchResult> {
		try {
			const state = await this.options.stateStore.get(feed.key);
			const headers: Record<string, string> = {
				Accept: "application/rss+xml, application/xml, text/xml;q=0.9",
				"User-Agent": "MarketPilot News Reader/1.0",
			};
			if (state?.etag) headers["If-None-Match"] = state.etag;
			if (state?.lastModified)
				headers["If-Modified-Since"] = state.lastModified;

			const response = await this.fetcher(feed.url, {
				headers,
				redirect: "error",
				signal: AbortSignal.timeout(this.options.timeoutMs ?? 8_000),
				cache: "no-store",
			});
			if (response.status === 304)
				return {
					feedKey: feed.key,
					category: feed.category,
					articles: [],
					status: "not_modified",
				};
			if (response.status === 429)
				throw new NewsSourceError(
					"The news feed rate limit was reached.",
					"rate_limited",
				);
			if (!response.ok)
				throw new NewsSourceError(
					"The news feed could not be fetched.",
					"unavailable",
				);
			const contentType =
				response.headers.get("content-type")?.toLowerCase() ?? "";
			if (!/application\/(rss\+xml|xml)|text\/xml/.test(contentType))
				throw new NewsSourceError(
					"The news feed returned an unexpected content type.",
					"invalid_feed",
				);
			const contentLength = Number(response.headers.get("content-length"));
			if (Number.isFinite(contentLength) && contentLength > XML_LIMIT_BYTES)
				throw new NewsSourceError(
					"The news feed response is too large.",
					"invalid_feed",
				);
			const xml = await readLimitedBody(response, XML_LIMIT_BYTES);

			const validation = XMLValidator.validate(xml);
			if (validation !== true)
				throw new NewsSourceError(
					"The news feed contains malformed XML.",
					"invalid_feed",
				);
			const document = parser.parse(xml) as Record<string, unknown>;
			const rssChannel = getObject(document.rss)?.channel;
			const channel =
				getObject(rssChannel) ??
				(rssChannel === "" ? {} : getObject(document.feed));
			if (!channel)
				throw new NewsSourceError(
					"The response is not an RSS or Atom feed.",
					"invalid_feed",
				);
			const itemValue = channel.item ?? channel.entry;
			const items =
				itemValue === undefined
					? []
					: (Array.isArray(itemValue) ? itemValue : [itemValue]).slice(
							0,
							MAX_ARTICLES_PER_FEED,
						);
			const fetchedAt = new Date();
			const articles = items
				.map((item) =>
					normalizeItem(item, feed, knownAssets, fetchedAt, channel?.language),
				)
				.filter(
					(article): article is NormalizedNewsArticle => article !== null,
				);

			await this.options.stateStore.set(feed.key, {
				...(response.headers.get("etag")
					? { etag: response.headers.get("etag") as string }
					: {}),
				...(response.headers.get("last-modified")
					? { lastModified: response.headers.get("last-modified") as string }
					: {}),
			});
			return {
				feedKey: feed.key,
				category: feed.category,
				articles,
				status: "updated",
			};
		} catch (error) {
			const code =
				error instanceof NewsSourceError
					? error.code
					: error instanceof DOMException
						? "timeout"
						: "unavailable";
			this.logger.warn("Investing.com RSS feed failed", {
				feedKey: feed.key,
				category: feed.category,
				code,
			});
			return {
				feedKey: feed.key,
				category: feed.category,
				articles: [],
				status: "failed",
				errorCode: code,
			};
		}
	}
}

export function normalizeArticleUrl(originalUrl: string) {
	const url = new URL(originalUrl);
	if (
		(url.protocol !== "https:" && url.protocol !== "http:") ||
		url.username ||
		url.password
	)
		throw new Error("Article URL is invalid.");
	url.hash = "";
	for (const key of [...url.searchParams.keys()]) {
		if (/^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key))
			url.searchParams.delete(key);
	}
	url.searchParams.sort();
	if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
	return url.toString();
}

function normalizeItem(
	itemValue: unknown,
	feed: InvestingRssFeed,
	knownAssets: string[],
	fetchedAt: Date,
	channelLanguage: unknown,
): NormalizedNewsArticle | null {
	const item = getObject(itemValue);
	if (!item) return null;
	const title = plainText(readValue(item.title)).slice(0, 500).trim();
	const description = plainText(
		readValue(item.description ?? item.summary ?? item.content),
	)
		.slice(0, 5_000)
		.trim();
	const rawUrl =
		readValue(item.link) ?? readValue(item.guid) ?? readValue(item.id);
	if (!title || !rawUrl || rawUrl.length > 2_048) return null;

	let originalUrl: string;
	let canonicalUrl: string;
	try {
		originalUrl = validateArticleUrl(rawUrl);
		canonicalUrl = normalizeArticleUrl(originalUrl);
	} catch {
		return null;
	}

	const rawPublishedAt = readValue(
		item.pubDate ?? item.published ?? item.updated ?? item["dc:date"],
	);
	const published = rawPublishedAt ? new Date(rawPublishedAt) : null;
	const publishedAt =
		published && Number.isFinite(published.getTime()) ? published : null;
	const language =
		readValue(item.language) ??
		readValue(channelLanguage) ??
		feed.language ??
		null;

	return {
		source: "Investing.com",
		title,
		description: description || null,
		originalUrl,
		canonicalUrlHash: createHash("sha256").update(canonicalUrl).digest("hex"),
		publishedAt,
		fetchedAt,
		language,
		sourceCategories: [feed.category],
		affectedAssets: findAffectedAssets(`${title} ${description}`, knownAssets),
	};
}

function validateArticleUrl(value: string) {
	const url = new URL(value);
	if (
		(url.protocol !== "https:" && url.protocol !== "http:") ||
		url.username ||
		url.password ||
		url.href.length > 2_048
	)
		throw new Error("Article URL is invalid.");
	return url.toString();
}

function parseFeedUrl(value: string) {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error("News feed URL is invalid.");
	}
	if (url.protocol !== "https:" || url.username || url.password || url.port)
		throw new Error(
			"News feed URL must use HTTPS without credentials or a custom port.",
		);
	return url;
}

async function readLimitedBody(response: Response, maximumBytes: number) {
	if (!response.body) return "";
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > maximumBytes) {
				await reader.cancel();
				throw new NewsSourceError(
					"The news feed response is too large.",
					"invalid_feed",
				);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const body = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder("utf-8", { fatal: false }).decode(body);
}

function findAffectedAssets(text: string, assetIds: string[]) {
	const normalizedText = ` ${text
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, " ")
		.trim()} `;
	return [
		...new Set(
			assetIds
				.map((id) => id.trim().toUpperCase())
				.filter((symbol) => {
					if (!symbol || symbol.length < 2 || symbol.length > 24) return false;
					const normalized = symbol
						.split(":")
						.at(-1)
						?.replace(/[^A-Z0-9]+/g, " ")
						.trim();
					return normalized
						? normalizedText.includes(` ${normalized} `)
						: false;
				}),
		),
	];
}

function getObject(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function readValue(value: unknown): string | null {
	if (typeof value === "string") return value.trim() || null;
	const item = getObject(value);
	if (!item) return null;
	if (typeof item["#text"] === "string") return item["#text"].trim() || null;
	if (typeof item.__cdata === "string") return item.__cdata.trim() || null;
	if (typeof item["@_href"] === "string") return item["@_href"].trim() || null;
	return null;
}

function plainText(value: string | null) {
	return (value ?? "")
		.replace(/<!\[CDATA\[|\]\]>/g, "")
		.replace(/<[^>]*>/g, " ")
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/\s+([.,!?;:])/g, "$1")
		.replace(/\s+/g, " ");
}
