import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { mapRowFields } from "@/lib/csv";

function parseDob(raw: string): Date | null {
  if (!raw) return null;
  // dd/mm/yyyy or d/m/yyyy
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]) - 1;
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, mo, d));
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t);
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, "registration:complete");
  if (auth instanceof Response) return auth;

  const body = await req.json();
  const rawRows: Record<string, string>[] = Array.isArray(body.rows) ? body.rows : [];
  if (!rawRows.length) return jsonError("rows required");
  if (rawRows.length > 500) return jsonError("Max 500 rows per chunk");

  const actor = await prisma.user.findUnique({
    where: { id: auth.payload.sub },
    select: { name: true, email: true },
  });
  const actorName = actor?.name?.trim() || actor?.email || auth.payload.email;

  let jobId = body.jobId ? String(body.jobId) : null;
  if (!jobId) {
    const job = await prisma.registrationImportJob.create({
      data: {
        startedById: auth.payload.sub,
        startedByName: actorName,
        fileName: body.fileName ? String(body.fileName) : null,
        totalRows: body.totalRows ? Number(body.totalRows) : 0,
        status: "RUNNING",
      },
    });
    jobId = job.id;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { row: number; callUp?: string; error: string }[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const mapped = mapRowFields(rawRows[i]);
    const callUp = mapped.callUpNumber?.toUpperCase();
    if (!callUp) {
      skipped++;
      errors.push({ row: i, error: "Missing callUpNumber" });
      continue;
    }

    try {
      const existing = await prisma.pcm.findUnique({
        where: { callUpNumber: callUp },
      });

      const dob = parseDob(mapped.dateOfBirth || "");
      const noteBits: string[] = [];
      if (mapped.maritalStatus) noteBits.push(`Marital: ${mapped.maritalStatus}`);
      if (mapped.qualification) noteBits.push(`Qual: ${mapped.qualification}`);
      if (mapped.cds) noteBits.push(`CDS: ${mapped.cds}`);
      if (mapped.idCardVerifyUrl) noteBits.push(`ID card: ${mapped.idCardVerifyUrl}`);
      if (mapped.permanentAddress) noteBits.push(`Perm addr: ${mapped.permanentAddress}`);

      if (existing) {
        const data: Record<string, unknown> = {};
        const fillStr = (key: string, val: string) => {
          if (!val) return;
          const cur = (existing as Record<string, unknown>)[key];
          if (cur == null || cur === "") data[key] = val;
        };

        fillStr("fullName", mapped.fullName);
        fillStr("phone", mapped.phone);
        fillStr("email", mapped.email);
        fillStr("gender", mapped.gender);
        fillStr("institution", mapped.institution);
        fillStr("course", mapped.course);
        fillStr("deploymentState", mapped.deploymentState);
        fillStr("batchYear", mapped.batchYear);
        fillStr("lgaCode", mapped.lgaCode);
        fillStr("zoneCode", mapped.zoneCode);
        fillStr("campAddress", mapped.campAddress);
        fillStr("stream", mapped.stream);
        fillStr("originState", mapped.originState);
        fillStr("photographUrl", mapped.photographUrl);

        // Always refresh operational codes from official export when present
        if (mapped.stateCode) data.stateCode = mapped.stateCode;
        if (mapped.platoonCode) {
          data.platoonCode = mapped.platoonCode;
          if (!existing.platoonAssignedAt) {
            data.platoonAssignedAt = new Date();
            data.platoonAssignedByName = `Import · ${actorName}`;
          }
        }
        if (mapped.ppaName) data.ppaName = mapped.ppaName;
        if (mapped.ppaAddress) data.ppaAddress = mapped.ppaAddress;
        if (mapped.lgiName) data.lgiName = mapped.lgiName;
        if (mapped.lgiPhone) data.lgiPhone = mapped.lgiPhone;
        if (mapped.ziName) data.ziName = mapped.ziName;
        if (mapped.ziPhone) data.ziPhone = mapped.ziPhone;
        if (dob && !existing.dateOfBirth) data.dateOfBirth = dob;
        if (noteBits.length && !existing.notes) data.notes = noteBits.join(" | ");

        if (Object.keys(data).length) {
          await prisma.pcm.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          skipped++;
        }
      } else {
        if (!mapped.fullName) {
          skipped++;
          errors.push({ row: i, callUp, error: "fullName required to create" });
          continue;
        }
        await prisma.pcm.create({
          data: {
            callUpNumber: callUp,
            fullName: mapped.fullName,
            stateCode: mapped.stateCode || null,
            platoonCode: mapped.platoonCode || null,
            platoonAssignedAt: mapped.platoonCode ? new Date() : null,
            platoonAssignedByName: mapped.platoonCode ? `Import · ${actorName}` : null,
            ppaName: mapped.ppaName || null,
            ppaAddress: mapped.ppaAddress || null,
            lgiName: mapped.lgiName || null,
            lgiPhone: mapped.lgiPhone || null,
            ziName: mapped.ziName || null,
            ziPhone: mapped.ziPhone || null,
            phone: mapped.phone || null,
            email: mapped.email || null,
            gender: mapped.gender || null,
            institution: mapped.institution || null,
            course: mapped.course || null,
            deploymentState: mapped.deploymentState || null,
            originState: mapped.originState || null,
            campAddress: mapped.campAddress || null,
            stream: mapped.stream || null,
            batchYear: mapped.batchYear || null,
            lgaCode: mapped.lgaCode || null,
            zoneCode: mapped.zoneCode || null,
            photographUrl: mapped.photographUrl || null,
            dateOfBirth: dob,
            notes: noteBits.length ? noteBits.join(" | ") : null,
            status: mapped.platoonCode ? "PLATOON_ASSIGNED" : "VERIFIED",
            createdById: auth.payload.sub,
          },
        });
        created++;
      }
    } catch (e) {
      skipped++;
      errors.push({
        row: i,
        callUp,
        error: e instanceof Error ? e.message : "Row failed",
      });
    }
  }

  const done = Boolean(body.done);
  const job = await prisma.registrationImportJob.update({
    where: { id: jobId! },
    data: {
      processed: { increment: rawRows.length },
      createdCount: { increment: created },
      updatedCount: { increment: updated },
      skippedCount: { increment: skipped },
      errorCount: { increment: errors.length },
      errorSample: errors.length ? JSON.stringify(errors.slice(0, 20)) : undefined,
      status: done ? "COMPLETED" : "RUNNING",
      totalRows: body.totalRows ? Number(body.totalRows) : undefined,
    },
  });

  if (done) {
    const meta = clientMeta(req);
    await writeAudit({
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      actorRoleAtTime: auth.payload.roles.join(","),
      action: "registration.bulk_import",
      entityType: "RegistrationImportJob",
      entityId: jobId!,
      after: {
        created: job.createdCount,
        updated: job.updatedCount,
        processed: job.processed,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  return jsonOk({
    jobId,
    chunk: { created, updated, skipped, errors: errors.slice(0, 15) },
    job: {
      processed: job.processed,
      createdCount: job.createdCount,
      updatedCount: job.updatedCount,
      skippedCount: job.skippedCount,
      errorCount: job.errorCount,
      status: job.status,
    },
  });
}
