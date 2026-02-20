import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clearSessionCookie } from "@/lib/auth";

/**
 * POST /api/auth/logout
 * Clears the session cookie and deletes the DB session.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get("artmint_session")?.value;

  if (token) {
    try {
      await prisma.session.delete({ where: { token } });
    } catch {
      // Session may already be deleted
    }
  }

  const res = NextResponse.json({ success: true });
  clearSessionCookie(res);
  return res;
}
