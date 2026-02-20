import { NextRequest, NextResponse } from "next/server";
import { getSessionWallet } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/session
 * Returns the current session wallet if authenticated.
 */
export async function GET(req: NextRequest) {
  const wallet = await getSessionWallet(req);
  if (!wallet) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({ authenticated: true, wallet });
}
