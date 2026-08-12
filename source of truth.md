# NYSC Ekiti Digital Platform — Source of Truth

> **Authoritative product specification.**  
> All implementation decisions must be consistent with this document.  
> Where this document is silent, use sound software architecture and document assumptions explicitly.  
> Do not invent business rules that contradict the content below.

**Last updated:** 2026-08-12  
**Origin:** Compiled from stakeholder requirements, product direction, the NYSC Ekiti CIS briefing (*DIGITAL FILING SYSTEM.docx*), and Camp Portal form specifications provided by stakeholders.

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

1. **Home Page**
2. **Camp Portal** (see §5 for detailed forms)
3. **Electronic File Movement**
4. **Admin**
5. **Employer’s Page**

Field reduction: LGI and ZI phone-friendly views of relevant corps data.

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

- User should **NOT** be redirected away from the NYSC Ekiti platform as part of the normal workflow.
- QR scanner is an **intake mechanism**, not the entire product.
- Verification behind an **abstraction / adapter** (no hard-coded scraping throughout the app).
- Authorization to automate against NYSC endpoints is an **external dependency**.

Security Committee QR for **camp in/out** is separate from call-up intake but may share scanner infrastructure.

---

## 5. Camp Portal — Detailed Forms (Stakeholder Spec)

Camp Portal forms are **search-by-call-up** driven: search call-up number → **name (and identity) populate automatically** from the central PCM record. Do not re-type identity fields.

### 5.1 Ekiti Married Women

Form path under Camp Portal:

1. Search call-up
2. Name pops up automatically
3. Are you pregnant? — Yes / No
4. Are you nursing a baby? — Yes / No
5. Write address of your husband
6. Pick the state of residence
7. Pick LGA of residence
8. Pick community of residence

Purpose includes posting considerations (husband’s address / residence). Data is stored against the PCM record (special category / married-women camp profile), not as a disconnected form dump.

### 5.2 Skills

1. Search call-up
2. Name pops up automatically
3. Pick a skill from the drop-down
4. Pick another skill
5. Pick a 3rd skill from the drop-down

Skills list is configurable (admin-maintained catalogue). Up to three skills per PCM for camp capture.

### 5.3 Account (NIN card images)

1. Search call-up
2. Name pops up automatically
3. Capture / upload NIN card images (and related account desk fields as configured)

Aligns with bank/account registration workflows; NIN images are sensitive — access controlled and audited.

### 5.4 Other Camp Portal modules (summary)

- **Download Excel** — authorized exports
- **Registration Committee** (staff) — complete registration on existing PCM record
- **Security Committee** (staff) — QR in/out; check-in with photo on name click; mark check-in + auto timestamp
- **Camp Director** (staff) — exeats and approvals
- **Camp Clinic** (staff) — medical workflows where authorized
- **Platoon** — daily attendance (mark present); periodic face-ID or QR attendance (e.g. once in 3 weeks) on phone/tablet

### 5.5 Core camp movement (unchanged principles)

- Accommodation only after security check-in; bed uniqueness; hostel capacity
- Bank desk is configurable; do not assume NYSC staff generate account numbers
- Platoon auto-assignment from state-code rules where applicable
- Kit issuance as operational status actions, not generic file upload

---

## 6. Electronic File Movement (Digital Minute Sheet)

First-class module: structured cases + minutes tied to corps members, not a cloud drive.

Staff dashboard: Pending Files, Approved Today, Returned Files, Pick a File, Search, Reports, Logout.

Pick file → search state code/call-up → details grid → add sheet → select officer(s) → priority → auto date/time → subject → attach → minute → draft or forward.

Receiver: view docs, read minutes, add minute, draft, upload, Recommend/Approve, Return, Reject, Forward. All time-stamped. Drafts deletable; forwarded minutes not deletable.

Example chain: LGI → ZI → Head CIM → State Coordinator (stamp/signature) → LGI + CC.

Notifications: email, SMS (optional), WhatsApp (if authorized), in-app. Registry tracking + print for hard copy where required.

---

## 7. Scope by Geography (LGI / ZI)

- Corps data LGA by LGA, Zone by Zone
- **LGI** sees only corps members in their LGA (`user.lgaCode`)
- **ZI** sees only corps members in their zone (`user.zoneCode`)
- Broader roles per permission configuration

Scope must be enforced on **data queries**, not only in the UI.

---

## 8. Admin, Profiles and Officers

- Admin creates officer names, GL, ranks and post
- Each officer completes profile via **activation link** (email and WhatsApp where configured)
- Printout to email for HRM submission
- Dynamic RBAC; upload files/pictures; NIS sync only if authorized

---

## 9. Post-Camp / Service Year

PPA, leave, relocation, requests, documents, clearance, completion — structured workflows (often via electronic file movement).

---

## 10. Official Roles and Permissions (Dynamic RBAC)

**Do NOT hard-code a fixed list of official roles.** Super Admin creates/renames/deactivates roles and maps permissions. Menu visibility is **not** security.

Starter concepts: Super Admin, State Coordinator, Camp Director, Security, Registration, Accommodation, Platoon, LGI, ZI, Head CIM, Registry, CDS, PPA, Clearance, Welfare, Reports, Clinic, Kit/Store, etc.

---

## 11. State Coordinator and Camp Director

High-level roles via the same permission system; SC terminal approvals with stamp/signature representation; Camp Director camp oversight and exeats.

---

## 12. Auditability & Security

Audit who/role-at-time/what/before-after/when/PCM/entity/IP. Login, RBAC, password encryption, audit logs, backups, HTTPS, session timeouts. Rate-limit login attempts.

---

## 13. Data Model Principle

PCM is central. Prefer:

```
PCM
├── Verification / Intake
├── Married Women / Nursing profile (Camp Portal form)
├── Skills (up to 3)
├── NIN / Account artefacts
├── Security Check-in / In-Out
├── Accommodation
├── Registration
├── Platoon + Attendance
├── Kit Issuance
├── Clinic
├── Electronic Files + Minutes
├── PPA / Leave / Relocation / Clearance
└── Audit History
```

---

## 14. Implementation Phases

0 Architecture · 1 Public site · 2 Identity/RBAC/activation/scope · 3 PCM Intake · 4 Camp ops · 5 Camp management (Married Women, Skills, Account forms, attendance…) · 6 File movement + service year · 7 Analytics · 8 Hardening & field apps

---

## 15. Working Rules

Phase by phase; no invented business rules; not a generic ERP or Dropbox; PCM-centric; production quality.

---

## 16. Open Items / External Dependencies

- NYSC/NIS automation authorization
- Call-up verification field list
- Face-ID policy
- WhatsApp/SMS gateways
- SC stamp asset
- Public contact details
- Skill catalogue contents from stakeholders
