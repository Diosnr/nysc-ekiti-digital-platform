# Domain Model Outline — NYSC Ekiti Digital Platform

> High-level conceptual model. Detailed Prisma schema will be refined in Phase 2–4.

## Core Entity: PCM (Prospective / Corps Member)

Central aggregate. One record per person progressing through the lifecycle.

**Key identity fields (examples — to be confirmed with real data sources):**
- State code / Call-up number
- Full name
- Gender
- Date of birth
- Institution / Course
- Photograph (URL or storage key)
- Contact details
- Status in lifecycle (enum or state machine)

## Related Entities (Relationships)

```
Pcm
├── VerificationRecord          (from call-up verification)
├── SecurityCheckIn             (1:1 or 1:n history)
├── AccommodationAllocation     (current + history)
├── CampRegistration            (details completed at registration desk)
├── BankAccountRegistration     (status, account number, bank, operator, timestamps)
├── PlatoonMembership
├── KitIssuance                 (items, sizes, status, issuedBy, issuedAt)
├── CampExitRequest             (workflow: PCM → Platoon Officer → Camp Director → State Coordinator)
├── PpaAssignment
├── RelocationRequest
├── LeaveRequest
├── Document                    (typed documents with approval workflow)
├── ClearanceRecord
└── AuditEvent[]                (via polymorphic or direct reference)
```

## Supporting Operational Entities

- **Hostel** — name, capacity (beds), gender restriction?, active
- **Bed** — hostelId, bedNumber / code, currentPcmId (nullable), status
- **Platoon** — code/name, officers, capacity rules
- **User** — staff / officials
- **Role** — dynamic
- **Permission** — resource:action
- **RolePermission**
- **UserRole**
- **AuditLog**
- **Announcement / News / Event** (public content)
- **GalleryItem**
- **Faq**
- **Resource** (downloadable public resources)

## Status / Lifecycle

Prefer explicit status fields or a lightweight state machine on the PCM (and on key sub-processes) rather than deriving everything from presence of related records.

Example PCM statuses (illustrative):
`MOBILISED → VERIFIED → CHECKED_IN → ACCOMMODATED → REGISTERED → BANK_REGISTERED → PLATOON_ASSIGNED → KIT_ISSUED → CAMP_ACTIVE → CAMP_EXIT_REQUESTED → CAMP_EXITED → PPA_POSTED → ... → CLEARED → COMPLETED`

Sub-processes (bank registration, kit issuance, exit request) have their own status fields.

## Rules Encoded in Domain

- A bed can be assigned to at most one active PCM.
- A hostel cannot exceed its configured bed capacity.
- Accommodation allocation is only allowed after security check-in.
- Kit issuance is only allowed after platoon assignment (configurable).
- All sensitive mutations produce an audit event.
