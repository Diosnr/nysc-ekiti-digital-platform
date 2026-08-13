# Phase 3 — PCM Intake

## Real QR format (stakeholder sample)

Call-up letter QR encodes:

```
https://mgt.nysc.org.ng/verify/CorpMemberVerify.aspx?svc=callup&callup=<encrypted-token>
```

Sample verified fields from that page:

| Field | Example |
|-------|---------|
| Full Name | Okenwa Chinyere Maryjane |
| Call-Up Number | NYSC/EST/2026/256817 |
| Gender | Female |
| Institution | Enugu St. Univ. of Sci. and Tech |
| State of Deployment | Ekiti |
| Camp Address | NYSC PERM. ORIENT. CAMP ISE-ORUN/EMURE LGA, EKITI STATE |
| Batch / Year | Batch B / 2026 |
| Photo | base64 JPEG on page |

**Adapter behaviour:** when QR text is an `mgt.nysc.org.ng` … `CorpMemberVerify.aspx` URL, the server fetches the page and parses those fields (PCM stays on Ekiti site). No redirect away.

## Surfaces

- `/pcm` — live QR (html5-qrcode) → auto POST intake
- `/staff/pcm` — registry + assisted intake

## Flow

1. Scan QR on call-up letter
2. Decoded URL → `POST /api/pcm/intake` `{ mode: "qr", input: url }`
3. Server fetches + parses NYSC verify page
4. Creates PCM with name, call-up number, gender, institution, state, photo
5. Duplicate call-up numbers rejected (409)

## Install

```bash
cd apps/web && npm install && npm run dev
```

Camera needs localhost or HTTPS.

## Done

- [x] Live QR decode
- [x] Real NYSC verify URL parsing
- [x] Self-service `/pcm`
- [x] Staff registry
- [x] Duplicate detection

## Next: Phase 4 — Camp Operations
