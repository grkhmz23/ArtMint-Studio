import { Prisma, prisma } from "@/lib/db";
import { getConnection, getRpcManager } from "@/lib/rpc";
import { getBlobReadWriteToken } from "./blob";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  responseTimeMs: number;
  details?: Record<string, unknown>;
  error?: string;
}

export interface HealthPayload {
  status: HealthStatus;
  timestamp: string;
  service: string;
  version: string;
  responseTimeMs: number;
  checks: HealthCheck[];
}

export interface HealthRunOptions {
  deep?: boolean;
}

const REQUIRED_SCHEMA_TABLES = [
  "Mint",
  "Listing",
  "Session",
  "Favorite",
  "Auction",
  "Collection",
  "Notification",
] as const;

function worsenStatus(current: HealthStatus, next: HealthStatus): HealthStatus {
  if (current === "unhealthy" || next === "unhealthy") return "unhealthy";
  if (current === "degraded" || next === "degraded") return "degraded";
  return "healthy";
}

function guessDatabaseProvider(url: string | undefined): "postgres" | "sqlite" | "mysql" | "unknown" {
  if (!url) return "unknown";
  const normalized = url.toLowerCase();
  if (normalized.startsWith("postgres://") || normalized.startsWith("postgresql://")) return "postgres";
  if (normalized.startsWith("file:") || normalized.endsWith(".db") || normalized.includes("sqlite")) return "sqlite";
  if (normalized.startsWith("mysql://")) return "mysql";
  return "unknown";
}

