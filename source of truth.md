# NYSC Ekiti Digital Platform — Source of Truth

> **Authoritative product specification.**  
> All implementation decisions must be consistent with this document.  
> Where this document is silent, use sound software architecture and document assumptions explicitly.  
> Do not invent business rules that contradict the content below.

**Last updated:** 2026-08-12  
**Origin:** Compiled from stakeholder requirements, product direction, and the NYSC Ekiti CIS (Central Information System) briefing document (*DIGITAL FILING SYSTEM.docx*).

---

## 1. Product Identity

Also referred to as **NYSC Ekiti CIS — Central Information System**.

This is **not** primarily a file-sharing system or a generic document dump.

The platform is designed as a:

**NYSC Ekiti Digital Information & Operations Platform (CIS)**

**Delivery targets:**

- One web portal
- Progressive native / progressive web capability for Windows, Android and iOS (field-friendly views for LGIs, Zonal Inspectors and selected staff)

It has these major surfaces:

### A. Public NYSC Ekiti Website
For the general public, prospective corps members (PCMs) and corps members.

Institutional/public-facing information such as:

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

### B. Corps Members Page / Self-Service
Progressive self-service for PCMs and serving corps members (profile, requests, status of files that affect them, where authorized).

### C. Employers Page
A dedicated surface for employers (PPA hosts) — e.g. viewing relevant corps information and participating in leave / request notification flows where designed.

### D. Internal NYSC Ekiti Operations Platform (Staff Log-in)
A secure authenticated platform for NYSC officials and authorized operational personnel.

The internal platform should **digitize manual NYSC-related processes** (camp operations, electronic file movement / digital minutes, registry, approvals) rather than simply storing files.

---

## 2. Core Product Principle

**Model the system around the PCM / Corps Member lifecycle, not around files as the primary object.**

A PCM should have **one central digital record**. Files, minutes, and approvals are workflows *about* that record (or related entities), not a substitute for it.

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
  (PCM → Platoon Officer → Camp Director → State Coordinator)
