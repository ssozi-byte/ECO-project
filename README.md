# Cost Optimization SaaS

Multi-tenant SaaS that ingests cloud billing exports, normalizes them into a unified cost model, and generates explainable, rules-based savings recommendations.

> **Troubleshooting:** if you ever see `Next.js build worker exited with code: null and signal: SIGBUS`, a native SWC binary is corrupt (usually from an interrupted `npm install`). Run `npm run verify:swc -- --fix`, or `rm -rf node_modules && npm install`.

## Stack

- **apps/web** — Next.js (App Router) frontend: marketing site + authenticated app
- **apps/api** — Express + TypeScript REST API (layered: routes → use cases → repositories)
- **packages/shared** — Zod schemas, types, constants shared by both apps
- **PostgreSQL + Prisma** — persistence
- **BullMQ + Redis** — background jobs (ingestion parse/normalize, recommendation runs)

## Quick start

```bash
# 1. Install
npm install

# 2. Start infra (postgres + redis)
docker compose -f infra/docker-compose.yml up -d

# 3. Configure env
cp .env.example apps/api/.env   # adjust if needed

# 4. Migrate + seed
npm run db:migrate
npm run db:seed

# 5. Run everything
npm run dev
# web → http://localhost:3000
# api → http://localhost:4000/api/health
```

## Layout

```
apps/web        Next.js frontend
apps/api        Express REST API + queue workers
packages/shared Shared types, Zod schemas, constants
infra/          docker-compose (postgres, redis)
```

## Seeded demo login

After `npm run db:seed`:

- owner@demo.io / demo1234 (owner role)
- analyst@demo.io / demo1234 (analyst role)
