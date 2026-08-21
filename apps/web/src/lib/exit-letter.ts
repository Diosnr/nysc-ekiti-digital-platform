/** Official camp exit / temporary release letter — print → PDF (A4). */

export type ExitLetterData = {
  fullName: string;
  callUpNumber: string;
  stateCode?: string | null;
  gender?: string | null;
  institution?: string | null;
  course?: string | null;
  platoonCode?: string | null;
  exitGround?: string | null;
  exitReason?: string | null;
  exitDestinationState?: string | null;
  exitDestinationLga?: string | null;
  expectedReturnAt?: string | null;
  approvedAt?: string | null;
  /** Corps member passport / profile photo URL */
  photographUrl?: string | null;
  /** Absolute URL to NYSC crest (optional; defaults to site /nysc-logo.png). */
  logoUrl?: string | null;
  /** State Coordinator signature image URL (from staff onboarding / signature page). */
  signatureUrl?: string | null;
  /** State Coordinator display name */
  signerName?: string | null;
  /** e.g. State Coordinator, Ekiti State */
  signerTitle?: string | null;
  /** Rank / grade if available */
  signerRank?: string | null;
  /** Post if available */
  signerPost?: string | null;
};

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtLongDate(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toLocaleDateString("en-GB");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtShortDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Build a dense, official letter HTML with:
 * - NYSC crest in header
 * - Repeated semi-transparent logo watermarks across the page
 * - Corps member passport photo
 * - Single signature block: State Coordinator only (image from uploaded signature)
 */
export function buildExitLetterHtml(data: ExitLetterData): string {
  const date = fmtLongDate(data.approvedAt);
  const logoSrc =
    data.logoUrl && data.logoUrl.length > 0 ? data.logoUrl : "/nysc-logo.png";

  const photoBlock = data.photographUrl
    ? `<div class="photo-frame"><img src="${esc(
        data.photographUrl
      )}" alt="Corps member" /></div>`
    : `<div class="photo-frame photo-placeholder">PHOTO</div>`;

  const returnLine = data.expectedReturnAt
    ? `<tr><td class="lbl">Expected return</td><td class="val">${esc(
        fmtLongDate(data.expectedReturnAt)
      )}</td></tr>`
    : "";

  const dest =
    [data.exitDestinationLga, data.exitDestinationState]
      .filter(Boolean)
      .join(", ") || "";

  const signerName = data.signerName?.trim() || "State Coordinator";
  const signerTitle =
    data.signerTitle?.trim() ||
    data.signerPost?.trim() ||
    "State Coordinator, NYSC Ekiti State";
  const signerRank = data.signerRank?.trim() || "";

  const signatureImg = data.signatureUrl
    ? `<img class="sig-img" src="${esc(
        data.signatureUrl
      )}" alt="Signature" />`
    : `<div class="sig-missing">Signature on file</div>`;

  const watermarkCells = Array.from({ length: 24 })
    .map(
      () =>
        `<div class="wm-cell"><img src="${esc(
          logoSrc
        )}" alt="" /></div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Camp Exit Letter — ${esc(data.fullName)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: "Times New Roman", Times, Georgia, serif;
      font-size: 10.5pt;
      color: #0f172a;
      background: #fff;
      line-height: 1.45;
    }
    .no-print {
      font-family: system-ui, -apple-system, sans-serif;
      text-align: center;
      padding: 14px 12px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .no-print button {
      padding: 10px 20px;
      background: #006400;
      color: #fff;
      border: 0;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0,0,0,.12);
    }
    .no-print button:hover { background: #005000; }
    .no-print p { margin-top: 8px; font-size: 12px; color: #64748b; }

    .sheet {
      position: relative;
      width: 100%;
      max-width: 210mm;
      min-height: 277mm;
      margin: 0 auto;
      padding: 14mm 16mm 12mm;
      overflow: hidden;
      background: #fff;
    }

    .watermarks {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(6, 1fr);
      opacity: 0.07;
      transform: rotate(-18deg) scale(1.15);
      transform-origin: center center;
    }
    .wm-cell {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
    }
    .wm-cell img {
      width: 72px;
      height: 72px;
      object-fit: contain;
      filter: grayscale(0.15);
    }

    .content { position: relative; z-index: 1; }

    .header {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      border-bottom: 2.5px solid #006400;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .header-crest img {
      width: 68px;
      height: 68px;
      object-fit: contain;
      display: block;
    }
    .header-text { flex: 1; text-align: center; }
    .header-text .org {
      font-size: 13.5pt;
      font-weight: 700;
      color: #006400;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      line-height: 1.25;
    }
    .header-text .sub {
      font-size: 9pt;
      color: #334155;
      margin-top: 2px;
    }
    .header-text .addr {
      font-size: 8.5pt;
      color: #475569;
      margin-top: 1px;
    }
    .header-text .tag {
      display: inline-block;
      margin-top: 6px;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #006400;
      border: 1px solid #006400;
      padding: 2px 10px;
      border-radius: 2px;
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin: 10px 0 8px;
    }
    .title-block { flex: 1; }
    h1 {
      font-size: 12pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      text-decoration: underline;
      text-underline-offset: 3px;
      margin-bottom: 4px;
    }
    .ref {
      font-size: 9pt;
      color: #475569;
    }
    .date-line {
      text-align: right;
      font-size: 10pt;
      white-space: nowrap;
      padding-top: 2px;
    }

    .identity {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      margin: 10px 0 12px;
      padding: 10px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      background: rgba(255,255,255,0.72);
    }
    .photo-frame {
      flex-shrink: 0;
      width: 92px;
      height: 110px;
      border: 1.5px solid #006400;
      border-radius: 2px;
      overflow: hidden;
      background: #f1f5f9;
    }
    .photo-frame img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .photo-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8pt;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 0.08em;
    }
    .meta-table { flex: 1; width: 100%; border-collapse: collapse; }
    .meta-table td {
      padding: 2px 0;
      vertical-align: top;
      font-size: 10pt;
    }
    .meta-table .lbl {
      width: 34%;
      color: #64748b;
      font-weight: 600;
      padding-right: 8px;
    }
    .meta-table .val {
      color: #0f172a;
      font-weight: 600;
    }

    .body {
      text-align: justify;
      margin: 4px 0 8px;
    }
    .body p { margin: 0 0 8px; }
    .body strong { font-weight: 700; }

    .notice {
      margin: 10px 0 14px;
      padding: 8px 10px;
      border-left: 3px solid #006400;
      background: rgba(0, 100, 0, 0.04);
      font-size: 9.5pt;
    }

    .sign-block {
      margin-top: 22px;
      display: flex;
      justify-content: flex-end;
    }
    .sign-card {
      width: 48%;
      min-width: 220px;
      text-align: center;
      padding-top: 4px;
    }
    .sig-img {
      max-width: 160px;
      max-height: 56px;
      object-fit: contain;
      display: block;
      margin: 0 auto 4px;
    }
    .sig-missing {
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      font-size: 9pt;
      font-style: italic;
      border-bottom: 1px solid #cbd5e1;
      margin-bottom: 6px;
    }
    .sign-name {
      font-weight: 700;
      font-size: 10.5pt;
      margin-top: 2px;
    }
    .sign-title {
      font-size: 9pt;
      color: #334155;
      margin-top: 1px;
    }
    .sign-rank {
      font-size: 8.5pt;
      color: #64748b;
      margin-top: 1px;
    }
    .sign-rule {
      border-top: 1px solid #334155;
      margin: 8px auto 0;
      width: 85%;
      padding-top: 4px;
      font-size: 8pt;
      color: #64748b;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-size: 8pt;
      color: #64748b;
      text-align: center;
    }
    .footer .code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: 0.02em;
    }

    @media print {
      .no-print { display: none !important; }
      .sheet {
        max-width: none;
        min-height: auto;
        padding: 0;
      }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
    <p>Use your browser print dialog → Save as PDF. Letter is sized for A4.</p>
  </div>

  <div class="sheet">
    <div class="watermarks" aria-hidden="true">${watermarkCells}</div>

    <div class="content">
      <header class="header">
        <div class="header-crest">
          <img src="${esc(logoSrc)}" alt="NYSC" width="68" height="68" />
        </div>
        <div class="header-text">
          <div class="org">National Youth Service Corps</div>
          <div class="sub">Ekiti State Secretariat</div>
          <div class="addr">Kilometer 2, Iyin Road, Ado-Ekiti, Ekiti State</div>
          <div class="tag">Official correspondence</div>
        </div>
        <div class="header-crest" style="visibility:hidden">
          <img src="${esc(logoSrc)}" alt="" width="68" height="68" />
        </div>
      </header>

      <div class="title-row">
        <div class="title-block">
          <h1>Camp Exit / Temporary Release Letter</h1>
          <div class="ref">Ref: EXIT/${esc(
            data.callUpNumber
          )}/${esc(String(new Date(data.approvedAt || Date.now()).getFullYear()))}</div>
        </div>
        <div class="date-line"><strong>Date:</strong> ${esc(date)}</div>
      </div>

      <section class="identity">
        ${photoBlock}
        <table class="meta-table">
          <tr><td class="lbl">Full name</td><td class="val">${esc(
            data.fullName
          )}</td></tr>
          <tr><td class="lbl">Call-up number</td><td class="val">${esc(
            data.callUpNumber
          )}</td></tr>
          ${
            data.stateCode
              ? `<tr><td class="lbl">State code</td><td class="val">${esc(
                  data.stateCode
                )}</td></tr>`
              : ""
          }
          ${
            data.platoonCode
              ? `<tr><td class="lbl">Platoon</td><td class="val">${esc(
                  data.platoonCode
                )}</td></tr>`
              : ""
          }
          ${
            data.gender
              ? `<tr><td class="lbl">Gender</td><td class="val">${esc(
                  data.gender
                )}</td></tr>`
              : ""
          }
          ${
            data.institution
              ? `<tr><td class="lbl">Institution</td><td class="val">${esc(
                  data.institution
                )}</td></tr>`
              : ""
          }
          ${
            data.course
              ? `<tr><td class="lbl">Course</td><td class="val">${esc(
                  data.course
                )}</td></tr>`
              : ""
          }
          ${
            data.exitGround
              ? `<tr><td class="lbl">Exit ground</td><td class="val">${esc(
                  data.exitGround
                )}</td></tr>`
              : ""
          }
          ${
            dest
              ? `<tr><td class="lbl">Destination</td><td class="val">${esc(
                  dest
                )}</td></tr>`
              : ""
          }
          ${returnLine}
        </table>
      </section>

      <div class="body">
        <p>
          By the authority of the <strong>National Youth Service Corps, Ekiti State Secretariat</strong>,
          the corps member named above is hereby granted <strong>approved camp exit</strong>
          ${data.exitReason ? ` on the stated grounds (${esc(data.exitReason)}).` : "."}
        </p>
        <p>
          This letter is issued in the format of official NYSC mobilisation correspondence and should be
          presented to Security at the orientation camp gate and to any requesting authority.
        </p>
        <p>
          The member remains bound by the NYSC Act (Cap N84, Laws of the Federation of Nigeria, 2004)
          and all camp regulations for the duration of the exit.
        </p>
      </div>

      <div class="notice">
        Security and any other officer may verify this document against the NYSC Ekiti Digital Platform
        record for call-up <span class="code">${esc(data.callUpNumber)}</span>
        ${data.approvedAt ? ` (granted ${esc(fmtShortDate(data.approvedAt))})` : ""}.
      </div>

      <div class="sign-block">
        <div class="sign-card">
          ${signatureImg}
          <div class="sign-name">${esc(signerName)}</div>
          ${signerRank ? `<div class="sign-rank">${esc(signerRank)}</div>` : ""}
          <div class="sign-title">${esc(signerTitle)}</div>
          <div class="sign-rule">Authorised signature</div>
        </div>
      </div>

      <footer class="footer">
        Generated by NYSC Ekiti Digital Platform · ${esc(data.callUpNumber)} · ${esc(date)}
        · Only the State Coordinator signature is valid on this letter
      </footer>
    </div>
  </div>
</body>
</html>`;
}

export type CoordinatorSigner = {
  name: string | null;
  rank: string | null;
  post: string | null;
  signatureUrl: string | null;
};

/**
 * Open print window. Optionally pass photographUrl + signer fields.
 * If signature/signer missing, loads from /api/letters/state-coordinator
 * using staff (nysc_access_token) or CM (nysc_cm_token) Bearer.
 */
export async function openExitLetterPrint(
  data: ExitLetterData
): Promise<boolean> {
  const logoUrl =
    data.logoUrl ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/nysc-logo.png`
      : "/nysc-logo.png");

  let merged: ExitLetterData = { ...data, logoUrl };

  if (!merged.signatureUrl || !merged.signerName) {
    try {
      const headers: HeadersInit = {};
      if (typeof window !== "undefined") {
        const staff = localStorage.getItem("nysc_access_token");
        const cm = localStorage.getItem("nysc_cm_token");
        if (staff) headers.Authorization = `Bearer ${staff}`;
        else if (cm) headers.Authorization = `Bearer ${cm}`;
      }
      const res = await fetch("/api/letters/state-coordinator", {
        headers,
        credentials: "include",
      });
      if (res.ok) {
        const json = (await res.json()) as { signer?: CoordinatorSigner };
        const s = json.signer;
        if (s) {
          merged = {
            ...merged,
            signatureUrl: merged.signatureUrl || s.signatureUrl,
            signerName: merged.signerName || s.name,
            signerRank: merged.signerRank || s.rank,
            signerPost: merged.signerPost || s.post,
            signerTitle:
              merged.signerTitle ||
              (s.post
                ? s.post
                : "State Coordinator, NYSC Ekiti State"),
          };
        }
      }
    } catch {
      /* still print without signature image */
    }
  }

  const html = buildExitLetterHtml(merged);
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
