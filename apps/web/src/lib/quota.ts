import { NextResponse } from "next/server";
import { prisma } from "./db";

function todayString(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function tomorrowResetAt(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

const AI_MAX_DAILY_PER_USER = parseInt(process.env.AI_MAX_DAILY_PER_USER ?? "10", 10);
const AI_MAX_DAILY_GLOBAL = parseInt(process.env.AI_MAX_DAILY_GLOBAL ?? "500", 10);

export interface QuotaInfo {
  remaining: number;
  limit: number;
  resetAt: string;
}

/**
 * Check and increment usage quota for a given wallet + action.
 * Returns null if OK (and increments the counter), or an error response.
 */
export async function checkAndIncrementQuota(
  wallet: string,
  action: string
): Promise<{ error: NextResponse } | { quotaInfo: QuotaInfo }> {
  const date = todayString();
  const resetAt = tomorrowResetAt();

  // Check global cap first
  const globalResult = await prisma.usageCounter.aggregate({
    _sum: { count: true },
    where: { date, action },
  });
  const globalUsed = globalResult._sum.count ?? 0;

  if (globalUsed >= AI_MAX_DAILY_GLOBAL) {
    return {
      error: NextResponse.json(
        {
          error: "AI generation paused — daily global limit reached. Try again tomorrow.",
          code: "ai_paused",
          resetAt,
        },
        { status: 503 }
      ),
    };
  }

  // Check per-user quota
  const existing = await prisma.usageCounter.findUnique({
    where: { date_userWallet_action: { date, userWallet: wallet, action } },
  });
  const userUsed = existing?.count ?? 0;

  if (userUsed >= AI_MAX_DAILY_PER_USER) {
    return {
      error: NextResponse.json(
        {
          error: `Daily limit reached (${AI_MAX_DAILY_PER_USER} per day). Try again tomorrow.`,
          code: "quota_exceeded",
          resetAt,
          remaining: 0,
          limit: AI_MAX_DAILY_PER_USER,
        },
        { status: 403 }
      ),
    };
  }

  // Increment counter
  await prisma.usageCounter.upsert({
    where: { date_userWallet_action: { date, userWallet: wallet, action } },
    update: { count: { increment: 1 } },
    create: { date, userWallet: wallet, action, count: 1 },
  });

  return {
    quotaInfo: {
      remaining: AI_MAX_DAILY_PER_USER - userUsed - 1,
      limit: AI_MAX_DAILY_PER_USER,
      resetAt,
    },
  };
}

/**
 * Get current quota info for a wallet without incrementing.
 */
export async function getQuotaInfo(
  wallet: string,
  action: string
): Promise<QuotaInfo> {
  const date = todayString();
  const resetAt = tomorrowResetAt();

  const existing = await prisma.usageCounter.findUnique({
    where: { date_userWallet_action: { date, userWallet: wallet, action } },
  });

  return {
    remaining: AI_MAX_DAILY_PER_USER - (existing?.count ?? 0),
    limit: AI_MAX_DAILY_PER_USER,
    resetAt,
  };
}
