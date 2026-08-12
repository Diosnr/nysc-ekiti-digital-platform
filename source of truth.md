# NYSC Ekiti Digital Platform — Source of Truth

> **Authoritative product specification.**  
> All implementation decisions must be consistent with this document.  
> Where this document is silent, use sound software architecture and document assumptions explicitly.  
> Do not invent business rules that contradict the content below.

**Last updated:** 2026-08-12  
**Origin:** Stakeholder requirements, CIS briefing, and Camp Portal form specifications (including staff module detail from DIGITAL FILING SYSTEM).

---

## 1. Product Identity

**NYSC Ekiti CIS — Central Information System**  
Digital Information & Operations Platform (not a file dump).

Surfaces: Public website · Corps Members · Employers · Staff operations.  
Delivery: one web portal + field-friendly Windows/Android/iOS views for LGI/ZI.

---

## 2. Core Principle

**PCM / Corps Member is the central digital record.** Lifecycle-driven, not file-driven.

```
MOBILISATION → CALL-UP VERIFICATION → EKITI INTAKE
→ CAMP ARRIVAL → SECURITY CHECK-IN → ACCOMMODATION
→ CAMP REGISTRATION → ACCOUNT/BANK → PLATOON/KIT
→ CAMP ACTIVITIES → CAMP EXIT (structured approvals)
→ PPA → RELOCATION/LEAVE/OTHER → FINAL CLEARANCE → COMPLETION
```

---

## 3. Menu (CIS)

1. Home  
2. **Camp Portal** (§5)  
3. Electronic File Movement  
4. Admin  
5. Employer’s Page  

---

## 4. PCM Intake / QR

Scan call-up QR **inside** the platform → backend verifies via **adapter** → normalize → duplicate check → create/update PCM.  
No redirect away from platform. No hard-coded scraping in domain code. NYSC endpoint authorization is external.

---

## 5. Camp Portal — Stakeholder Forms & Staff Modules

Pattern for corps-facing forms: **Search call-up → name (identity) auto-fills from PCM record.**

### 5.1 Ekiti Married Women
1. Search call-up  
2. Name pops up automatically  
3. Are you pregnant? Yes/No  
4. Are you nursing a baby? Yes/No  
5. Husband’s address  
6. State of residence  
7. LGA of residence  
8. Community of residence  

### 5.2 Skills
1. Search call-up  
2. Name auto-fills  
3–5. Pick up to three skills from drop-downs (configurable catalogue)

### 5.3 Account (NIN card images)
1. Search call-up  
2. Name auto-fills  
3. Upload a picture of your NIN card  

Sensitive; access controlled and audited.

### 5.4 Registration Committee (staff log-in)
1. Download Excel file for **skilled** corps members  
2. Download Excel file for **Ekiti Married Women**  
3. Upload other details of corps member **not captured by security** (e.g. state code, PPA name, PPA address, LGI and ZI name and phone number, etc.)

Builds on existing PCM record — avoid unnecessary re-entry of identity.

### 5.5 Security Committee (staff log-in)
1. **Scan in** to capture corps data (check-in)  
2. **Scan out** corps members exiting camp, capturing:  
   - Reason for exit  
   - State going to  
   - Time and date of exit (auto where possible)  

Identity list: onclick name → show photo; mark check-in with auto timestamp.

### 5.6 Camp Director (staff log-in)
1. E-Filing system to **recommend or approve camp exit**

### 5.7 Camp Clinic (staff log-in)
1. E-Filing system to recommend camp exit based on **ill health**  
2. E-Filing for Nurses (vitals), Doctors (attend), Pharmacists (drugs given) for sick corps members  

**NOTE:** Doctors, Nurses and Pharmacists in camp stop using paper. They have **profiles that only work during camp** to run clinic operations.

### 5.8 Camp exit recommendation chain (E-Filing)

Usually:  
**Platoon Officer → Head of Clinic → Camp Director (approval) → State Coordinator**

(Intersects Electronic File Movement module.)

### 5.9 Other principles
- Accommodation only after security check-in; unique beds; hostel capacity  
- Bank desk configurable; staff do not “generate” account numbers  
- Platoon: daily attendance + periodic QR/face-ID  
- Kit issuance as status actions, not generic uploads  

---

## 6. Electronic File Movement

Structured cases + digital minutes on PCM (not Dropbox). Forward/return/reject/approve, drafts vs forwarded rules, registry, notifications, print for hard copy.

---

## 7. Geographic scope

LGI = own LGA only · ZI = own zone only · enforced on **queries**.

---

## 8–12. Admin, service year, RBAC, SC/CD, audit/security

As previously specified: dynamic RBAC, activation links, audit, rate-limited login, HTTPS, etc.

---

## 13. Data model principle

PCM central with related camp profiles (married women, skills, NIN), security in/out, registration extras, clinic, e-files, PPA, clearance, audit.

---

## 14. Phases

0 Arch · 1 Public · 2 Identity/RBAC · **3 PCM Intake** · 4 Camp ops · 5 Camp management (forms above) · 6 File movement + service year · 7 Analytics · 8 Production

---

## 15–16. Rules & open dependencies

No invented rules; NYSC/NIS auth external; skill catalogue and clinic role duration to be confirmed with stakeholders.
