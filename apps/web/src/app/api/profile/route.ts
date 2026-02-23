import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/profile - Get current user's profile
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    let profile = await prisma.userProfile.findUnique({
      where: { wallet },
    });

    // Create default profile if doesn't exist
    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          wallet,
          username: null,
          displayName: null,
        },
      });
    }

    return NextResponse.json({ profile });
  } catch (err) {
    console.error("Profile GET error:", err);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}

// PATCH /api/profile - Update current user's profile
const updateSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional().nullable(),
  displayName: z.string().min(1).max(50).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  website: z.string().url().max(200).optional().nullable(),
  twitter: z.string().regex(/^[a-zA-Z0-9_]{0,15}$/).optional().nullable(),
  discord: z.string().max(50).optional().nullable(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
});

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Check username uniqueness if provided
    if (parsed.data.username) {
      const existing = await prisma.userProfile.findFirst({
        where: {
          username: parsed.data.username,
          wallet: { not: wallet },
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Username already taken" },
          { status: 409 }
        );
      }
    }

    const profile = await prisma.userProfile.upsert({
      where: { wallet },
      update: parsed.data,
      create: {
        wallet,
        ...parsed.data,
      },
    });

    return NextResponse.json({ profile });
  } catch (err) {
    console.error("Profile PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
