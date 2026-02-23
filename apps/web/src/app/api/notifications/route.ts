import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/notifications - Get user's notifications
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: any = { recipientWallet: wallet };
    if (unreadOnly) where.read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          mint: {
            select: {
              title: true,
              imageUrl: true,
            },
          },
        },
      }),
      prisma.notification.count({ where: { recipientWallet: wallet } }),
      prisma.notification.count({
        where: { recipientWallet: wallet, read: false },
      }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data ? JSON.parse(n.data) : null,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
        mintAddress: n.mintAddress,
        mint: n.mint,
      })),
      pagination: {
        total,
        unreadCount,
        limit,
        offset,
      },
    });
  } catch (err) {
    console.error("Notifications GET error:", err);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications - Mark notifications as read
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    const body = await req.json();
    const { ids, markAll } = body;

    if (markAll) {
      // Mark all as read
      await prisma.notification.updateMany({
        where: { recipientWallet: wallet, read: false },
        data: { read: true },
      });
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
      // Mark specific notifications as read
      await prisma.notification.updateMany({
        where: {
          id: { in: ids },
          recipientWallet: wallet,
        },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Notifications PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications - Delete notifications
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    const { searchParams } = new URL(req.url);
    const deleteAll = searchParams.get("all") === "true";

    if (deleteAll) {
      await prisma.notification.deleteMany({
        where: { recipientWallet: wallet },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Notifications DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete notifications" },
      { status: 500 }
    );
  }
}
