/** CSV / TSV parse + NYSC registration export field mapping */

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = splitCsvLines(text);
  if (!lines.length) return { headers: [], rows: [] };

  const delim = detectDelimiter(lines[0]);
  const headers = splitDelimitedRow(lines[0], delim).map((h) => normalizeHeader(h));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = splitDelimitedRow(lines[i], delim);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function detectDelimiter(headerLine: string): "," | "\t" {
  const tabs = (headerLine.match(/\t/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function normalizeGender(g: string): string {
  const x = g.trim().toUpperCase();
  if (x === "M" || x === "MALE") return "Male";
  if (x === "F" || x === "FEMALE") return "Female";
  return g.trim();
}

/** Prefer direct image URLs; skip HTML verify pages. */
export function pickPhotoUrl(...candidates: string[]): string {
  for (const c of candidates) {
    const u = (c || "").trim();
    if (!u) continue;
    if (!/^https?:\/\//i.test(u)) continue;
    // NYSC verify pages are not photos
    if (/verify\.aspx/i.test(u) || /CorpMemberVerify/i.test(u)) continue;
    if (
      /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u) ||
      /cloudinary|res\.cloudinary|imgur|googleusercontent|fbcdn|twimg/i.test(u) ||
      /\/photo|\/image|\/picture|\/media\//i.test(u)
    ) {
      return u;
    }
    // Still accept http(s) from PICTURE column if not a known verify page
    if (!/mgt\.nysc\.org\.ng/i.test(u)) return u;
  }
  return "";
}

/** Map NYSC Access export + common aliases → canonical keys */
export function mapRowFields(row: Record<string, string>): Record<string, string> {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = row[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return "";
  };

  const genderRaw = get("gender", "sex");
  const platoonRaw = get("platoon", "platooncode", "platoon_code", "platoon_no");
  let platoonCode = platoonRaw.replace(/\D/g, "");
  if (platoonCode === "0") platoonCode = "10";
  if (platoonCode && !/^(10|[1-9])$/.test(platoonCode)) {
    // take last digit if weird
    const last = platoonCode.slice(-1);
    platoonCode = last === "0" ? "10" : last;
  }

  const photo = pickPhotoUrl(
    get("picture", "photo", "photograph", "photo_url", "photograph_url", "image"),
    get("remark_52", "remark52") // sometimes mis-exported; only if real image URL
  );

  const deployed = get(
    "deployedstate",
    "deploymentstate",
    "deployment_state",
    "state_of_deployment"
  );
  // EK → Ekiti-style pass-through; leave short codes as-is
  const deploymentState = deployed;

  return {
    callUpNumber: get(
      "callup",
      "callupnumber",
      "call_up_number",
      "call_up",
      "callupno",
      "call_up_no"
    ),
    fullName: get("fullname", "name", "corps_member_name", "cm_name"),
    stateCode: get("statecode", "state_code", "scode"),
    gender: genderRaw ? normalizeGender(genderRaw) : "",
    phone: get("phone", "mobile", "gsm"),
    email: get("email", "e_mail"),
    institution: get("institution", "school", "university"),
    course: get("course", "discipline"),
    deploymentState,
    originState: get("state_of_origin", "stateoforigin", "origin_state", "originstate"),
    campAddress: get(
      "orientationcamp",
      "orientation_camp",
      "camp",
      "camp_address",
      "campaddress"
    ),
    stream: get("stream"),
    dateOfBirth: get("dob", "date_of_birth", "dateofbirth"),
    platoonCode,
    permanentAddress: get("permanent_address", "permanentaddress"),
    ppaName: get(
      "ppa_h1",
      "ppah1",
      "ppaname",
      "ppa_name",
      "ppa",
      "company"
    ),
    ppaAddress: get(
      "ppa_h_add",
      "ppahadd",
      "ppaaddress",
      "ppa_address",
      "address"
    ),
    lgaCode: get("lga", "lgacode", "lga_code", "ppa_h_lga", "ppahlga"),
    zoneCode: get("zonecode", "zone_code", "zone", "remark_53", "remark53"),
    batchYear: get("batchyear", "batch_year", "batch"),
    lgiName: get("lginame", "lgi_name", "lgi"),
    lgiPhone: get("lgiphone", "lgi_phone"),
    ziName: get("ziname", "zi_name", "zi", "zonal_inspector"),
    ziPhone: get("ziphone", "zi_phone"),
    photographUrl: photo,
    maritalStatus: get("maritalstatus", "marital_status"),
    qualification: get("qualification", "grade"),
    cds: get("cds"),
    idCardVerifyUrl: get("remark_52", "remark52"),
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

function splitDelimitedRow(line: string, delim: "," | "\t"): string[] {
  if (delim === "\t") {
    return line.split("\t").map((c) => c.replace(/^"|"$/g, "").trim());
  }
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
  "CALLUP,FULLNAME,STATECODE,Gender,PHONE,EMAIL,DeployedState,Institution,Course,OrientationCamp,stream,dob,platoon,Lga,Company,Address,PICTURE\n";
