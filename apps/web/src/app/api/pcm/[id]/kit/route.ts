import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export type KitLine = {
  name: string;
  size?: string | null;
  qty?: number;
};

const DEFAULT_KIT: KitLine[] = [
  { name: "Khaki uniform", size: null, qty: 1 },
  { name: "White vest", size: null, qty: 1 },
  { name: "Jungle boots", size: null, qty: 1 },
  { name: "Cap / beret", size: null, qty: 1 },
  { name: "Belt", size: null, qty: 1 },
  { name: "NYSC ID card holder", size: null, qty: 1 },
];

function canIssueKit(roles: string[], permissions: string[]) {
  if (permissions.includes("*") || permissions.includes("kit:issue")) return true;
  return roles.some((r) => r.toLowerCase().includes("platoon"));
}

function isSuper(roles: string[], permissions: string[]) {
  return (
    permissions.includes("*") ||
    roles.some((r) => r.toLowerCase() === "super admin")
  );
}

function parseKitPayload(raw: unknown): {
  items: KitLine[];
  history: Array<{
    at: string;
    by: string;
    items: KitLine[];
    note?: string;
  }>;
} {
  if (!raw || typeof raw !== "string") return { items: [], history: [] };
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) {
      // Legacy: string[]
      return {
        items: v.map((x) =>
          typeof x === "string"
            ? { name: x, size: null, qty: 1 }
            : {
                name: String(x?.name ?? ""),
                size: x?.size ? String(x.size) : null,
                qty: Number(x?.qty) || 1,
              }
        ),
        history: [],
      };
    }
    if (v && typeof v === "object") {
      const items = Array.isArray(v.items)
        ? v.items.map((x: { name?: string; size?: string; qty?: number } | string) =>
            typeof x === "string"
              ? { name: x, size: null, qty: 1 }
              : {
                  name: String(x?.name ?? ""),
                  size: x?.size ? String(x.size) : null,
                  qty: Number(x?.qty) || 1,
                }
          )
        : [];
      const history = Array.isArray(v.history) ? v.history : [];
      return { items, history };
    }
  } catch {
    /* ignore */
  }
  return { items: [], history: [] };
}

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!canIssueKit(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;
  const pcm = await prisma.pcm.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      callUpNumber: true,
      stateCode: true,
      platoonCode: true,
      platoonAssignedAt: true,
      kitIssuedAt: true,
      kitIssuedByName: true,
      kitItemsJson: true,
      status: true,
      gender: true,
      photographUrl: true,
    },
  });
  if (!pcm) return jsonError("Not found", 404);

  const parsed = parseKitPayload(pcm.kitItemsJson);
  return jsonOk({
    pcm: {
      ...pcm,
      kitItems: parsed.items,
      kitHistory: parsed.history,
      kitComplete: Boolean(pcm.kitIssuedAt),
    },
    defaultItems: DEFAULT_KIT,
  });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  if (!canIssueKit(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const force = Boolean(body.force);
  const note = body.note ? String(body.note).trim() : undefined;

  let items: KitLine[] = [];
  if (Array.isArray(body.items) && body.items.length) {
    items = body.items
      .map((x: { name?: string; size?: string; qty?: number } | string) =>
        typeof x === "string"
          ? { name: x, size: null, qty: 1 }
          : {
              name: String(x?.name ?? "").trim(),
              size: x?.size ? String(x.size).trim() : null,
              qty: Number(x?.qty) > 0 ? Number(x.qty) : 1,
            }
      )
      .filter((x: KitLine) => x.name);
  } else {
    items = DEFAULT_KIT;
  }

  if (!items.length) return jsonError("Select at least one kit item");

  const pcm = await prisma.pcm.findUnique({ where: { id } });
  if (!pcm) return jsonError("Not found", 404);

  // Domain rule: kit after platoon assignment (super may force)
  if (!pcm.platoonCode && !isSuper(auth.payload.roles, auth.payload.permissions) && !force) {
    return jsonError(
      "Platoon must be assigned before kit issue. Registration assigns platoon from state code.",
      400
    );
  }

  if (
    (pcm.status === "CHECKED_OUT" || pcm.status === "CAMP_EXITED") &&
    !isSuper(auth.payload.roles, auth.payload.permissions)
  ) {
    return jsonError("Member has left camp — cannot issue kit", 400);
  }

  const actor = await prisma.user.findUnique({
    where: { id: auth.payload.sub },
    select: { name: true, email: true },
  });
  const actorName = actor?.name?.trim() || actor?.email || auth.payload.email;
  const now = new Date();

  const prev = parseKitPayload(pcm.kitItemsJson);
  const history = [
    ...prev.history,
    {
      at: now.toISOString(),
      by: actorName,
      items,
      note: note || (pcm.kitIssuedAt ? "Re-issue / update" : "Initial issue"),
    },
  ].slice(-20);

  const payload = JSON.stringify({ items, history, version: 2 });

  const updated = await prisma.pcm.update({
    where: { id },
    data: {
      kitIssuedAt: now,
      kitIssuedByName: actorName,
      kitItemsJson: payload,
      status:
        pcm.status === "CHECKED_OUT" || pcm.status === "CAMP_EXITED"
          ? pcm.status
          : "KIT_ISSUED",
    },
    select: {
      id: true,
      fullName: true,
      callUpNumber: true,
      stateCode: true,
      platoonCode: true,
      kitIssuedAt: true,
      kitIssuedByName: true,
      kitItemsJson: true,
      status: true,
      photographUrl: true,
    },
  });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: pcm.kitIssuedAt ? "pcm.kit.reissue" : "pcm.kit.issue",
    entityType: "Pcm",
    entityId: id,
    pcmId: id,
    after: { kitIssuedByName: actorName, items, note },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const parsed = parseKitPayload(updated.kitItemsJson);
  return jsonOk({
    pcm: {
      ...updated,
      kitItems: parsed.items,
      kitHistory: parsed.history,
      kitComplete: true,
    },
  });
}

/** Clear kit issue (super / kit:issue only) — rare correction */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const roles = auth.payload.roles;
  const perms = auth.payload.permissions;
  if (!isSuper(roles, perms) && !perms.includes("kit:issue")) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;
  const pcm = await prisma.pcm.findUnique({ where: { id } });
  if (!pcm) return jsonError("Not found", 404);

  const updated = await prisma.pcm.update({
    where: { id },
    data: {
      kitIssuedAt: null,
      kitIssuedByName: null,
      kitItemsJson: null,
      status:
        pcm.platoonCode && pcm.status === "KIT_ISSUED"
          ? "PLATOON_ASSIGNED"
          : pcm.status === "KIT_ISSUED"
            ? "REGISTERED"
            : pcm.status,
    },
  });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "pcm.kit.clear",
    entityType: "Pcm",
    entityId: id,
    pcmId: id,
    before: {
      kitIssuedAt: pcm.kitIssuedAt,
      kitIssuedByName: pcm.kitIssuedByName,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ pcm: updated });
}
