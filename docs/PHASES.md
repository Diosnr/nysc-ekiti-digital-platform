# Implementation Phases

See also `source of truth.md` §11.

## PHASE 0 — Repository & Architecture (Current)

- [x] Create GitHub repository
- [x] Create authoritative `source of truth.md`
- [x] Architecture documentation
- [x] Domain model outline
- [x] Module map
- [x] Permission model outline
- [ ] Project structure scaffolding (apps/, packages/, configs)
- [ ] Environment configuration (`.env.example`)
- [ ] Basic Docker / docker-compose foundation
- [ ] CI skeleton (GitHub Actions)
- [ ] Documentation conventions established
- [ ] Testing strategy foundation noted

## PHASE 1 — Foundation + Public Website
Public-facing institutional website + shared infrastructure.

## PHASE 2 — Identity + Dynamic RBAC
Authentication, users, roles, permissions, audit logging, Super Admin controls.

## PHASE 3 — PCM Intake
QR scanner, verification adapter, PCM creation, duplicate detection, onboarding flows.

## PHASE 4 — Camp Operations
Security check-in → Accommodation → Registration → Bank → Platoon → Kit (connected to same PCM).

## PHASE 5 — Camp Management
Additional approved camp workflows.

## PHASE 6 — Service-Year Operations
PPA, CDS, clearance, relocation, leave, requests, documents.

## PHASE 7 — Analytics, Reporting & Administration
Dashboards, reports, exports, audit views.

## PHASE 8 — Hardening & Production
Security, performance, monitoring, backups, production deployment, final documentation.
