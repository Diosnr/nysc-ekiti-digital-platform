import { prisma } from "./db";

type AuditInput = {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRoleAtTime?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  pcmId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
};

export async function writeAudit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? undefined,
      actorEmail: input.actorEmail ?? undefined,
      actorRoleAtTime: input.actorRoleAtTime ?? undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      pcmId: input.pcmId,
      beforeJson: input.before != null ? JSON.stringify(input.before) : undefined,
      afterJson: input.after != null ? JSON.stringify(input.after) : undefined,
      ip: input.ip ?? undefined,
      userAgent: input.userAgent ?? undefined,
      sessionId: input.sessionId ?? undefined,
    },
  });
}
