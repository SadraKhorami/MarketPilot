# MarketPilot Product Specification

## Purpose

MarketPilot is a market intelligence SaaS application. It presents market data supplied by MarketFeed, lets authenticated users organize assets and alerts, and provides AI-assisted analysis grounded in verified application data. It does not execute trades and must not present the AI as a financial adviser.

## Users and core workflows

- A user signs in, reviews the market overview, and creates a personal watchlist.
- A user explores an asset's current price, indicators, trend, news, and sentiment when those capabilities and fields are confirmed in the MarketFeed contract.
- A user configures an alert and selects dashboard, Telegram, or Discord delivery.
- A user asks the AI Analyst a question; the assistant calls authorized read tools and explains the returned data with timestamps and source context.
- A user manages linked notification channels, API keys, API usage, account sessions, and an activity history.

## Product boundaries

- MarketFeed is the only planned external market data source until another source is explicitly approved.
- All market data, news, sentiment, symbols, ranges, rate limits, and endpoint details must come from the verified MarketFeed contract. Unknown values are not represented as facts.
- Local development may use an isolated mock MarketFeed provider. Mock data must be marked as demo data and must never be selected as a production fallback.
- No order placement, brokerage connection, portfolio custody, or trade execution is in scope.
- Third-party news content is displayed and summarized as untrusted data, not as application instructions.

## Initial navigation

Dashboard; Markets (Overview, Watchlist); Analytics; AI Analyst; News & Sentiment; Alerts; Bots (Telegram, Discord); API (API Keys, Usage); Activity; Settings.

## Quality requirements

Keep the existing dashboard as the frontend foundation. Retain useful shell, theme, chart, table, and form components while removing unrelated sample pages/data as each product screen replaces them. Preserve source attribution and the MIT notice. Use strict types, validated external boundaries, clear loading/empty/error states, responsive layouts, and no production path backed by fabricated market data.

## Acceptance direction

Each feature must have an explicit API/data source, authorization scope, failure state, and audit behavior. A screen is not considered complete merely because it renders sample values. CI should run repeatable formatting/lint, type checking, automated tests for important business rules, and production builds for affected workspaces.