async function runSchemaCheck(options: {
  deep: boolean;
  databaseProvider: "postgres" | "sqlite" | "mysql" | "unknown";
  databaseHealthy: boolean;
}): Promise<HealthCheck> {
  const start = Date.now();

  if (!options.databaseHealthy) {
    return {
      name: "schema",
      status: "unhealthy",
      responseTimeMs: Date.now() - start,
      error: "Skipped schema verification because database connectivity check failed",
    };
  }

  if (options.databaseProvider !== "postgres") {
    return {
      name: "schema",
      status: "degraded",
      responseTimeMs: Date.now() - start,
      details: {
        skipped: true,
        reason: "Schema table existence check is implemented for PostgreSQL production databases",
        provider: options.databaseProvider,
      },
    };
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>(
      Prisma.sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (${Prisma.join([...REQUIRED_SCHEMA_TABLES])})
      `
    );

    const found = new Set(rows.map((row) => row.table_name));
    const missingTables = [...REQUIRED_SCHEMA_TABLES].filter((table) => !found.has(table));

    if (missingTables.length > 0) {
      return {
        name: "schema",
        status: "unhealthy",
        responseTimeMs: Date.now() - start,
        error: "Required tables are missing. Run `prisma migrate deploy` on the production database.",
        details: {
          missingTables,
          ...(options.deep ? { requiredTables: [...REQUIRED_SCHEMA_TABLES], foundTables: [...found].sort() } : {}),
        },
      };
    }

    return {
      name: "schema",
      status: "healthy",
      responseTimeMs: Date.now() - start,
      details: options.deep
        ? {
            requiredTables: [...REQUIRED_SCHEMA_TABLES],
            foundTables: [...found].sort(),
          }
        : {
            verifiedTables: REQUIRED_SCHEMA_TABLES.length,
          },
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return {
      name: "schema",
      status: "unhealthy",
      responseTimeMs: Date.now() - start,
      error: `Schema verification failed: ${error}`,
    };
  }
}

export async function runHealthChecks(
  options: HealthRunOptions = {}
): Promise<{ payload: HealthPayload; statusCode: number }> {
  const deep = options.deep ?? false;
  const startTime = Date.now();
  const checks: HealthCheck[] = [];
  let overallStatus: HealthStatus = "healthy";

  const databaseProvider = guessDatabaseProvider(process.env.DATABASE_URL);

  // 1. Database health
  const dbStart = Date.now();
  let databaseHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseHealthy = true;
    checks.push({
      name: "database",
      status: "healthy",
      responseTimeMs: Date.now() - dbStart,
      details: deep ? { provider: databaseProvider } : undefined,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    checks.push({
      name: "database",
      status: "unhealthy",
      responseTimeMs: Date.now() - dbStart,
      error,
      details: deep ? { provider: databaseProvider } : undefined,
    });
    overallStatus = "unhealthy";
  }

  // 2. Schema health (lightweight table existence check to catch missed migrations)
  const schemaCheck = await runSchemaCheck({
    deep,
    databaseProvider,
    databaseHealthy,
  });
  checks.push(schemaCheck);
  overallStatus = worsenStatus(overallStatus, schemaCheck.status);

  // 3. RPC health
  const rpcStart = Date.now();
  try {
    const rpcManager = getRpcManager();
    const connection = getConnection();
    const slot = await connection.getSlot();
    const endpoints = rpcManager.getAllEndpoints();

    checks.push({
      name: "solana-rpc",
      status: "healthy",
      responseTimeMs: Date.now() - rpcStart,
      details: {
        currentSlot: slot,
        currentEndpoint: rpcManager.getCurrentEndpoint().name,
        endpoints: endpoints.map((endpoint) => ({
          name: endpoint.name,
          healthy: endpoint.healthy,
          latencyMs: endpoint.latencyMs,
          ...(deep ? { errorCount: endpoint.errorCount, lastChecked: endpoint.lastChecked } : {}),
        })),
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    checks.push({
      name: "solana-rpc",
      status: "unhealthy",
      responseTimeMs: Date.now() - rpcStart,
      error,
    });
    overallStatus = "unhealthy";
  }

  // 4. Environment configuration
  const configStart = Date.now();
  const criticalEnvVars = ["SESSION_SECRET", "DATABASE_URL", "SOLANA_RPC_URL"];
  const missingVars = criticalEnvVars.filter((variable) => !process.env[variable]);
  const isProduction = process.env.NODE_ENV === "production";
  const hasDevSecret =
    process.env.SESSION_SECRET?.includes("dev-secret") ||
    process.env.SESSION_SECRET?.includes("CHANGE_THIS");

  if (missingVars.length > 0) {
    checks.push({
      name: "configuration",
      status: "unhealthy",
      responseTimeMs: Date.now() - configStart,
      error: `Missing required environment variables: ${missingVars.join(", ")}`,
    });
    overallStatus = "unhealthy";
  } else if (isProduction && hasDevSecret) {
    checks.push({
      name: "configuration",
      status: "unhealthy",
      responseTimeMs: Date.now() - configStart,
      error: "SESSION_SECRET is using development value in production",
    });
    overallStatus = "unhealthy";
  } else {
    checks.push({
      name: "configuration",
      status: "healthy",
      responseTimeMs: Date.now() - configStart,
      details: {
        nodeEnv: process.env.NODE_ENV,
        cluster: process.env.SOLANA_CLUSTER,
        storageProvider: process.env.STORAGE_PROVIDER,
        ...(deep ? { databaseProvider } : {}),
      },
    });
  }

  // 5. Storage health
  const storageStart = Date.now();
  const storageProvider = process.env.STORAGE_PROVIDER;
  if (storageProvider === "vercel-blob" && !getBlobReadWriteToken()) {
    checks.push({
      name: "storage",
      status: "unhealthy",
      responseTimeMs: Date.now() - storageStart,
      error: "Vercel Blob token not configured",
    });
    if (isProduction) overallStatus = "unhealthy";
  } else {
    checks.push({
      name: "storage",
      status: "healthy",
      responseTimeMs: Date.now() - storageStart,
      details: {
        provider: storageProvider || "local",
      },
    });
  }

  const statusCode = overallStatus === "unhealthy" ? 503 : 200;
  const payload: HealthPayload = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    service: "artmint-web",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "unknown",
    responseTimeMs: Date.now() - startTime,
    checks,
  };

  return { payload, statusCode };
}
