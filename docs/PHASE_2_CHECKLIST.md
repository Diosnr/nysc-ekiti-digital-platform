# Phase 2 Checklist — Identity + Dynamic RBAC

## Completed in this commit

- [x] Prisma models: User, RefreshToken, Role, Permission, RolePermission, UserRole, AuditLog
- [x] Permission catalog (admin, pcm, camp, files, service, content, reports)
- [x] Seed script: all permissions, Super Admin role (all perms), starter roles, Super Admin user
- [x] `@nysc/auth` package: password hash/verify, JWT access/refresh, `hasPermission`
- [x] Staff portal entry + login UI foundation (`/staff`, `/staff/login`)
- [x] Next.js config: static export **only** for GitHub Pages builds (server mode for ops/auth)
- [x] Source of Truth already includes CIS officer activation, LGI/ZI scope, file permissions

## Required locally to go live with auth

1. Copy `.env.example` → `.env` and set strong `JWT_*_SECRET` values (≥32 chars)
2. `docker compose up -d`
3. From `packages/database`: `npx prisma migrate dev --name phase2_identity_rbac` then `npm run seed`
4. Default Super Admin (change immediately):
   - Email: `admin@nysc-ekiti.local` (or `SEED_SUPER_ADMIN_EMAIL`)
   - Password: `ChangeMeNow!123` (or `SEED_SUPER_ADMIN_PASSWORD`)

## Remaining Phase 2 work (next commits)

- [ ] API routes: `POST /api/auth/login`, refresh, logout
- [ ] API routes: users CRUD, roles CRUD, role–permission mapping (Super Admin)
- [ ] Middleware / guards enforcing permissions on every protected route
- [ ] Audit log writer service used by mutations
- [ ] Officer activation flow (email/WhatsApp link) foundation
- [ ] Staff dashboard shell gated by session
- [ ] Scope enforcement helpers (LGA / zone) for LGI and ZI

## Rule reminder

Menu visibility ≠ security. Backend must check permissions on every sensitive operation.
