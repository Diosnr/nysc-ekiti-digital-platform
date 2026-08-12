# Documented Assumptions & Open Questions

These items are not fully specified in the Source of Truth and require either architectural judgment or future stakeholder confirmation.

## Technical Assumptions (Phase 0)

1. **Primary language / runtime**: TypeScript / Node.js.
2. **Database**: PostgreSQL.
3. **ORM**: Prisma.
4. **UI framework**: Next.js 15 (App Router) for both public site and internal operations UI.
5. **API style**: REST (OpenAPI later). GraphQL is not required initially.
6. **Auth mechanism**: JWT access tokens + refresh tokens. Session metadata stored for audit.
7. **File storage**: Local filesystem in development; S3-compatible object storage in production (abstraction ready).
8. **Verification integration**: Will start behind an adapter. Actual scraping or API access is an **external authorization dependency** and must not be treated as granted.
9. **Monorepo**: Preferred for shared types and consistency.

## Business / Process Open Questions

- Exact fields available from the call-up verification response (name, state code, photo URL, institution, etc.).
- Official rules for automatic platoon assignment (state-code based?).
- Exact multi-step approval chain and required fields for Camp Exit Request.
- Whether bank account numbers are captured from external bank partners or entered by NYSC desk staff.
- Gender-based hostel rules and capacity calculation details.
- Photo source and retention policy.
- Scope of medical / welfare / incident modules that are authorized for digitization.
- Exact self-service capabilities allowed for PCMs vs. officials-only actions.
- Data retention and archival policy.
- Integration points with national NYSC systems (if any) beyond call-up verification.

## Explicit Non-Goals (for now)

- Turning the platform into a generic document management / file-sharing system.
- Hard-coding a fixed set of official roles.
- Redirecting users away from the platform for normal verification flow.
- Implementing every possible camp activity before stakeholder prioritization.
