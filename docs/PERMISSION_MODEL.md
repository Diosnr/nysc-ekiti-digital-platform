# Permission Model — Dynamic RBAC

## Principles

1. **No hard-coded role list** in application code for authorization decisions.
2. Super Admin can create, rename, deactivate roles and map any set of permissions.
3. Menu visibility is driven by permissions but is **not** a security boundary.
4. Every protected API endpoint / service method must check the required permission(s).
5. Permissions are fine-grained (`resource:action`).
6. Geographic scope (LGA / zone) is enforced in addition to permissions for LGI and ZI.

## Permission catalog (seeded)

### Identity & Admin
`user:read` `user:create` `user:update` `user:deactivate`  
`role:read` `role:create` `role:update` `role:assign`  
`permission:manage` `audit:read`

### PCM
`pcm:read` `pcm:create` `pcm:update` `pcm:search` `pcm:verify` `pcm:photo:view`

### Camp
`security:checkin` `accommodation:read` `accommodation:assign` `accommodation:change`  
`hostel:manage` `registration:complete` `bank:register` `bank:update`  
`platoon:assign` `platoon:manage` `platoon:attendance` `kit:issue` `kit:view`  
`camp:exeat` `camp:clinic` `camp:export`

### Electronic file movement
`file:read` `file:create` `file:minute` `file:forward` `file:return` `file:reject` `file:approve` `file:registry`

### Service year
`ppa:manage` `relocation:manage` `leave:manage` `clearance:manage`

### Content & reports
`news:manage` `announcement:manage` `event:manage` `gallery:manage` `faq:manage` `resource:manage`  
`report:view` `report:export` `dashboard:view`

## Starter roles (seeded, permissions assigned by Super Admin except Super Admin itself)

- Super Admin (system, all permissions)
- State Coordinator
- Camp Director
- Security Officer
- Registration Officer
- Accommodation Officer
- Platoon Officer
- LGI
- Zonal Inspector
- Head CIM
- Registry Officer

## Enforcement

- Use `@nysc/auth` → `hasPermission(granted, required)` on the server.
- Audit log stores `actorRoleAtTime` at the moment of the action.
- Frontend may hide menus based on permissions; that does **not** protect APIs.
