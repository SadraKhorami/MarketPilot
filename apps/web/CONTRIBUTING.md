# Frontend contribution notes

- Keep MarketPilot features inside their owning route and use shared components only when another feature needs them.
- Use the existing dashboard shell, theme tokens, and shadcn UI primitives. Do not modify `src/components/ui/` or `src/components/calendar/` without a separate reason and review.
- Keep route pages server-rendered by default; isolate state and browser APIs in small Client Components.
- Use strict TypeScript, validate form input with Zod, and add loading, empty, error, keyboard, and focus states where relevant.
- Label local market/news fixtures as illustrative and not live. Do not add fabricated values to a production data path.
- Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, and `pnpm build` from the repository root before a frontend phase commit.
- Follow the root `THIRD_PARTY_NOTICES.md` and retain the upstream dashboard's MIT notice in `apps/web/LICENSE`.
