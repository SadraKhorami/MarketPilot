# MarketPilot Product Specification

## Purpose

MarketPilot is a market intelligence SaaS application. It presents provider-backed market data, lets authenticated users organize assets and alerts, and provides AI-assisted analysis grounded in verified application data. It does not execute trades and must not present the AI as a financial adviser.

## Users and core workflows

- A user signs in, reviews the market overview, and creates a personal watchlist.
- A user explores a supported Coinbase Exchange product's current price, candles, calculated indicators, and trend with source timestamps.
- A user saves an alert rule; AI-proposed rules require separate explicit confirmation. Background evaluation and delivery destinations remain unavailable.
- A user asks the AI Analyst a question; the assistant calls authorized read tools and explains the returned data with timestamps and source context.
- A user manages linked notification channels, API keys, API usage, account sessions, and an activity history.

## Product boundaries

- The Desktop MarketFeed project is a read-only source of ideas and implementation lessons, never a MarketPilot runtime service or code dependency.
- Market data is fetched directly by MarketPilot's API through provider adapters. The current adapter uses exact Coinbase Exchange product IDs and documented intervals; unsupported products and unconfigured asset classes are reported as unavailable.
- Prices/candles are never estimated or mocked in market pages. Technical indicators and trends are calculated from validated provider candles; values are null when history is insufficient.
- Sentiment remains unavailable until a verified, independent sentiment source is selected.
- No order placement, brokerage connection, portfolio custody, or trade execution is in scope.
- Third-party news content is displayed and summarized as untrusted data, not as application instructions.

## Initial navigation

Dashboard; Markets (Overview, Watchlist); Analytics; AI Analyst; News & Sentiment; Alerts; Bots (Telegram, Discord); API (API Keys, Usage); Activity; Settings.

## Quality requirements

Keep the existing dashboard as the frontend foundation. Retain useful shell, theme, chart, table, and form components while removing unrelated sample pages/data as each product screen replaces them. Preserve source attribution and the MIT notice. Use strict types, validated external boundaries, clear loading/empty/error states, responsive layouts, and no production path backed by fabricated market data.

## Acceptance direction

Each feature must have an explicit API/data source, authorization scope, failure state, and audit behavior. A screen is not considered complete merely because it renders sample values. CI should run repeatable formatting/lint, type checking, automated tests for important business rules, and production builds for affected workspaces.

## Implemented Phase 4

The AI Analyst supports sourced price/indicator/trend research, bounded asset comparisons, owned-watchlist summaries and stored-news reads through OpenRouter. The workspace shows actual tool progress, validated source cards and candle charts, independent observation/retrieval times, freshness, partial errors, recovery/retry and separate alert confirmation. Bare assets resolve through the existing USD convention; explicit quotes are preserved. Sentiment scores and retrospective watchlist-change analysis are unavailable. AI interpretation is fallible and distinct from observed facts; the product does not claim hallucination is impossible. AI cannot place trades or silently persist actions. Operational metrics are ADMIN-only and separate from developer-key Usage.
