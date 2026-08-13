/**
 * Seed: Super Admin + permission catalog + starter roles with baseline permissions.
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PERMISSIONS: { key: string; description: string; module: string }[] = [
  { key: "user:read", description: "View users", module: "admin" },
  { key: "user:create", description: "Create users/officers", module: "admin" },
  { key: "user:update", description: "Update users", module: "admin" },
  { key: "user:deactivate", description: "Deactivate users", module: "admin" },
  { key: "role:read", description: "View roles", module: "admin" },
  { key: "role:create", description: "Create roles", module: "admin" },
  { key: "role:update", description: "Update roles", module: "admin" },
  { key: "role:assign", description: "Assign roles to users", module: "admin" },
  { key: "permission:manage", description: "Manage permission mappings", module: "admin" },
  { key: "audit:read", description: "View audit logs", module: "admin" },
  { key: "pcm:read", description: "View PCM records", module: "pcm" },
  { key: "pcm:create", description: "Create PCM records", module: "pcm" },
  { key: "pcm:update", description: "Update PCM records", module: "pcm" },
  { key: "pcm:search", description: "Search PCM registry", module: "pcm" },
  { key: "pcm:verify", description: "Run call-up verification / intake", module: "pcm" },
  { key: "pcm:photo:view", description: "View PCM photograph", module: "pcm" },
  { key: "security:checkin", description: "Security check-in / in-out", module: "camp" },
  { key: "camp:address:manage", description: "Create and manage camp addresses", module: "camp" },
  { key: "accommodation:read", description: "View accommodation", module: "camp" },
  { key: "accommodation:assign", description: "Assign accommodation", module: "camp" },
  { key: "accommodation:change", description: "Change accommodation", module: "camp" },
  { key: "hostel:manage", description: "Manage hostels and capacity", module: "camp" },
  { key: "registration:complete", description: "Complete camp registration", module: "camp" },
  { key: "bank:register", description: "Bank/account registration", module: "camp" },
  { key: "bank:update", description: "Update bank registration", module: "camp" },
  { key: "platoon:assign", description: "Assign platoon", module: "camp" },
  { key: "platoon:manage", description: "Manage platoons", module: "camp" },
  { key: "platoon:attendance", description: "Record platoon attendance", module: "camp" },
  { key: "kit:issue", description: "Issue kits", module: "camp" },
  { key: "kit:view", description: "View kit status", module: "camp" },
  { key: "camp:exeat", description: "Camp exeat requests/approvals", module: "camp" },
  { key: "camp:clinic", description: "Camp clinic workflows", module: "camp" },
  { key: "camp:export", description: "Download camp Excel exports", module: "camp" },
  { key: "file:read", description: "View electronic files", module: "files" },
  { key: "file:create", description: "Open / pick a file", module: "files" },
  { key: "file:minute", description: "Add minute sheet", module: "files" },
  { key: "file:forward", description: "Forward file", module: "files" },
  { key: "file:return", description: "Return file", module: "files" },
  { key: "file:reject", description: "Reject file", module: "files" },
  { key: "file:approve", description: "Approve file", module: "files" },
  { key: "file:registry", description: "Registry file tracking", module: "files" },
  { key: "ppa:manage", description: "Manage PPA", module: "service" },
  { key: "relocation:manage", description: "Manage relocation", module: "service" },
  { key: "leave:manage", description: "Manage leave", module: "service" },
  { key: "clearance:manage", description: "Manage clearance", module: "service" },
  { key: "news:manage", description: "Manage news", module: "content" },
  { key: "announcement:manage", description: "Manage announcements", module: "content" },
  { key: "event:manage", description: "Manage events", module: "content" },
  { key: "gallery:manage", description: "Manage gallery", module: "content" },
  { key: "faq:manage", description: "Manage FAQs", module: "content" },
  { key: "resource:manage", description: "Manage resources", module: "content" },
  { key: "report:view", description: "View reports", module: "reports" },
  { key: "report:export", description: "Export reports", module: "reports" },
  { key: "dashboard:view", description: "View operational dashboard", module: "reports" },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  "Security Officer": [
    "dashboard:view",
    "security:checkin",
    "pcm:read",
    "pcm:search",
    "pcm:photo:view",
  ],
  "Registration Officer": [
    "dashboard:view",
    "pcm:read",
    "pcm:search",
    "pcm:create",
    "pcm:verify",
    "pcm:photo:view",
    "registration:complete",
    "camp:export",
  ],
};

async function main() {
  console.log("Seeding permissions…");
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      create: p,
      update: { description: p.description, module: p.module },
    });
  }

  const allPerms = await prisma.permission.findMany();
  const byKey = Object.fromEntries(allPerms.map((p) => [p.key, p.id]));

  const superRole = await prisma.role.upsert({
    where: { name: "Super Admin" },
    create: {
      name: "Super Admin",
      description: "Full system access. Cannot be deleted.",
      isSystem: true,
      isActive: true,
    },
    update: { isSystem: true, isActive: true },
  });

  for (const permissionId of allPerms.map((p) => p.id)) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: superRole.id, permissionId },
      },
      create: { roleId: superRole.id, permissionId },
      update: {},
    });
  }

  const starterRoles = [
    { name: "State Coordinator", description: "State secretariat leadership and terminal approvals" },
    { name: "Camp Director", description: "Camp operational oversight, exeats and approvals" },
    { name: "Security Officer", description: "Camp security check-in and in/out" },
    { name: "Registration Officer", description: "Camp registration committee" },
    { name: "Accommodation Officer", description: "Hostel and bed allocation" },
    { name: "Platoon Officer", description: "Platoon management and attendance" },
    { name: "LGI", description: "Local Government Inspector — LGA-scoped corps data and files" },
    { name: "Zonal Inspector", description: "Zone-scoped corps data and file routing" },
    { name: "Head CIM", description: "Head of Corps Inspection / related approvals" },
    { name: "Registry Officer", description: "Electronic file registry and tracking" },
  ];

  for (const r of starterRoles) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      create: { ...r, isSystem: false, isActive: true },
      update: { description: r.description },
    });
    for (const key of ROLE_PERMISSIONS[r.name] ?? []) {
      const permissionId = byKey[key];
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId },
        },
        create: { roleId: role.id, permissionId },
        update: {},
      });
    }
  }

  // Default Ekiti camp if none exist
  const campCount = await prisma.campAddress.count();
  if (campCount === 0) {
    await prisma.campAddress.create({
      data: {
        name: "NYSC Ekiti Orientation Camp",
        address:
          "NYSC Permanent Orientation Camp, Ise-Orun / Ekiti State (confirm official address with secretariat)",
        state: "Ekiti",
        lga: "Ise/Orun",
        isActive: true,
        sortOrder: 0,
        notes: "Placeholder — Super Admin should update to the official camp address.",
      },
    });
    console.log("Seeded default Ekiti camp address (update via admin UI).");
  }

  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@nysc-ekiti.local";
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMeNow!123";
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Super Admin",
      passwordHash,
      isActive: true,
      activatedAt: new Date(),
    },
    update: { passwordHash, isActive: true },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: admin.id, roleId: superRole.id },
    },
    create: { userId: admin.id, roleId: superRole.id },
    update: {},
  });

  console.log(`Super Admin ready: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
