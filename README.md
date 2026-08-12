# NYSC Ekiti Digital Platform

**NYSC Ekiti Digital Information & Operations Platform**

A purpose-built digital platform for NYSC Ekiti State that combines:

1. A modern public institutional website
2. Progressive self-service for Prospective Corps Members (PCMs) and Corps Members
3. A secure internal operations platform that digitizes real NYSC workflows around the PCM lifecycle

> **This is not a file-sharing system.**  
> The system is modeled around the PCM lifecycle from mobilisation through camp and service year to final clearance.

---

## Source of Truth

All product requirements live in:

**[`source of truth.md`](./source%20of%20truth.md)**

Treat that document as authoritative. Architecture and implementation decisions are derived from it.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./docs/ARCHITECTURE.md) | Stack, structure, key patterns |
| [Domain Model](./docs/DOMAIN_MODEL.md) | Core entities and relationships |
| [Module Map](./docs/MODULE_MAP.md) | Surfaces and modules by phase |
| [Permission Model](./docs/PERMISSION_MODEL.md) | Dynamic RBAC design |
| [Phases](./docs/PHASES.md) | Implementation roadmap |
| [Assumptions](./docs/ASSUMPTIONS.md) | Documented assumptions & open questions |
| [Development](./docs/DEVELOPMENT.md) | Local setup guide |

---

## Current Status

| Phase | Status |
|-------|--------|
| **Phase 0 — Repository & Architecture** | Complete |
| **Phase 1 — Foundation + Public Website** | Complete |
| Phase 2 — Identity + Dynamic RBAC | Next |

### Public website pages live

Home · About · Orientation Camp · News · Announcements · Events · Resources · Gallery · FAQs · Contact · PCM Services (landing)

---

## Quick start (local)

```bash
git clone https://github.com/Diosnr/nysc-ekiti-digital-platform.git
cd nysc-ekiti-digital-platform
cp .env.example .env
docker compose up -d
npm install
cd apps/web && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## High-Level Lifecycle (Conceptual)

```
Mobilisation → Call-up Verification → Ekiti Intake
→ Camp Arrival → Security Check-in → Accommodation
→ Camp Registration → Bank/Account Registration
→ Platoon / Kit Issuance → Camp Activities
→ Camp Exit Request (multi-level approval)
→ PPA → Relocation / Other Services
→ Final Clearance → Completion
```

---

## Development Principles

- PCM is the central entity — do not duplicate identity data.
- Dynamic RBAC controlled by Super Admin — no hard-coded official roles.
- Menu visibility ≠ security. Every backend operation enforces authorization.
- Important actions are auditable (who, role-at-time, what changed, before/after, when, affected PCM).
- NYSC verification is isolated behind an adapter.
- Do not invent business rules that contradict the Source of Truth.
- Build phase by phase; verify before proceeding.

---

## Repository

https://github.com/Diosnr/nysc-ekiti-digital-platform

---

*Built as a serious production system for NYSC Ekiti State.*
