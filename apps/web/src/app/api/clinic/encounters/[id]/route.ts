import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import {
  hasClinicAccess,
  isClinicDoctor,
  isClinicNurse,
  isClinicPharmacist,
} from "@/lib/clinic-access";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!hasClinicAccess(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden — clinic access only", 403);
  }

  const { id } = await params;
  const encounter = await prisma.clinicEncounter.findUnique({
    where: { id },
    include: {
      pcm: {
        select: {
          id: true,
          fullName: true,
          callUpNumber: true,
          stateCode: true,
          gender: true,
          photographUrl: true,
          status: true,
          dateOfBirth: true,
          institution: true,
        },
      },
      vitals: { orderBy: { recordedAt: "desc" } },
      drugs: { orderBy: { dispensedAt: "desc" } },
    },
  });
  if (!encounter) return jsonError("Not found", 404);

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "clinic.encounter.view",
    entityType: "ClinicEncounter",
    entityId: id,
    pcmId: encounter.pcmId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ encounter });
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!hasClinicAccess(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden — clinic access only", 403);
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "").toLowerCase();

  const encounter = await prisma.clinicEncounter.findUnique({ where: { id } });
  if (!encounter) return jsonError("Not found", 404);

  const actor = await prisma.user.findUnique({
    where: { id: auth.payload.sub },
    select: { name: true, email: true },
  });
  const actorName = actor?.name?.trim() || actor?.email || auth.payload.email;
  const roles = auth.payload.roles;
  const perms = auth.payload.permissions;
  const superA = perms.includes("*") || roles.some((r) => r.toLowerCase() === "super admin");

  // --- Vitals (nurse / head / super) ---
  if (action === "vitals") {
    if (!superA && !isClinicNurse(roles) && !isClinicDoctor(roles)) {
      return jsonError("Only nursing or medical staff may record vitals", 403);
    }
    if (encounter.status === "CLOSED") return jsonError("Encounter is closed", 400);

    const vital = await prisma.clinicVital.create({
      data: {
        encounterId: id,
        recordedById: auth.payload.sub,
        recordedByName: actorName,
        bpSystolic: body.bpSystolic != null ? Number(body.bpSystolic) : null,
        bpDiastolic: body.bpDiastolic != null ? Number(body.bpDiastolic) : null,
        pulse: body.pulse != null ? Number(body.pulse) : null,
        temperatureC:
          body.temperatureC != null ? Number(body.temperatureC) : null,
        respiratoryRate:
          body.respiratoryRate != null ? Number(body.respiratoryRate) : null,
        weightKg: body.weightKg != null ? Number(body.weightKg) : null,
        spo2: body.spo2 != null ? Number(body.spo2) : null,
        note: body.note ? String(body.note).trim() : null,
      },
    });

    if (body.chiefComplaint) {
      await prisma.clinicEncounter.update({
        where: { id },
        data: { chiefComplaint: String(body.chiefComplaint).trim() },
      });
    }

    const meta = clientMeta(req);
    await writeAudit({
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      actorRoleAtTime: roles.join(","),
      action: "clinic.vitals.record",
      entityType: "ClinicVital",
      entityId: vital.id,
      pcmId: encounter.pcmId,
      after: { vitalId: vital.id },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonOk({ vital });
  }

  // --- Doctor attend ---
  if (action === "attend") {
    if (!superA && !isClinicDoctor(roles)) {
      return jsonError("Only doctors / head of clinic may record attendance", 403);
    }
    if (encounter.status === "CLOSED") return jsonError("Encounter is closed", 400);

    const diagnosis = body.diagnosis ? String(body.diagnosis).trim() : null;
    const doctorNote = body.doctorNote ? String(body.doctorNote).trim() : null;

    const updated = await prisma.clinicEncounter.update({
      where: { id },
      data: {
        diagnosis: diagnosis ?? encounter.diagnosis,
        doctorNote: doctorNote ?? encounter.doctorNote,
        attendedByDoctorId: auth.payload.sub,
        attendedByDoctorName: actorName,
        attendedAt: new Date(),
      },
    });

    const meta = clientMeta(req);
    await writeAudit({
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      actorRoleAtTime: roles.join(","),
      action: "clinic.doctor.attend",
      entityType: "ClinicEncounter",
      entityId: id,
      pcmId: encounter.pcmId,
      after: { diagnosis, doctorNote },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonOk({ encounter: updated });
  }

  // --- Pharmacy dispense ---
  if (action === "dispense") {
    if (!superA && !isClinicPharmacist(roles) && !isClinicDoctor(roles)) {
      return jsonError("Only pharmacy or medical staff may dispense drugs", 403);
    }
    if (encounter.status === "CLOSED") return jsonError("Encounter is closed", 400);

    const drugName = String(body.drugName ?? "").trim();
    if (!drugName) return jsonError("drugName required");

    const drug = await prisma.clinicDrugDispense.create({
      data: {
        encounterId: id,
        drugName,
        dose: body.dose ? String(body.dose).trim() : null,
        quantity: body.quantity ? String(body.quantity).trim() : null,
        instructions: body.instructions
          ? String(body.instructions).trim()
          : null,
        dispensedById: auth.payload.sub,
        dispensedByName: actorName,
      },
    });

    const meta = clientMeta(req);
    await writeAudit({
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      actorRoleAtTime: roles.join(","),
      action: "clinic.drug.dispense",
      entityType: "ClinicDrugDispense",
      entityId: drug.id,
      pcmId: encounter.pcmId,
      after: { drugName },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonOk({ drug });
  }

  // --- Close ---
  if (action === "close") {
    if (encounter.status === "CLOSED") return jsonError("Already closed", 400);
    const updated = await prisma.clinicEncounter.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedById: auth.payload.sub,
        closedByName: actorName,
        closedAt: new Date(),
      },
    });

    const meta = clientMeta(req);
    await writeAudit({
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      actorRoleAtTime: roles.join(","),
      action: "clinic.encounter.close",
      entityType: "ClinicEncounter",
      entityId: id,
      pcmId: encounter.pcmId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonOk({ encounter: updated });
  }

  return jsonError("action must be vitals, attend, dispense, or close");
}
