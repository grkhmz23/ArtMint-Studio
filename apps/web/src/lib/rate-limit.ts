import { prisma } from "./db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

/**
 * DB-backed sliding window rate limiter.
 * Uses atomic increment-then-check to prevent TOCTOU race conditions.
 * Fails CLOSED on DB error (blocks request rather than allowing unlimited).
 *
 * @param key - Unique identifier (e.g. "ai:ip:1.2.3.4" or "render:ip:1.2.3.4")
 * @param maxRequests - Maximum requests per window
 * @param windowMs - Window duration in milliseconds
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  try {
    // Atomic: upsert with increment. If window expired, reset to count=1.
    // If window is still active, increment count atomically.
    // We do this in a transaction to prevent race conditions.
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.rateLimitWindow.findUnique({
        where: { key },
      });

      if (!existing || existing.windowStart < windowStart) {
        // Window expired or first request — reset to count=1
        const record = await tx.rateLimitWindow.upsert({
          where: { key },
          update: { windowStart: now, count: 1 },
          create: { key, windowStart: now, count: 1 },
        });
        return record;
      }

      // Atomically increment and return the new count
      const record = await tx.rateLimitWindow.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
      return record;
    });

    const elapsed = now.getTime() - result.windowStart.getTime();
    const resetMs = Math.max(0, windowMs - elapsed);

    if (result.count > maxRequests) {
      return { allowed: false, remaining: 0, resetMs };
    }

    return {
      allowed: true,
      remaining: maxRequests - result.count,
      resetMs,
    };
  } catch (err) {
    // FAIL CLOSED: if DB is down, block the request
    console.error("Rate limit DB error (failing closed):", err instanceof Error ? err.message : err);
    return { allowed: false, remaining: 0, resetMs: windowMs };
  }
}

/**
 * Extract client IP from Next.js request.
 * On Vercel, prefer x-real-ip (set by the platform, not spoofable).
 */
export function getClientIp(req: Request): string {
  // Vercel sets x-real-ip from the actual client connection
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  return "unknown";
}
