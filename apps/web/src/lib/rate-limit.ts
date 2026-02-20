import { prisma } from "./db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

/**
 * DB-backed sliding window rate limiter.
 * Works across multiple server instances (unlike in-memory).
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
    const existing = await prisma.rateLimitWindow.findUnique({
      where: { key },
    });

    if (!existing || existing.windowStart < windowStart) {
      // Window expired or first request — reset
      await prisma.rateLimitWindow.upsert({
        where: { key },
        update: { windowStart: now, count: 1 },
        create: { key, windowStart: now, count: 1 },
      });
      return { allowed: true, remaining: maxRequests - 1, resetMs: windowMs };
    }

    if (existing.count >= maxRequests) {
      const elapsed = now.getTime() - existing.windowStart.getTime();
      return {
        allowed: false,
        remaining: 0,
        resetMs: Math.max(0, windowMs - elapsed),
      };
    }

    // Increment
    await prisma.rateLimitWindow.update({
      where: { key },
      data: { count: { increment: 1 } },
    });

    return {
      allowed: true,
      remaining: maxRequests - existing.count - 1,
      resetMs: Math.max(0, windowMs - (now.getTime() - existing.windowStart.getTime())),
    };
  } catch {
    // If DB fails, allow the request (fail-open for rate limiter only)
    return { allowed: true, remaining: maxRequests, resetMs: windowMs };
  }
}

/**
 * Extract client IP from Next.js request.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  return "unknown";
}
