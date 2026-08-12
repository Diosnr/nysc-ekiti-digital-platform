# Phase 2 Checklist — Identity + Dynamic RBAC

## Completed

- [x] Prisma identity + RBAC + audit models
- [x] Permission catalog + seed + Super Admin
- [x] Auth API (login / refresh / logout / me)
- [x] **Login rate limiting** (10 attempts / 15 min per IP+email)
- [x] Admin API (users, roles, permissions, audit)
- [x] Super Admin UI (users, roles, permissions, audit)
- [x] **Officer activation flow**
  - [x] `POST /api/admin/users/[id]/activate` → issues token + URL
  - [x] `POST /api/auth/activate` → set password + profile
  - [x] `/staff/activate?token=…` UI
  - [x] "Activation link" button on users table (copy to clipboard)
- [x] **LGA/zone scope helpers** (`resolveGeoScope`, `pcmScopeWhere`) for data queries
- [x] Source of Truth updated with Camp Portal forms (Married Women, Skills, Account)

## Phase 2 is complete for implementation purposes.

Email/WhatsApp *delivery* of activation links remains an external integration (link is generated for admin to send).

## Next: Phase 3 — PCM Intake
