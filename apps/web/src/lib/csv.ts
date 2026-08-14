/** Minimal CSV parse — handles quotes and commas. No external deps. */

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = splitCsvLines(text);
  if (!lines.length) return { headers: [], rows: [] };

  const headers = splitCsvRow(lines[0]).map((h) => normalizeHeader(h));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = splitCsvRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/** Map common aliases → canonical field keys */
export function mapRowFields(row: Record<string, string>): Record<string, string> {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = row[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return "";
  };

  return {
    callUpNumber: get(
      "callupnumber",
      "call_up_number",
      "callup",
      "call_up",
      "callupno",
      "call_up_no"
    ),
    fullName: get("fullname", "name", "corps_member_name", "cm_name"),
    stateCode: get("statecode", "state_code", "scode"),
    ppaName: get("ppaname", "ppa_name", "ppa"),
    ppaAddress: get("ppaaddress", "ppa_address"),
    lgiName: get("lginame", "lgi_name", "lgi"),
    lgiPhone: get("lgiphone", "lgi_phone"),
    ziName: get("ziname", "zi_name", "zi", "zonal_inspector"),
    ziPhone: get("ziphone", "zi_phone"),
    phone: get("phone", "mobile", "gsm"),
    email: get("email", "e_mail"),
    gender: get("gender", "sex"),
    institution: get("institution", "school", "university"),
    course: get("course", "discipline"),
    deploymentState: get("deploymentstate", "deployment_state", "state_of_deployment"),
    batchYear: get("batchyear", "batch_year", "batch"),
    lgaCode: get("lgacode", "lga_code", "lga"),
    zoneCode: get("zonecode", "zone_code", "zone"),
  };
}

function splitCsvLines(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      cur += c;
      continue;
    }
    if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.length) out.push(cur);
  return out;
}

function splitCsvRow(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (c === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  cells.push(cur);
  return cells;
}

export const REGISTRATION_CSV_TEMPLATE =
  "callUpNumber,fullName,stateCode,ppaName,ppaAddress,lgiName,lgiPhone,ziName,ziPhone,phone,email,gender,institution,course,deploymentState,batchYear,lgaCode,zoneCode\n";
