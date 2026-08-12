# Phase 3 — PCM Intake

## Product placement (corrected)

- **Self-service:** `/pcm` — Prospective Corps Members scan QR or enter details (public).
- **Staff-assisted:** `/staff/pcm` — registry, search, manual intake for officials.
- QR / live verification is a **product feature**, not blocked. Remote HTTP fetch is **config-gated** (`VERIFICATION_ADAPTER` / `VERIFICATION_ALLOW_REMOTE`) because authorization against NYSC endpoints is an external dependency — the scan UX and intake path remain available with completion/manual fallback.

## Completed

- [x] `Pcm` + `VerificationRecord` models
- [x] Verification adapter: manual + QR payload (+ optional remote when configured)
- [x] `POST /api/pcm/intake` supports public self-service and staff
- [x] `/pcm` self-service page with camera QR path + paste + manual form
- [x] Staff registry UI
- [x] Header link: PCM Registration

## Config

```env
# default: QR works; remote page fetch off until authorized
VERIFICATION_ADAPTER=manual
# when stakeholders approve remote verification against NYSC:
# VERIFICATION_ADAPTER=official_api
# VERIFICATION_ALLOW_REMOTE=true
```

## Next

- Wire a barcode/QR decoding library on the live camera stream (BarcodeDetector / html5-qrcode)
- Official field mapper once NYSC response shape is confirmed
- Phase 4 Camp Operations
