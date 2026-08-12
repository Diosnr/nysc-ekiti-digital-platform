# Architecture Overview — NYSC Ekiti Digital Platform

## 1. High-Level Goals

- Model the **PCM lifecycle** as the central domain concept.
- Provide three distinct surfaces: Public Website, PCM/Corps Member self-service, Internal Operations.
- Strong separation of concerns, especially for the NYSC verification integration.
- Dynamic, Super-Admin-controlled RBAC (no hard-coded role lists).
- Full auditability of sensitive operations.
- Production-grade foundations from Phase 0.

## 2. Recommended Stack (Phase 0 Decision)

| Layer              | Technology                          | Rationale |
|--------------------|-------------------------------------|-----------|
| Public + Ops UI    | Next.js 15 (App Router) + TypeScript + Tailwind CSS | Modern, SEO-friendly public site + powerful internal app in one framework |
| API                | NestJS (preferred) or Next.js Route Handlers (initial) | Clear domain modules, DI, guards, interceptors for RBAC & audit |
| Database           | PostgreSQL                          | Relational integrity, strong support for audit trails & complex queries |
| ORM                | Prisma                              | Type-safe, excellent migrations, good DX |
| Auth               | JWT + Refresh Tokens + Session metadata | Stateless APIs + controllable sessions |
| RBAC               | Dynamic roles + permission strings / matrix | Super Admin can create any role and map permissions |
| File storage       | Local / S3-compatible (later)       | Photos, documents, gallery |
| QR / Camera        | Browser Web APIs + adapter          | Intake only; no external redirect |
| Verification       | Isolated Adapter pattern            | Can swap scraping → official API later |
| Monorepo           | Turborepo (or simple apps/ + packages/) | Shared types, utils, config |
| Testing            | Vitest / Jest + Playwright          | Unit + integration + e2e foundations |
| CI                 | GitHub Actions                      | Lint, typecheck, test, build |
| Containers         | Docker + docker-compose             | Local dev parity + future deployment |

**Assumption (documented):** NestJS will be introduced for the core domain API. Next.js can host the public site and a thin BFF layer initially. This can be refined after stakeholder technical confirmation.

## 3. Repository Structure (Target)

```
nysc-ekiti-digital-platform/
├── apps/
│   ├── web/                 # Next.js — public site + internal ops UI
│   └── api/                 # NestJS API (or next-api initially)
├── packages/
│   ├── database/            # Prisma schema, client, migrations
│   ├── shared/              # Shared types, constants, utils
│   ├── auth/                # Auth helpers, guards contracts
│   └── verification/        # NYSC verification adapter interface + implementations
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DOMAIN_MODEL.md
│   ├── MODULE_MAP.md
│   ├── PERMISSION_MODEL.md
│   ├── PHASES.md
│   └── ASSUMPTIONS.md
├── .github/workflows/
├── docker-compose.yml
├── .env.example
├── source of truth.md
├── README.md
└── turbo.json / package.json (root)
```

## 4. Key Architectural Patterns

### 4.1 PCM as Aggregate Root
All camp and post-camp data hang off a single `Pcm` entity. Avoid duplicating identity fields.

### 4.2 Verification Adapter
```ts
interface CallUpVerificationAdapter {
  verify(qrPayloadOrUrl: string): Promise<VerifiedCallUpData>;
}
```
Implementations can be:
- `ScrapingAdapter` (temporary, behind feature flag, with explicit authorization note)
- `OfficialApiAdapter` (future)
- `ManualFallbackAdapter`

### 4.3 Dynamic RBAC
- `Role` (name, description, isActive, isSystem)
- `Permission` (resource + action, e.g. `pcm:checkin`, `accommodation:assign`)
- `RolePermission` join
- `UserRole` join (with optional scope: camp, LGA, etc. later)
- Guards / middleware check permissions on every protected endpoint.
- Menu visibility is a separate, non-security concern driven by the same permission set.

### 4.4 Audit Log
Append-only table:
- actorId, actorRoleAtTime, action, entityType, entityId, pcmId (nullable), before, after, ip, userAgent, sessionId, createdAt

### 4.5 Soft Deletes & Status Machines
Prefer status fields and soft deletes over hard deletes for operational data.

## 5. Environment & Configuration

- All secrets via environment variables
- `.env.example` committed; real `.env` never committed
- Separate configs for local / staging / production
- Feature flags for verification adapter mode and experimental modules

## 6. Security Foundations (Phase 0)

- HTTPS only in production
- JWT short-lived + rotating refresh tokens
- Rate limiting on auth and verification endpoints
- Input validation (Zod / class-validator)
- Authorization on every mutating and sensitive read endpoint
- Audit on all privilege and PCM state changes
- No secrets in client bundles

## 7. Testing Strategy (Foundation)

- Unit tests for domain services and adapters
- Integration tests for Prisma repositories and auth flows
- Contract tests for the verification adapter
- E2E smoke tests for public site and critical intake path (later phases)

## 8. Documentation Conventions

- `source of truth.md` is the product authority
- Architecture decisions recorded in `docs/`
- Assumptions explicitly listed in `docs/ASSUMPTIONS.md`
- Each major module gets a short README inside its folder when implemented
