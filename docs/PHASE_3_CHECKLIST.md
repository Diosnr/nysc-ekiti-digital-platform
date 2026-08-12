# Phase 3 — PCM Intake

## Surfaces

- **Self-service:** `/pcm` — live QR scan + paste + manual (public)
- **Staff:** `/staff/pcm` — registry, search, assisted intake

## Live QR

Library: **html5-qrcode** (camera stream, continuous decode).

Flow:
1. PCM taps **Scan call-up QR code**
2. Camera opens (rear camera preferred)
3. On successful decode → stop camera → `POST /api/pcm/intake` with `{ mode: "qr", input: decodedText }`
4. Backend adapter normalizes payload / URL
5. If identity complete → create PCM; if not → ask PCM to confirm name & call-up on the form, then resubmit with the same QR input + fields

```bash
cd apps/web && npm install
```

Requires HTTPS or localhost for camera access in most browsers.

## Config

```env
VERIFICATION_ADAPTER=manual
# When remote fetch of NYSC verification URLs is approved:
# VERIFICATION_ALLOW_REMOTE=true
# VERIFICATION_ADAPTER=official_api
```

## Done

- [x] Live QR decode on `/pcm`
- [x] Auto-submit decoded text to backend
- [x] Completion form when QR alone is insufficient
- [x] Manual + paste fallbacks
- [x] Staff registry

## Next: Phase 4 — Camp Operations
