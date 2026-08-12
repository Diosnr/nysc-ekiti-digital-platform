# NYSC Ekiti Digital Platform — Source of Truth

> **Authoritative product specification.**  
> All implementation decisions must be consistent with this document.  
> Where this document is silent, use sound software architecture and document assumptions explicitly.  
> Do not invent business rules that contradict the content below.

**Last updated:** 2026-08-12  
**Origin:** Compiled from stakeholder requirements and product direction provided for the NYSC Ekiti Digital Information & Operations Platform.

---

## 1. Product Identity

This is **not** primarily a file-sharing system.

The platform is designed as a:

**NYSC Ekiti Digital Information & Operations Platform**

It has three major surfaces:

### A. Public NYSC Ekiti Website
For the general public, prospective corps members (PCMs) and serving corps members.

It should contain appropriate institutional/public-facing information such as:

- Home
- About NYSC Ekiti
- Orientation Camp
- News
- Announcements
- Events
- Resources
- Gallery
- Contact
- FAQs
- PCM / Corps Member services where applicable

The public website must feel like a modern institutional/government digital service, **not** an administration dashboard.

### B. PCM / Corps Member Services
The platform should progressively provide self-service functionality to PCMs and serving corps members.

### C. Internal NYSC Ekiti Operations Platform
A secure authenticated platform for NYSC officials and authorized operational personnel.

The internal platform should **digitize manual NYSC-related processes** rather than simply storing files.

---

## 2. Core Product Principle

**Model the system around the PCM / Corps Member lifecycle, not around files.**

A PCM should have **one central digital record**.

Conceptual lifecycle:

```
MOBILISATION
→ CALL-UP VERIFICATION
→ EKITI INTAKE
→ CAMP ARRIVAL
→ SECURITY CHECK-IN
→ ACCOMMODATION
→ CAMP REGISTRATION
→ ACCOUNT / BANK REGISTRATION
→ PLATOON / KIT ISSUANCE
→ CAMP ACTIVITIES
→ REQUEST CAMP EXIT
  (PCM paper → Platoon Officer → Camp Director → State Coordinator)
→ PPA
→ RELOCATION / OTHER SERVICES
→ FINAL CLEARANCE
→ COMPLETION
```

Every manual NYSC process that can responsibly be digitized should be evaluated for automation.

---

## 3. PCM Intake / QR Workflow

The call-up letter contains a QR code which leads to an NYSC call-up-letter verification page.

**Intended product experience:**

1. PCM or authorized NYSC official opens the NYSC Ekiti platform
2. Opens camera / QR scanner
3. Scans call-up letter
4. Extracts / uses the verification URL
5. Backend obtains the verified call-up information
6. Normalize and validate data
7. Check for duplicate PCM
8. Populate / create PCM record

**Critical constraints:**

- The user should **NOT** be redirected away from the NYSC Ekiti platform as part of the normal workflow.
- The QR scanner is an **intake mechanism**, not the entire product.
- Design the NYSC verification integration behind an **abstraction / adapter** so that the rest of the system does not depend directly on NYSC's current webpage implementation.
- Do **not** hard-code scraping logic throughout the application.
- The verification integration must be isolated so it can later be replaced by an authorized API or another official integration without rewriting the PCM system.
- Do **not** assume that automation against an NYSC endpoint is authorized merely because the endpoint is technically accessible. Treat authorization / integration approval as an external dependency and document it.

---

## 4. Camp Workflow

The system should model the actual movement of a PCM through camp.

### Arrival / Security
PCM arrives at camp. Security verifies the PCM and records:

- Identity (including: onclick a name on a list → show the picture of the person)
- Arrival / check-in status (simple "Mark Check-in" button)
- Date / time (auto-stored based on the moment they are marked as checked in)
- Relevant security / check-in information

### Accommodation
Accommodation personnel receive the eligible PCM on their end **only after** they have been marked checked-in by security / arrivals.

They should be able to:

- See available accommodation
- Assign hostel
- Assign bed
- Change allocation where authorized
- Record accommodation status

**Rules:**
- Prevent two PCMs from being assigned the same bed
- Prevent assignment to hostels already at capacity
- Ability to create hostels and set their bed capacity

### Camp Registration
Registration personnel complete the required registration workflow.
The registration workflow should build on the PCM record already created during intake rather than re-entering information unnecessarily.

### Bank / Account Registration
Configurable Bank / Account Registration workflow supporting:

- Bank assignment where applicable
- Bank registration status
- Account-opening status
- Account number capture
- Account verification / status
- Bank / operator responsible for the entry
- Timestamp
- Audit history

**Do NOT assume** that NYSC personnel literally generate bank account numbers themselves.  
Model the bank / account-opening desk as an operational actor or external partner workflow whose exact process can be configured for the camp.

### Platoon
Support:

- Platoon assignment
- Platoon officers
- Platoon membership
- Platoon records
- Relevant activities

Where NYSC rules determine platoon assignment automatically from state-code information, support **automatic assignment** rather than unnecessary manual entry.

### Kits
Platoon / kit personnel should be able to:

- View eligible PCMs after they have been assigned a platoon
- Assign / issue kits
- Record issued items
- Record sizes where applicable
- Record missing / replacement items
- Track issuance status
- Ideally a simple button that, on click, marks the PCM as "kit has been issued"

Do **not** treat kit issuance as a generic file / document workflow.

---

## 5. Camp Operations (Future / Configurable)

