# Module Map — NYSC Ekiti Digital Platform

## Surface A — Public Website

| Module            | Responsibility                                      | Phase |
|-------------------|-----------------------------------------------------|-------|
| Home              | Landing, key highlights, calls to action            | 1     |
| About             | About NYSC Ekiti                                    | 1     |
| Orientation Camp  | Camp information for public / PCMs                  | 1     |
| News              | News listing + detail                               | 1     |
| Announcements     | Official announcements                              | 1     |
| Events            | Upcoming / past events                              | 1     |
| Resources         | Downloadable public resources                       | 1     |
| Gallery           | Photo / media gallery                               | 1     |
| Contact           | Contact form / details                              | 1     |
| FAQs              | Frequently asked questions                          | 1     |
| PCM Services      | Entry points to self-service (later phases)         | 1+    |

## Surface B — PCM / Corps Member Self-Service

| Module                | Responsibility                                      | Phase |
|-----------------------|-----------------------------------------------------|-------|
| Intake (QR / Manual)  | Self or assisted onboarding                         | 3     |
| Profile               | View / limited update of own record                 | 3+    |
| Camp Exit Request     | Submit and track exit request                       | 4/5   |
| PPA / Relocation etc. | Structured self-service workflows                   | 6     |

## Surface C — Internal Operations

| Module                     | Responsibility                                           | Phase |
|----------------------------|----------------------------------------------------------|-------|
| Auth & Session             | Login, logout, token management                          | 2     |
| Users & RBAC               | Super Admin role/permission management                   | 2     |
| Audit Viewer               | Searchable audit trail                                   | 2/7   |
| PCM Registry               | Search, view, manage PCM records                         | 3     |
| Verification Adapter       | Isolated call-up verification                            | 3     |
| Security Check-in          | Mark arrival, view photo, timestamps                     | 4     |
| Accommodation              | Hostels, beds, allocation, capacity enforcement          | 4     |
| Camp Registration          | Complete registration on top of existing PCM data        | 4     |
| Bank / Account Registration| Configurable bank desk workflow                          | 4     |
| Platoon Management         | Assignment (auto where possible), officers, membership   | 4     |
| Kit Issuance               | Issue / track kits, sizes, status                        | 4     |
| Camp Exit Workflow         | Multi-step approval (Platoon → Director → Coordinator)   | 4/5   |
| Camp Management (misc)     | Attendance, medical, welfare, incidents, etc. (approved) | 5     |
| PPA / Service Year         | Posting, acceptance, changes                             | 6     |
| Relocation / Leave / Requests | Structured workflows                                  | 6     |
| Clearance & Completion     | Final clearance processes                                | 6     |
| Dashboards & Reports       | Operational analytics, exports                           | 7     |
| Content Management         | News, announcements, events, gallery, FAQs (public CMS)  | 1/7   |

## Cross-Cutting

- Dynamic RBAC & permission enforcement
- Audit logging
- Logging & error handling
- Configuration / feature flags
- File / media storage abstraction
