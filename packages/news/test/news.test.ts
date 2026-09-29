import assert from "node:assert/strict";
import test from "node:test";

import { InvestingRssSource, normalizeArticleUrl, parseInvestingRssFeeds } from "../src/index";

const state = new Map<string, { etag?: string; lastModified?: string }>();
const stateStore = {
  async get(key: string) { return state.get(key) ?? null; },
  async set(key: string, value: { etag?: string; lastModified?: string }) { state.set(key, value); },
};

test("accepts only official configured Investing.com HTTPS RSS endpoints", () => {
  assert.deepEqual(parseInvestingRssFeeds(JSON.stringify([{ key: "crypto", category: "Crypto", url: "https://www.investing.com/rss/news_301.rss" }])).map(({ key }) => key), ["crypto"]);
  assert.throws(() => parseInvestingRssFeeds(JSON.stringify([{ key: "bad", category: "Bad", url: "https://evil.example/feed.xml" }])), /official Investing.com/);
});

test("parses, normalizes, links, and deterministically deduplicates RSS articles", async () => {
  const xml = `<rss version="2.0"><channel><language>en-us</language><item><title>Bitcoin &amp; rates</title><description><![CDATA[<p>Markets <b>react</b>.</p>]]></description><link>https://www.investing.com/news/crypto-news/example?utm_source=rss</link><pubDate>Tue, 29 Sep 2026 10:00:00 GMT</pubDate></item><item><title>Missing link</title></item></channel></rss>`;
  const feeds = parseInvestingRssFeeds(JSON.stringify([
    { key: "crypto", category: "Crypto", url: "https://www.investing.com/rss/news_301.rss" },
    { key: "stocks", category: "Stocks", url: "https://www.investing.com/rss/news_25.rss" },
  ]));
  const source = new InvestingRssSource({ feeds, stateStore, fetcher: async () => new Response(xml, { headers: { "content-type": "application/rss+xml", etag: "v1" } }) });
  const result = await source.fetchFeeds(["BTCUSDT"]);
  assert.equal(result[0].articles.length, 1);
  assert.equal(result[0].articles[0].description, "Markets react.");
  assert.deepEqual(result[0].articles[0].affectedAssets, []);
  assert.equal(result[0].articles[0].sourceCategories[0], "Crypto");
  assert.equal(result[0].articles[0].originalUrl.includes("utm_source"), true);
  assert.equal(result[0].articles[0].canonicalUrlHash, result[1].articles[0].canonicalUrlHash);
  assert.equal(normalizeArticleUrl("https://example.test/story/?utm_campaign=x#section"), "https://example.test/story");
  assert.deepEqual(state.get("crypto"), { etag: "v1" });
});

test("isolates malformed feeds, preserves valid empty feeds, and uses conditional requests", async () => {
  let requestCount = 0;
  let conditionalRequestSeen = false;
  const feeds = parseInvestingRssFeeds(JSON.stringify([
    { key: "broken", category: "Broken", url: "https://www.investing.com/rss/news_1.rss" },
    { key: "empty", category: "Empty", url: "https://www.investing.com/rss/news_11.rss" },
  ]));
  const source = new InvestingRssSource({ feeds, stateStore, fetcher: async (input, init) => {
    requestCount += 1;
    if (String(input).includes("news_1.rss")) return new Response("<rss><channel>", { headers: { "content-type": "application/rss+xml" } });
    if (new Headers(init?.headers).has("If-None-Match")) {
      conditionalRequestSeen = true;
      return new Response(null, { status: 304 });
    }
    return new Response("<rss><channel></channel></rss>", { headers: { "content-type": "application/rss+xml", etag: "empty-v1" } });
  } });
  const first = await source.fetchFeeds();
  assert.equal(first[0].status, "failed");
  assert.equal(first[1].status, "updated");
  assert.deepEqual(first[1].articles, []);
  await source.fetchFeeds();
  assert.equal(requestCount, 4);
  assert.equal(conditionalRequestSeen, true);
});
