import { createHmac, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./db";

const SESSION_COOKIE = "artmint_session";
const SESSION_MAX_AGE_S = 24 * 60 * 60; // 24 hours

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.includes("do-not-use-in-production")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production");
    }
    // In dev, use a deterministic fallback so sessions survive restarts
    return "0".repeat(64);
  }
  return secret;
}

/** Create an HMAC-signed session token */
function signToken(payload: string): string {
  const hmac = createHmac("sha256", getSessionSecret());
  hmac.update(payload);
  const sig = hmac.digest("hex");
  return `${payload}.${sig}`;
}

/** Verify and extract payload from signed token */
function verifyToken(token: string): string | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = token.slice(0, lastDot);
  const expected = signToken(payload);
  // Constant-time comparison
  if (token.length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0 ? payload : null;
}

/** Generate a cryptographically random nonce */
export function generateNonce(): string {
  return randomBytes(32).toString("hex");
}

/** Create a session token for a wallet */
export function createSessionToken(wallet: string): string {
  const id = randomBytes(16).toString("hex");
  const payload = JSON.stringify({ id, wallet, exp: Date.now() + SESSION_MAX_AGE_S * 1000 });
  return signToken(Buffer.from(payload).toString("base64url"));
}

/** Parse a session token and return the wallet if valid */
export function parseSessionToken(token: string): { wallet: string; id: string } | null {
  const payloadB64 = verifyToken(token);
  if (!payloadB64) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as {
      id: string;
      wallet: string;
      exp: number;
    };
    if (payload.exp < Date.now()) return null;
    return { wallet: payload.wallet, id: payload.id };
  } catch {
    return null;
  }
}

/**
 * Get the authenticated wallet from the request session cookie.
 * Returns null if not authenticated.
 */
export async function getSessionWallet(req: NextRequest): Promise<string | null> {
  const cookie = req.cookies.get(SESSION_COOKIE);
  if (!cookie?.value) return null;

  const parsed = parseSessionToken(cookie.value);
  if (!parsed) return null;

  // Verify session still exists in DB
  const session = await prisma.session.findUnique({
    where: { token: cookie.value },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.wallet;
}

/**
 * Require authentication — returns a 401 response if not authenticated,
 * or the wallet string if authenticated.
 */
export async function requireAuth(
  req: NextRequest
): Promise<string | NextResponse> {
  const wallet = await getSessionWallet(req);
  if (!wallet) {
    return NextResponse.json(
      { error: "Authentication required", code: "auth_required" },
      { status: 401 }
    );
  }
  return wallet;
}

/** Build the SIWS message that the wallet signs */
export function buildSignMessage(nonce: string, domain?: string): string {
  const resolvedDomain =
    domain ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return [
    `ArtMint Studio wants you to sign in with your Solana account.`,
    ``,
    `Domain: ${resolvedDomain}`,
    `Nonce: ${nonce}`,
  ].join("\n");
}

/** Set the session cookie on a response */
export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE_S,
    path: "/",
  });
}

/** Clear the session cookie */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}
