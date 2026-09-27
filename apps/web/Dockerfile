# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# WEB — Next.js standalone output.
# Build context must be the repo ROOT:
#   docker build -f apps/web/Dockerfile .
# Requires `output: "standalone"` in next.config.mjs.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/
# Prisma client is imported by shared types at type level only, but workspace
# npm ci installs the api workspace too; a generate is harmless and keeps
# node_modules consistent.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    npm run db:generate --workspace @costopt/api || true
RUN npm run build --workspace @costopt/shared \
 && npm run build --workspace @costopt/web

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
