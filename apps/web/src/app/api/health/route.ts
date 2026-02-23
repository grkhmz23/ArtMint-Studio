import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRpcManager, getConnection } from "@/lib/rpc";

export const dynamic = "force-dynamic";

interface HealthCheck {
  name: string;
  status: "healthy" | "unhealthy" | "degraded";
  responseTimeMs: number;
  details?: Record<string, unknown>;
  error?: string;
}

/**
 * GET /api/health
 * 
 * Comprehensive health check endpoint for production monitoring.
 * Checks database connectivity, RPC endpoints, and critical services.
 * 
 * Returns:
 * - 200: All systems healthy
 * - 200 (degraded): Non-critical services unhealthy
 * - 503: Critical services unhealthy
 */
export async function GET() {
  const startTime = Date.now();
  const checks: HealthCheck[] = [];
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

  // 1. Database Health Check
  const dbCheckStart = Date.now();
  try {
    // Simple query to verify DB connection
    await prisma.$queryRaw`SELECT 1`;
    checks.push({
      name: "database",
      status: "healthy",
      responseTimeMs: Date.now() - dbCheckStart,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    checks.push({
      name: "database",
      status: "unhealthy",
      responseTimeMs: Date.now() - dbCheckStart,
      error,
    });
    overallStatus = "unhealthy";
  }

  // 2. RPC Health Check
  const rpcCheckStart = Date.now();
  try {
    const rpcManager = getRpcManager();
    const connection = getConnection();
    
    // Check current slot to verify RPC is responsive
    const slot = await connection.getSlot();
    const endpoints = rpcManager.getAllEndpoints();
    
    checks.push({
      name: "solana-rpc",
      status: "healthy",
      responseTimeMs: Date.now() - rpcCheckStart,
      details: {
        currentSlot: slot,
        currentEndpoint: rpcManager.getCurrentEndpoint().name,
        endpoints: endpoints.map(e => ({
          name: e.name,
          healthy: e.healthy,
          latencyMs: e.latencyMs,
        })),
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    checks.push({
      name: "solana-rpc",
      status: "unhealthy",
      responseTimeMs: Date.now() - rpcCheckStart,
      error,
    });
    overallStatus = "unhealthy";
  }

  // 3. Environment Configuration Check
  const configCheckStart = Date.now();
  const criticalEnvVars = [
    "SESSION_SECRET",
    "DATABASE_URL",
    "SOLANA_RPC_URL",
  ];
  const missingVars = criticalEnvVars.filter(v => !process.env[v]);
  
  // Check for development-only values in production
  const isProduction = process.env.NODE_ENV === "production";
  const hasDevSecret = process.env.SESSION_SECRET?.includes("dev-secret") || 
                       process.env.SESSION_SECRET?.includes("CHANGE_THIS");
  
  if (missingVars.length > 0) {
    checks.push({
      name: "configuration",
      status: "unhealthy",
      responseTimeMs: Date.now() - configCheckStart,
      error: `Missing required environment variables: ${missingVars.join(", ")}`,
    });
    overallStatus = "unhealthy";
  } else if (isProduction && hasDevSecret) {
    checks.push({
      name: "configuration",
      status: "unhealthy",
      responseTimeMs: Date.now() - configCheckStart,
      error: "SESSION_SECRET is using development value in production",
    });
    overallStatus = "unhealthy";
  } else {
    checks.push({
      name: "configuration",
      status: "healthy",
      responseTimeMs: Date.now() - configCheckStart,
      details: {
        nodeEnv: process.env.NODE_ENV,
        cluster: process.env.SOLANA_CLUSTER,
        storageProvider: process.env.STORAGE_PROVIDER,
      },
    });
  }

  // 4. Storage Health Check
  const storageCheckStart = Date.now();
  const storageProvider = process.env.STORAGE_PROVIDER;
  
  if (storageProvider === "vercel-blob" && !process.env.BLOB_READ_WRITE_TOKEN) {
    checks.push({
      name: "storage",
      status: "unhealthy",
      responseTimeMs: Date.now() - storageCheckStart,
      error: "Vercel Blob token not configured",
    });
    if (isProduction) overallStatus = "unhealthy";
  } else {
    checks.push({
      name: "storage",
      status: "healthy",
      responseTimeMs: Date.now() - storageCheckStart,
      details: {
        provider: storageProvider || "local",
      },
    });
  }

  const totalResponseTime = Date.now() - startTime;

  // Determine HTTP status code
  let statusCode = 200;
  if (overallStatus === "unhealthy") {
    statusCode = 503; // Service Unavailable
  }

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: "artmint-web",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "unknown",
      responseTimeMs: totalResponseTime,
      checks,
    },
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
