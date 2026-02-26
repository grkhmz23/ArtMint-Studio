import { NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * 
 * Comprehensive health check endpoint for production monitoring.
 * Checks database connectivity, schema/migration health, RPC endpoints,
 * and critical services.
 * 
 * Returns:
 * - 200: All systems healthy
 * - 200 (degraded): Non-critical services unhealthy
 * - 503: Critical services unhealthy
 */
export async function GET() {
  const { payload, statusCode } = await runHealthChecks();
  return NextResponse.json(
    payload,
    { 
      status: statusCode,
      headers: {
        // Prevent caching of health checks
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    }
  );
}