→ PPA
→ RELOCATION / LEAVE / OTHER SERVICES (via electronic file movement where applicable)
→ FINAL CLEARANCE
→ COMPLETION
```

Every manual NYSC process that can responsibly be digitized should be evaluated for automation.

---

## 3. High-Level Menu Structure (Stakeholder CIS View)

Stakeholder-facing menu concepts (map to modules; do not hard-code as immutable UI):

1. **Home Page**
2. **Camp Portal**
   - Nursing / Pregnant women (capture husband’s address for posting considerations)
   - Skills
   - Account (including NIN card image capture where authorized)
   - Download Excel file (exports)
   - Registration Committee (**staff log-in**)
   - Security Committee — QR code scanning for coming in and going out (**staff log-in**)
   - Camp Director — camp exeats and approvals (**staff log-in**)
   - Camp Clinic (**staff log-in**)
   - Platoon — daily attendance (mark present); periodic face-ID or QR attendance (e.g. once in 3 weeks) via phone/tablet
3. **Electronic File Movement**
4. **Admin**
   - Upload file and update (aim to synchronize with national NIS where authorized)
   - Upload picture file
   - Register profiles
   - Set permissions
5. **Employer’s Page**

Field reduction: LGA Inspectors (LGI) and Zonal Inspectors (ZI) should have phone-friendly views of relevant CIS / corps data for field use.

---

## 4. PCM Intake / QR Workflow

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

Security Committee QR usage for **camp in/out** is a separate operational use of QR and should share scanner infrastructure where practical, but is not the same as call-up intake.

---

## 5. Camp Workflow

The system should model the actual movement of a PCM through camp.

### Arrival / Security (Security Committee)
PCM arrives at camp. Security verifies the PCM and records:

- Identity (including: onclick a name on a list → show the picture of the person)
- Arrival / check-in status (simple "Mark Check-in" button)
- Date / time (auto-stored based on the moment they are marked as checked in)
- Relevant security / check-in information
- QR-based scanning for coming in and going out (as specified for Security Committee)

### Accommodation
Accommodation personnel receive the eligible PCM **only after** check-in by security / arrivals.

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

### Camp Registration (Registration Committee)
Registration personnel complete the required registration workflow on top of the existing PCM record (avoid unnecessary re-entry).

### Account / NIN
Support capture of account-related data and NIN card images where authorized and configured for the camp.

### Bank / Account Registration
Configurable workflow supporting bank assignment, registration status, account-opening status, account number capture, verification status, responsible operator, timestamp, audit history.

**Do NOT assume** NYSC personnel generate bank account numbers themselves. Model the bank desk as a configurable operational / partner workflow.

### Platoon
Support:

- Platoon assignment (automatic from state-code rules where applicable)
- Platoon officers and membership
- Daily attendance by marking present
- Periodic attendance via phone/tablet face-ID or QR (e.g. once in three weeks) as specified by stakeholders

### Kits
After platoon assignment: view eligible PCMs, issue kits, record items/sizes/missing/replacements, track status — preferably a clear “kit issued” action. Not a generic file workflow.

### Camp Director
Camp exeats and approvals (structured workflow; may intersect with electronic file movement).

### Camp Clinic
Medical / camp health workflows for authorized staff.

### Nursing / Pregnant women
Capture relevant information (including husband’s address for posting considerations) as specified.

### Skills
Capture / manage skills-related camp data as specified.

### Exports
Authorized download of Excel (and similar) extracts from camp and corps data.

---

## 6. Electronic File Movement (Digital Filing / Digital Minute Sheet)

This is a **first-class operational module** from the CIS briefing. It digitizes paper file minutes and routing between officers.

It is **not** a generic cloud drive. Each “file” is a structured case tied to a corps member (or related subject) with an auditable chain of minutes, attachments, and decisions.

### Staff dashboard (after log-in)

Example concepts:

- Welcome, {Officer name}
- Pending Files (pushed to you, not yet attended)
- Approved Today (approvals relevant to you not yet viewed)
- Returned Files (rejected or returned for correction)
- Pick a File
- Search
- Reports / Statistics (work done, monthly analysis, batch analysis)
- Logout

### Pick a File / Initiate

1. Find by state code or call-up number
2. Corps member details appear in the file grid
3. Add a sheet (blank area to type a minute)
4. Select officer(s) to receive the minute
5. Select priority
6. Date and time auto-generated
7. Subject of the report
8. Attach required documents
9. Write the minute
10. Save as draft **or**
11. Forward file — next officer receives it immediately

### Receiving officer actions

- View attached documents
- Read prior minutes
- Add a minute
- Save draft
- Upload additional documents
- Recommend or Approve
- Return
- Reject
- Forward

Every action is **time-stamped** automatically.

If rejected, the originating officer can re-edit their minute and re-forward.  
**Drafts** can be deleted; **minutes already forwarded** cannot be deleted (audit integrity).

### Digital minute sheet example pattern

A file may accumulate sheets such as:

- LGI → Zonal Inspector (request + attachments, e.g. medical report, employer stamp)
- ZI → Head CIM (recommendation)
- Head CIM → State Coordinator (for approval)
- State Coordinator → LGI (and CC ZI, Head CIM, Registry) with approval, including official stamp/signature representation for the State Coordinator

### Approvals and notification to parties

On approval, LGI (or designated officer) may notify corps member and employer using captured phone/email channels.

### Notifications

The system should support notifying users through:

- Email
- SMS (optional)
- WhatsApp (where integration is authorized and feasible)
- In-app notifications

### Registry and print

- File tracking at Registry
- Ability to print relevant reports and approvals for hard-copy filing where still required (e.g. print corps member approvals from LGA and file)

### File movement reports (examples)

- Files approved this month
- Pending approvals
- Overdue files
- Files by department
- Officer performance
- Approval turnaround time

---

## 7. Scope by Geography (LGI / ZI)

- Corps data organized LGA by LGA, Zone by Zone
- **LGI** sees only corps members in their LGA
- **Zonal Inspector** sees only corps members in their zone
- Broader roles (e.g. State Coordinator, designated HQ officers) see wider scope per permission configuration

Phone/app-friendly reduction of CIS views for LGI and ZI field work is a stated goal.

---

## 8. Admin, Profiles and Officers

Admin capabilities (via Super Admin / authorized admin roles):

- Upload file and update (with intent to synchronize with national NIS where authorized — treat NIS integration as an external dependency)
- Upload picture files
- Register profiles
- Set permissions (dynamic RBAC)

**Officer onboarding notes from stakeholders:**

- Admin creates officer names, GL, ranks and post
- Each officer completes their profile
- Activation link via email and WhatsApp
- Printout sent to email for submission to HRM

---

## 9. Post-Camp / Service Year

Continue the PCM record after orientation camp. Modules include (structured workflows, not mere uploads):

- PPA posting, records, acceptance, changes
- Leave applications (often via electronic file movement)
- Relocation applications
- Corps member requests
- Documents
- Service history
- Final clearance
- Completion / pass-out records

---

## 10. Official Roles and Permissions (Dynamic RBAC)

**Do NOT hard-code a fixed list of NYSC official roles.**

There must be a **Super Admin-controlled dynamic RBAC system**.

Super Admin should be able to:

- Create roles
- Rename roles
- Deactivate roles
- Assign permissions
- Assign users to roles
- Control accessible modules and menu visibility
- Control actions and scope (e.g. LGA-only, zone-only)

**Potential initial operational roles (starting concepts only — not immutable):**

- Super Admin
- State Coordinator
- Camp Director
- Security Officer / Security Committee
- Accommodation Officer
- Registration Officer / Registration Committee
- Bank / Account Registration Officer
- Platoon Officer
- Kit / Store Officer
- Camp Clinic / Medical Officer
- LGI (Local Government Inspector)
- Zonal Inspector (ZI)
- Head CIM
- Registry Officer
- CDS Officer
- PPA Officer
- Clearance Officer
- Welfare Officer
- Reports / Records Officer

Super Admin must be able to create roles such as “Camp Documentation Supervisor” and define exact access.

**IMPORTANT:** Menu visibility is **NOT** security. Every backend operation must enforce authorization independently.

---

## 11. State Coordinator and Camp Director

High-level operational roles with broader visibility, still implemented through the same permission system.

- **State Coordinator** — day-to-day administration of the state secretariat; terminal approval authority on many electronic files (with stamp/signature representation as specified).
- **Camp Director** — operational oversight of camp activities, exeats and camp approvals.

Do not hard-code exact permissions; configure granularly.

---

## 12. Auditability & Security

Official administrative system. Important actions must be auditable.

Track at minimum:

- Who performed the action
- Role at time of action
- What changed (previous / new value)
- Timestamp
- Affected PCM / file / entity
- IP / device / session where appropriate

Examples: accommodation change, PPA change, account number change, platoon change, kit issued, clearance approved, minute forwarded/approved/rejected, user role changed, PCM record edited.

**Security expectations from stakeholders:**

- User login
- Role-based permissions
- Password encryption
- Audit logs
- Automatic backups
- SSL (HTTPS)
- Session timeouts

Do not implement destructive administrative operations without authorization and audit logging.

---

## 13. Data Model Principle

The **PCM (Corps Member) is the central entity**.

Do not duplicate PCM information unnecessarily across modules.

Prefer relationships / references:

```
PCM
├── Mobilisation / Verification
├── Camp Registration
├── Security Check-in / In-Out logs
├── Accommodation
├── Bank Account / NIN artefacts
├── Platoon + Attendance
├── Kit Issuance
├── Camp Clinic / Special categories (e.g. nursing)
├── Skills
├── Documents
├── PPA
├── CDS
├── Electronic Files (cases) + Minute Sheets + Attachments
├── Clearance
├── Requests / Relocation / Leave
└── Audit History
```

Electronic files reference the PCM (and optionally employer, LGA, zone) rather than copying the full identity into every minute.

---

## 14. Implementation Phases (Roadmap)

### PHASE 0 — Repository & Architecture
Initialize repository, structure, env, auth/RBAC architecture outlines, logging, docs, testing/CI foundation.

### PHASE 1 — Foundation + Public Website
Public-facing NYSC Ekiti website and foundational infrastructure.

### PHASE 2 — Identity + Dynamic RBAC
Authentication, users, roles, permissions, scoped access (LGA/zone), audit logging, Super Admin controls, officer profile activation flow foundations.

### PHASE 3 — PCM Intake
QR scanner, verification adapter, PCM creation, duplicate detection, onboarding flows.

### PHASE 4 — Camp Operations
Security check-in / in-out, accommodation, registration, account/NIN, bank desk, platoon, kit issuance — same PCM record.

### PHASE 5 — Camp Management
Camp Director exeats/approvals, clinic, nursing/pregnant data, skills, attendance (daily + periodic QR/face), exports.

### PHASE 6 — Electronic File Movement + Service-Year
Digital minute sheets, pick-file, forward/return/reject/approve, registry tracking, notifications, leave/relocation/PPA-related structured cases, employer/corps notification paths.

### PHASE 7 — Analytics, Reporting & Administration
Dashboards, file statistics, officer performance, exports, audit views, admin uploads, NIS sync *if authorized*.

### PHASE 8 — Hardening, Mobile Field Views & Production
Security review, performance, backups, monitoring, LGI/ZI phone-friendly views, Windows/Android/iOS strategy (PWA and/or native as decided), production deployment, documentation.

---

## 15. Working Rules for Implementers

- Do **not** implement the entire system in one pass.
- Verify each phase before moving on.
- Do not create placeholder features merely to claim a phase is complete.
- Do not invent business rules that contradict this document.
- Do not turn the platform into a generic ERP or a pure file-sharing app.
- Electronic File Movement is a **structured case + minute workflow**, not Dropbox.
- The PCM record remains central; files are about the corps member lifecycle and secretariat processes.
- Build it as a serious production system for NYSC Ekiti State.

---

## 16. Open Items / External Dependencies

Documented for clarity (do not silently assume):

- Authorization for any automation against national NYSC / NIS endpoints
- Exact field list from call-up verification
- Face-ID attendance vendor/device policy and privacy constraints
- WhatsApp / SMS gateway contracts and data protection
- Official stamp/signature asset for State Coordinator digital approvals
- Confirmed public contact details for the website
- Priority order of camp sub-modules vs electronic file movement for the first production cut
