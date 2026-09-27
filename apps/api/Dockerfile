# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# API — Express + Prisma, run via tsx (same runtime path as dev).
# Monorepo-aware: build context must be the repo ROOT:
#   docker build -f apps/api/Dockerfile .
# NOTE: runtime image keeps devDependencies (tsx, prisma CLI for
# `migrate deploy`). Acceptable for MVP; slim later with a compiled build.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
# Build shared package, then generate the Prisma client into node_modules
RUN npm run build --workspace @costopt/shared \
 && DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    npm run db:generate --workspace @costopt/api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    API_PORT=4000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api ./apps/api
COPY package.json package-lock.json ./
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
EXPOSE 4000
# Apply migrations, then start. Opt-out by overriding CMD if you migrate separately.
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && exec npx tsx apps/api/src/server.ts"]
