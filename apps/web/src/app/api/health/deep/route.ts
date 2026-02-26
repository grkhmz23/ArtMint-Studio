import { NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

/**
 * GET /api/health/deep
 *
 * Deeper health endpoint intended for pre-launch validation and ops checks.
 * Includes additional diagnostic details such as verified schema tables and
 * RPC endpoint health metadata.
 */
export async function GET() {
  const { payload, statusCode } = await runHealthChecks({ deep: true });
  return NextResponse.json(
    payload,
    {
      status: statusCode,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    }
  );
}
