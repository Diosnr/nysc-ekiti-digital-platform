# Phase 2 Checklist — Identity + Dynamic RBAC

## Completed

- [x] Prisma models: User, RefreshToken, Role, Permission, RolePermission, UserRole, AuditLog
- [x] Permission catalog + seed (Super Admin + starter roles)
- [x] `@nysc/auth` package
- [x] Auth API: `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- [x] Admin API: `GET/POST /api/admin/users`, `GET/POST /api/admin/roles`, `PUT /api/admin/roles/[id]/permissions`, `GET /api/admin/permissions`, `GET /api/admin/audit`
- [x] `requireAuth` + permission checks on admin routes
- [x] Audit writer on login, logout, user create, role create, permission mapping
- [x] Staff login form wired to API + dashboard session shell
- [x] Next.js server mode for ops (static export only for GitHub Pages builds)

## Local verification

```bash
cp .env.example .env   # strong JWT secrets
docker compose up -d
cd packages/database && npm install && npx prisma migrate dev --name phase2_identity_rbac && npm run seed
cd ../../apps/web && npm install && npm run dev
```

Login at http://localhost:3000/staff/login  
Default: `admin@nysc-ekiti.local` / `ChangeMeNow!123`

## Remaining Phase 2 (optional polish before Phase 3)

- [ ] Super Admin UI for roles/permissions (API is ready)
- [ ] Officer activation email/WhatsApp link flow
- [ ] HttpOnly cookie session option (currently bearer + localStorage for SPA-style staff UI)
- [ ] LGA/zone scope helper used on data queries
- [ ] Rate limiting on login

## Rule

Menu visibility ≠ security. Every protected API uses `requireAuth` + permission keys.
