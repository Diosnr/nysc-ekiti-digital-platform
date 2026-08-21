/** Build half-A4 style camp exit / redeployment letter HTML (print → PDF). */

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
  approvedByName?: string | null;
  /** Absolute URL to NYSC crest (optional; defaults to site /nysc-logo.png). */
  logoUrl?: string | null;
};

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildExitLetterHtml(data: ExitLetterData): string {
  const date =
    data.approvedAt
      ? new Date(data.approvedAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

  const returnLine = data.expectedReturnAt
    ? `<p><strong>Expected return:</strong> ${esc(
        new Date(data.expectedReturnAt).toLocaleDateString("en-GB")
      )}</p>`
    : "";

  const logo =
    data.logoUrl && data.logoUrl.length > 0
      ? `<img src="${esc(data.logoUrl)}" alt="NYSC" width="64" height="64" style="display:block;margin:0 auto 8px;object-fit:contain" />`
      : `<div class="logo">NYSC</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Camp Exit Letter — ${esc(data.fullName)}</title>
  <style>
    @page { size: A5 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 11pt;
      color: #111;
      margin: 0;
      padding: 0;
    }
    .sheet {
      width: 148mm;
      min-height: 210mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 10mm 12mm;
      border: 1px solid #ccc;
      position: relative;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #006400;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .logo {
      width: 56px;
      height: 56px;
      margin: 0 auto 6px;
      border-radius: 50%;
      background: #000;
      color: #C9A227;
      font-weight: 700;
      font-size: 11px;
      line-height: 56px;
      letter-spacing: 0.5px;
    }
    .org { font-size: 13pt; font-weight: 700; color: #006400; text-transform: uppercase; }
    .sub { font-size: 9pt; color: #333; }
    h1 {
      font-size: 12pt;
      text-align: center;
      text-decoration: underline;
      margin: 14px 0 12px;
      text-transform: uppercase;
    }
    .meta { margin: 8px 0; line-height: 1.45; }
    .meta p { margin: 3px 0; }
    .body { margin-top: 12px; line-height: 1.5; text-align: justify; }
    .stamp {
      margin-top: 28px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .stamp-box {
      width: 42%;
      text-align: center;
    }
    .seal {
      width: 72px;
      height: 72px;
      margin: 0 auto 6px;
      border: 2px solid #006400;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8pt;
      color: #006400;
      font-weight: 700;
      text-transform: uppercase;
      transform: rotate(-12deg);
      opacity: 0.85;
    }
    .sign-line { border-top: 1px solid #333; margin-top: 36px; padding-top: 4px; font-size: 9pt; }
    .footer {
      margin-top: 18px;
      font-size: 8pt;
      color: #555;
      text-align: center;
      border-top: 1px solid #ddd;
      padding-top: 6px;
    }
    @media print {
      body { background: #fff; }
      .sheet { border: none; width: auto; min-height: auto; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;padding:12px;font-family:system-ui,sans-serif">
    <button onclick="window.print()" style="padding:8px 16px;background:#006400;color:#fff;border:0;border-radius:6px;font-weight:600;cursor:pointer">
      Print / Save as PDF
    </button>
  </div>
  <div class="sheet">
    <div class="header">
      ${logo}
      <div class="org">National Youth Service Corps</div>
      <div class="sub">Ekiti State Secretariat</div>
      <div class="sub">Kilometer 2, Iyin Road, Ado-Ekiti, Ekiti State</div>
    </div>
    <h1>Camp Exit / Temporary Release Letter</h1>
    <p style="text-align:right;margin:0 0 8px"><strong>Date:</strong> ${esc(date)}</p>
    <div class="meta">
      <p><strong>Name:</strong> ${esc(data.fullName)}</p>
      <p><strong>Call-up number:</strong> ${esc(data.callUpNumber)}</p>
      ${data.stateCode ? `<p><strong>State code:</strong> ${esc(data.stateCode)}</p>` : ""}
      ${data.platoonCode ? `<p><strong>Platoon:</strong> ${esc(data.platoonCode)}</p>` : ""}
      ${data.institution ? `<p><strong>Institution:</strong> ${esc(data.institution)}</p>` : ""}
      ${data.course ? `<p><strong>Course:</strong> ${esc(data.course)}</p>` : ""}
      ${data.exitGround ? `<p><strong>Ground:</strong> ${esc(data.exitGround)}</p>` : ""}
      ${data.exitDestinationState || data.exitDestinationLga
        ? `<p><strong>Destination:</strong> ${esc(
            [data.exitDestinationLga, data.exitDestinationState].filter(Boolean).join(", ")
          )}</p>`
        : ""}
      ${returnLine}
    </div>
    <div class="body">
      <p>
        By the authority of the NYSC Ekiti State Secretariat, the corps member named above is
        hereby granted <strong>approved camp exit</strong>
        ${data.exitReason ? ` on the stated grounds (${esc(data.exitReason)}).` : "."}
      </p>
      <p>
        This letter is issued in the format of official NYSC mobilisation correspondence and should
        be presented to Security at the camp gate and to any requesting authority.
      </p>
      <p>
        The member remains bound by the NYSC Act and camp regulations for the duration of the exit.
      </p>
    </div>
    <div class="stamp">
      <div class="stamp-box">
        <div class="sign-line">Platoon Officer</div>
      </div>
      <div class="stamp-box">
        <div class="seal">Official<br/>Stamp</div>
        <div class="sign-line">${esc(data.approvedByName || "Camp / State Authority")}</div>
      </div>
    </div>
    <div class="footer">
      Generated by NYSC Ekiti Digital Platform · ${esc(data.callUpNumber)} · ${esc(date)}
    </div>
  </div>
</body>
</html>`;
}

export function openExitLetterPrint(data: ExitLetterData) {
  const logoUrl =
    data.logoUrl ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/nysc-logo.png`
      : "/nysc-logo.png");
  const html = buildExitLetterHtml({ ...data, logoUrl });
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