Continue mapping and digitizing manual camp activities. Potential areas include:

- Attendance
- Parade-related records
- Lectures
- Platoon activities
- Medical / camp health workflows (where authorized)
- Leave / pass requests
- Complaints
- Incident reports
- Announcements
- Camp events
- Competitions
- Welfare requests
- Documentation
- Clearance
- Reports

**Do not blindly implement every item.** Use this Source of Truth as the requirements authority and identify anything requiring stakeholder confirmation. The architecture should nevertheless make these workflows possible.

---

## 6. Post-Camp / Service Year

The platform should be capable of continuing the PCM record after orientation camp.

Potential modules:

- PPA posting
- PPA records
- PPA acceptance
- Leave applications
- Relocation applications
- PPA changes
- Corps member requests
- Documents
- Service history
- Final clearance
- Completion / pass-out records

NYSC officially identifies online self-services such as relocation and PPA-related document processes, and state coordinators participate in relocation recommendations. Model these as **structured workflows** rather than file uploads.

---

## 7. Official Roles and Permissions (Dynamic RBAC)

**Do NOT hard-code a fixed list of NYSC official roles.**

There must be a **Super Admin-controlled dynamic RBAC system**.

Super Admin should be able to:

- Create roles
- Rename roles
- Deactivate roles
- Assign permissions
- Assign users to roles
- Control accessible modules
- Control menu visibility
- Control actions
- Control scope where required

**Potential initial operational roles (starting concepts only — not immutable):**

- Super Admin
- State Coordinator
- Camp Director
- Security Officer
- Accommodation Officer
- Registration Officer
- Bank / Account Registration Officer
- Platoon Officer
- Kit / Store Officer
- CDS Officer
- PPA Officer
- Clearance Officer
- Medical / Camp Health Officer
- Welfare Officer
- Reports / Records Officer

Super Admin must be able to create something like "Camp Documentation Supervisor" and decide exactly what that role can access.

**IMPORTANT:** Menu visibility is **NOT** security.  
Every backend operation must enforce authorization independently.  
A hidden menu item must not mean the API endpoint is accessible.

---

## 8. State Coordinator and Camp Director

Treat these as high-level operational roles with broader visibility, but still implement their capabilities through the same permission system.

- The **State Coordinator** is responsible for day-to-day administration of the NYSC state secretariat according to NYSC's official structure.
- The **Camp Director** should have operational oversight of camp activities and workflows.

Do not hard-code assumptions about their exact permissions. Model permissions granularly so stakeholders can configure them.

---

## 9. Auditability

This is an official administrative system. Important actions must be auditable.

Track at minimum:

- Who performed the action
- Role at time of action
- What changed
- Previous value
- New value
- Timestamp
- Affected PCM
- Affected entity
- Relevant IP / device / session information where appropriate

Examples of audited actions:

- PCM accommodation changed
- PPA changed
- Account number added / changed
- Platoon changed
- Kit issued
- Clearance approved
- Document approved
- User role changed
- PCM record edited

Do not implement destructive administrative operations without appropriate authorization and audit logging.

---

## 10. Data Model Principle

The **PCM is the central entity**.

Do not duplicate PCM information unnecessarily across modules.

Prefer relationships / references:

```
PCM
├── Mobilisation
├── Verification
├── Camp Registration
├── Security Check-in
├── Accommodation
├── Bank Account
├── Platoon
├── Kit Issuance
├── Documents
├── PPA
├── CDS
├── Clearance
├── Requests
├── Relocation
└── Audit History
```

---

## 11. Implementation Phases (Roadmap)

### PHASE 0 — Repository & Architecture
- Initialize repository
- Establish project structure
- Configure development environment
- Establish frontend / backend boundaries
- Establish database architecture
- Establish environment configuration
- Establish authentication architecture
- Establish authorization architecture
- Establish logging / error handling
- Establish documentation conventions
- Establish testing strategy
- Establish CI/CD foundation where appropriate

Do not build random UI before the architecture is established.

### PHASE 1 — Foundation + Public Website
Build the public-facing NYSC Ekiti website and foundational platform infrastructure.

### PHASE 2 — Identity + Dynamic RBAC
Build authentication, users, roles, permissions, menu/module access, audit logging, Super Admin controls.

### PHASE 3 — PCM Intake
QR scanner, verification adapter, verification result, PCM creation, duplicate detection, self-service + official-assisted onboarding, manual fallback.

### PHASE 4 — Camp Operations
Security check-in, accommodation, registration, bank/account registration, platoon assignment, kit issuance — all connected to the same PCM record.

### PHASE 5 — Camp Management
Remaining approved camp operational workflows.

### PHASE 6 — Service-Year Operations
Approved PPA, CDS, clearance, relocation, leave, requests, documents, reports.

### PHASE 7 — Analytics, Reporting & Administration
Operational dashboards, reports, exports, statistics, audit views, administrative controls.

### PHASE 8 — Hardening & Production
Security review, authorization review, validation, performance, indexes, error handling, backups, monitoring, logging, testing, production deployment, documentation.

---

## 12. Working Rules for Implementers

- Do **not** attempt to implement the entire system in one pass.
- After completing each phase, verify it before moving to the next.
- Do not create placeholder features merely to claim a phase is complete.
- Do not invent business rules.
- Do not turn the platform into a generic ERP.
- Do not turn the platform into a file-sharing application.
- The goal is a purpose-built NYSC Ekiti digital operations platform with a strong public-facing website.
- Build it as a serious production system.
