import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const saveDraftSchema = z.object({
  type: z.enum(["ai", "code", "manual"]),
  title: z.string().max(200).optional(),
  data: z.record(z.unknown()),
  imageUrl: z.string().max(500_000).optional(), // can be a small data URL
});

/** GET /api/drafts — list user's drafts */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const wallet = authResult;

  const drafts = await prisma.draft.findMany({
    where: { wallet },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    drafts: drafts.map((d) => ({
      id: d.id,
      type: d.type,
      title: d.title,
      imageUrl: d.imageUrl,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
  });
}

/** POST /api/drafts — save a new draft */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const wallet = authResult;

  const body = await req.json();
  const parsed = saveDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { type, title, data, imageUrl } = parsed.data;

  const draft = await prisma.draft.create({
    data: {
      wallet,
      type,
      title: title || null,
      data: JSON.stringify(data),
      imageUrl: imageUrl || null,
    },
  });

  return NextResponse.json({ id: draft.id, success: true });
}

/** DELETE /api/drafts?id=<draftId> — delete a draft */
export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const wallet = authResult;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing draft id" }, { status: 400 });
  }

  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft || draft.wallet !== wallet) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  await prisma.draft.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
