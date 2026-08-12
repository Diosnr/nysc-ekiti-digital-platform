# Permission Model Outline — Dynamic RBAC

## Principles

1. **No hard-coded role list** in application code for authorization decisions.
2. Super Admin can create, rename, deactivate roles and map any set of permissions.
3. Menu visibility is driven by permissions but is **not** a security boundary.
4. Every protected API endpoint / service method must check the required permission(s).
5. Permissions are fine-grained (`resource:action` or `resource:action:scope`).

## Suggested Permission Vocabulary (extensible)

Examples (not exhaustive):

### Identity & Admin
- `user:read`, `user:create`, `user:update`, `user:deactivate`
- `role:read`, `role:create`, `role:update`, `role:assign`
- `permission:manage`
- `audit:read`

### PCM Core
- `pcm:read`, `pcm:create`, `pcm:update`, `pcm:search`
- `pcm:verify` (intake)
- `pcm:photo:view`

### Camp Operations
- `security:checkin`
- `accommodation:read`, `accommodation:assign`, `accommodation:change`
- `hostel:manage`
- `registration:complete`
- `bank:register`, `bank:update`
- `platoon:assign`, `platoon:manage`
- `kit:issue`, `kit:view`
- `camp-exit:request`, `camp-exit:approve-platoon`, `camp-exit:approve-director`, `camp-exit:approve-coordinator`

### Service Year
- `ppa:manage`, `relocation:manage`, `leave:manage`, `clearance:manage`

### Content
- `news:manage`, `announcement:manage`, `event:manage`, `gallery:manage`, `faq:manage`, `resource:manage`

### Reports
- `report:view`, `report:export`, `dashboard:view`

## Role Examples (configurable, not code constants)

- Super Admin → all permissions
- State Coordinator → broad operational + approval permissions
- Camp Director → camp oversight + certain approvals
- Security Officer → `security:checkin`, `pcm:photo:view`, limited `pcm:read`
- Accommodation Officer → accommodation + hostel permissions
- etc.

Super Admin can invent new roles (e.g. "Camp Documentation Supervisor") and map exactly the permissions required.

## Enforcement

- Backend guards / middleware / decorators check permissions on every request.
- Frontend uses the same permission set only for UI decisions (show/hide).
- Audit log records the role(s) the actor held at the time of the action.
