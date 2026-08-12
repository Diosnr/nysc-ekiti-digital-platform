# Development Guide (Phase 0)

## Prerequisites

- Node.js ≥ 20
- Docker (for PostgreSQL)
- npm 10+

## Quick Start

```bash
# Clone
git clone https://github.com/Diosnr/nysc-ekiti-digital-platform.git
cd nysc-ekiti-digital-platform

# Environment
cp .env.example .env
# Edit .env as needed

# Start database
docker compose up -d

# Install (workspaces)
npm install

# Generate Prisma client (after schema is ready)
npm run db:generate

# Web app
cd apps/web && npm run dev
```

## Workspace Layout

- `apps/web` — Next.js public + operations UI
- `packages/database` — Prisma
- `packages/shared` — shared types/constants
- `packages/verification` — call-up verification adapter

## Conventions

- Follow `source of truth.md` for product rules.
- Document new assumptions in `docs/ASSUMPTIONS.md`.
- Prefer small, reviewable commits aligned to phases.
- Do not implement features ahead of the current phase without explicit decision.
