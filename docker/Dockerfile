# syntax=docker/dockerfile:1.7
# Same runtime/libc in builder and runners; Linux-native Prisma and bcrypt stay compatible.
FROM node:24.20.0-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /srv
COPY THIRD_PARTY_NOTICES.md ./THIRD_PARTY_NOTICES.md

FROM runtime AS build
ENV NODE_ENV=development
RUN npm install --global pnpm@10.26.0 \
    && apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=marketpilot-pnpm,target=/pnpm/store \
    pnpm fetch --frozen-lockfile --store-dir /pnpm/store
COPY . .
# Generation only, never connect to a DB, migrate, seed, or use runtime secrets during builds.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN --mount=type=cache,id=marketpilot-pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --store-dir /pnpm/store

FROM build AS services-build
RUN pnpm exec turbo run build --filter=@marketpilot/api... --filter=@marketpilot/worker...
# Restored build layers may outlive the cache mount; allow missing deploy tarballs to be fetched.
RUN --mount=type=cache,id=marketpilot-pnpm,target=/pnpm/store \
    pnpm --store-dir /pnpm/store --prefer-offline --filter @marketpilot/api deploy --prod --no-optional --frozen-lockfile /prod/api \
    && node docker/copy-prisma-client.mjs /prod/api \
    && pnpm --store-dir /pnpm/store --prefer-offline --filter @marketpilot/worker deploy --prod --no-optional --frozen-lockfile /prod/worker \
    && node docker/copy-prisma-client.mjs /prod/worker

FROM runtime AS api
COPY --from=services-build --chown=node:node /prod/api ./
COPY --chown=node:node docker/http-healthcheck.mjs ./healthcheck.mjs
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "healthcheck.mjs", "http://127.0.0.1:4000/api/v1/health/ready"]
CMD ["node", "dist/main.js"]

FROM runtime AS worker
COPY --from=services-build --chown=node:node /prod/worker ./
COPY --chown=node:node docker/http-healthcheck.mjs ./healthcheck.mjs
USER node
EXPOSE 4100
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "healthcheck.mjs", "http://127.0.0.1:4100/health/ready"]
CMD ["node", "dist/main.js"]

FROM build AS web-build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1
# Public origins are intentionally fixed in the browser bundle; each environment builds its own web image.
RUN node -e 'for (const key of ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_APP_URL"]) { const value = process.env[key]; if (!value) throw Error("Missing build setting: " + key); const url = new URL(value); if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw Error("Invalid build setting: " + key); if (key === "NEXT_PUBLIC_APP_URL" ? url.origin !== value : url.pathname !== "/api/v1") throw Error("Invalid build path: " + key); }'
RUN mkdir -p apps/web/public && pnpm exec turbo run build --filter=@marketpilot/web...

FROM runtime AS web
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build --chown=node:node /app/apps/web/public ./apps/web/public
COPY --chown=node:node apps/web/LICENSE ./apps/web/LICENSE
COPY --chown=node:node docker/http-healthcheck.mjs ./healthcheck.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "healthcheck.mjs", "http://127.0.0.1:3000/health"]
CMD ["node", "apps/web/server.js"]

# Separate operator-only tool image: CLI/dev dependencies never enter app runners.
FROM services-build AS migration-build
# Restored build layers may outlive the cache mount; allow missing deploy tarballs to be fetched.
RUN --mount=type=cache,id=marketpilot-pnpm,target=/pnpm/store \
    pnpm --store-dir /pnpm/store --prefer-offline --filter @marketpilot/db deploy --frozen-lockfile /prod/migrations

FROM runtime AS migrate
COPY --from=migration-build --chown=node:node /prod/migrations ./
USER node
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/schema.prisma"]
