# Phase 2 Checklist — Identity + Dynamic RBAC

## Completed

- [x] Prisma models: User, RefreshToken, Role, Permission, RolePermission, UserRole, AuditLog
- [x] Permission catalog + seed
- [x] Auth package + Auth API (login / refresh / logout / me)
- [x] Admin API (users, roles, permissions mapping, audit)
- [x] Permission enforcement on admin routes
- [x] Audit writer on sensitive actions
- [x] Staff login + dashboard
- [x] **Super Admin UI**
  - [x] Users / officers list + create (roles, LGA/zone fields)
  - [x] Roles list + create
  - [x] Permission mapping UI (by module, save via API)
  - [x] Audit log viewer
  - [x] Staff shell nav gated by permissions

## Local verification

```bash
cp .env.example .env
docker compose up -d
cd packages/database && npm install && npx prisma migrate dev --name phase2_identity_rbac && npm run seed
cd ../../apps/web && npm install && npm run dev
```

http://localhost:3000/staff/login  
`admin@nysc-ekiti.local` / `ChangeMeNow!123`

Then open:
- /staff/dashboard
- /staff/admin/users
- /staff/admin/roles
- /staff/admin/audit

## Optional polish (can defer)

- [ ] Officer activation email/WhatsApp link
- [ ] Deactivate user / rename role UI actions
- [ ] HttpOnly cookies instead of localStorage
- [ ] LGA/zone scope helpers on data queries
- [ ] Rate limiting on login

**Phase 2 Super Admin UI is complete.** Next: Phase 3 — PCM Intake.
