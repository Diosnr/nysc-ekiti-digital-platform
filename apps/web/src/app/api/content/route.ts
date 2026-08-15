import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { uploadDataUriToCloudinary } from "@/lib/cloudinary";

function canManageContent(roles: string[], permissions: string[]) {
  if (permissions.includes("*") || permissions.includes("news:manage") || permissions.includes("announcement:manage"))
    return true;
  return roles.some(
    (r) =>
      r.toLowerCase() === "pro" ||
      r.toLowerCase().includes("public relations") ||
      r.toLowerCase() === "super admin"
  );
}

/** List published items for public site (no auth). type=news|announcement */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "news").toLowerCase();
  const all = url.searchParams.get("all") === "1"; // staff list

  if (all) {
    const auth = await requireAuth(req);
    if (auth instanceof Response) return auth;
    if (!canManageContent(auth.payload.roles, auth.payload.permissions)) {
      return jsonError("Forbidden", 403);
    }
    if (type === "announcement") {
      const items = await prisma.announcement.findMany({
        orderBy: { publishedAt: "desc" },
        take: 50,
      });
      return jsonOk({ items });
    }
    const items = await prisma.newsArticle.findMany({
      orderBy: { publishedAt: "desc" },
      take: 50,
    });
    return jsonOk({ items });
  }

  if (type === "announcement") {
    const items = await prisma.announcement.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      take: 30,
    });
    return jsonOk({ items });
  }

  const items = await prisma.newsArticle.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });
  return jsonOk({ items });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!canManageContent(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const body = await req.json();
  const type = String(body.type || "news").toLowerCase();
  const title = String(body.title || "").trim();
  const text = String(body.body || body.excerpt || "").trim();
  const excerpt = body.excerpt ? String(body.excerpt).trim() : text.slice(0, 200);
  if (!title || !text) return jsonError("title and body are required");

  let imageUrl: string | null = body.imageUrl ? String(body.imageUrl).trim() : null;
  if (imageUrl && !/res\.cloudinary\.com/i.test(imageUrl)) {
    const uploaded = await uploadDataUriToCloudinary(imageUrl, `content_${type}`);
    imageUrl = uploaded;
  }

  const actor = await prisma.user.findUnique({
    where: { id: auth.payload.sub },
    select: { name: true, email: true },
  });
  const authorName = actor?.name?.trim() || actor?.email || auth.payload.email;

  let item;
  if (type === "announcement") {
    item = await prisma.announcement.create({
      data: {
        title,
        body: text,
        imageUrl,
        published: body.published !== false,
        authorId: auth.payload.sub,
        authorName,
      },
    });
  } else {
    item = await prisma.newsArticle.create({
      data: {
        title,
        excerpt,
        body: text,
        imageUrl,
        published: body.published !== false,
        authorId: auth.payload.sub,
        authorName,
      },
    });
  }

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: type === "announcement" ? "announcement.create" : "news.create",
    entityType: type === "announcement" ? "Announcement" : "NewsArticle",
    entityId: item.id,
    after: { title, hasImage: Boolean(imageUrl) },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ item }, 201);
}

export async function DELETE(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!canManageContent(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const type = (url.searchParams.get("type") || "news").toLowerCase();
  if (!id) return jsonError("id required");

  if (type === "announcement") {
    await prisma.announcement.delete({ where: { id } });
  } else {
    await prisma.newsArticle.delete({ where: { id } });
  }
  return jsonOk({ deleted: true });
}
