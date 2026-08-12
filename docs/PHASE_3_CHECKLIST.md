# Phase 3 — PCM Intake

## Completed

- [x] Source of Truth: full Camp Portal staff modules (Registration, Security in/out, Camp Director, Clinic, exit chain)
- [x] Prisma `Pcm` + `VerificationRecord` + lifecycle status enum
- [x] Verification adapter (manual + unauthorized remote placeholder)
- [x] `POST /api/pcm/intake` — manual intake, duplicate detection, audit
- [x] `GET /api/pcm` — search with LGA/zone scope
- [x] `GET /api/pcm/[id]` — detail with scope
- [x] Staff UI: `/staff/pcm` registry + manual intake form
- [x] Staff UI: `/staff/pcm/[id]` detail
- [x] Nav link PCM Registry

## After migrate

```bash
cd packages/database
npx prisma migrate dev --name phase3_pcm
```

Ensure Super Admin (or intake role) has `pcm:create` / `pcm:verify` / `pcm:read`.

## Deferred (by design)

- [ ] Live QR camera UI + authorized remote verification (needs stakeholder authorization)
- [ ] Self-service PCM onboarding portal page
- [ ] Photograph upload storage pipeline

## Next: Phase 4 — Camp Operations (security check-in, accommodation, …)
