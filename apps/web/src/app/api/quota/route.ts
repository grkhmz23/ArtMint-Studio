import { NextRequest, NextResponse } from "next/server";
import { getSessionWallet } from "@/lib/auth";
import { getQuotaInfo } from "@/lib/quota";

/**
 * GET /api/quota
 * Returns remaining AI generation quota for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const wallet = await getSessionWallet(req);
  if (!wallet) {
    return NextResponse.json({ authenticated: false, remaining: 0, limit: 0 });
  }

  const info = await getQuotaInfo(wallet, "ai_variation");
  return NextResponse.json({
    authenticated: true,
    ...info,
  });
}
