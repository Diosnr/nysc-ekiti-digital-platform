import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth(req, "platoon:attendance");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await req.json();
  const present = body.present !== false;
  const note = body.note ? String(body.note).trim() : null;
  const dateStr = body.date
    ? String(body.date).slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const date = new Date(dateStr + "T12:00:00.000Z");

  const pcm = await prisma.pcm.findUnique({ where: { id } });
  if (!pcm) return jsonError("Not found", 404);

  const actor = await prisma.user.findUnique({
    where: { id: auth.payload.sub },
    select: { name: true, email: true },
  });
  const actorName = actor?.name?.trim() || actor?.email || auth.payload.email;

  const row = await prisma.platoonAttendance.upsert({
    where: { pcmId_date: { pcmId: id, date } },
    create: {
      pcmId: id,
      date,
      present,
      recordedById: auth.payload.sub,
      recordedByName: actorName,
      note,
    },
    update: {
      present,
      recordedById: auth.payload.sub,
      recordedByName: actorName,
      note,
    },
  });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "pcm.platoon.attendance",
    entityType: "PlatoonAttendance",
    entityId: row.id,
    pcmId: id,
    after: { date: dateStr, present, recordedByName: actorName },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ attendance: row });
}
