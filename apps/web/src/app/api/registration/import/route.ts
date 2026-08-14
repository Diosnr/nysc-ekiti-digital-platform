import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { mapRowFields } from "@/lib/csv";

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

      if (existing) {
        const data: Record<string, string | null | undefined> = {};
        const fill = (key: string, val: string) => {
          if (!val) return;
          const cur = (existing as Record<string, unknown>)[key];
          if (cur == null || cur === "") data[key] = val;
        };
        fill("fullName", mapped.fullName);
        fill("phone", mapped.phone);
        fill("email", mapped.email);
        fill("gender", mapped.gender);
        fill("institution", mapped.institution);
        fill("course", mapped.course);
        fill("deploymentState", mapped.deploymentState);
        fill("batchYear", mapped.batchYear);
        fill("lgaCode", mapped.lgaCode);
        fill("zoneCode", mapped.zoneCode);

        if (mapped.stateCode) data.stateCode = mapped.stateCode;
        if (mapped.ppaName) data.ppaName = mapped.ppaName;
        if (mapped.ppaAddress) data.ppaAddress = mapped.ppaAddress;
        if (mapped.lgiName) data.lgiName = mapped.lgiName;
        if (mapped.lgiPhone) data.lgiPhone = mapped.lgiPhone;
        if (mapped.ziName) data.ziName = mapped.ziName;
        if (mapped.ziPhone) data.ziPhone = mapped.ziPhone;

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
            batchYear: mapped.batchYear || null,
            lgaCode: mapped.lgaCode || null,
            zoneCode: mapped.zoneCode || null,
            status: "VERIFIED",
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
