/**
 * Quick sanity check against the known NYSC verify page structure.
 * Run: npx tsx packages/verification/src/parse.test.ts
 */
import { parseNyscVerifyHtml } from "./index";

const sample = `
<html><body>
National Youth Service Corps - Call-Up Letter Authentication
This call-up letter has been authenticated.
Verified
Personal Information
Full Name
Okenwa Chinyere Maryjane
Call-Up Number
NYSC/EST/2026/256817
Gender
Female
Institution
Enugu St. Univ. of Sci. and Tech
Deployment Details
State of Deployment
Ekiti
Camp Address
NYSC PERM. ORIENT. CAMP ISE-ORUN/EMURE  LGA, EKITI STATE
Date Reporting
05 Aug 2026
Batch / Year
Batch B / 2026
</body></html>
`;

const parsed = parseNyscVerifyHtml(sample);
const checks: [string, string][] = [
  ["fullName", "Okenwa Chinyere Maryjane"],
  ["callUpNumber", "NYSC/EST/2026/256817"],
  ["gender", "Female"],
  ["institution", "Enugu St. Univ. of Sci. and Tech"],
  ["deploymentState", "Ekiti"],
  ["batchYear", "Batch B / 2026"],
];

let ok = true;
for (const [k, v] of checks) {
  if (parsed[k] !== v) {
    console.error(`FAIL ${k}: got`, parsed[k]);
    ok = false;
  }
}
if (ok) console.log("parseNyscVerifyHtml OK", parsed);
else process.exit(1);
