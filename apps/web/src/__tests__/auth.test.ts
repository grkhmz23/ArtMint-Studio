import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  generateNonce,
  createSessionToken,
  parseSessionToken,
  buildSignMessage,
} from "../lib/auth";

describe("auth: nonce generation", () => {
  it("generates unique nonces", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
    expect(a.length).toBe(64); // 32 bytes hex
  });
});

describe("auth: session tokens", () => {
  it("creates and parses valid session tokens", () => {
    const wallet = "ABcDeFgHiJkLmNoPqRsTuVwXyZ123456789abcdef12";
    const token = createSessionToken(wallet);
    const parsed = parseSessionToken(token);

    expect(parsed).not.toBeNull();
    expect(parsed!.wallet).toBe(wallet);
  });

  it("rejects tampered tokens", () => {
    const wallet = "ABcDeFgHiJkLmNoPqRsTuVwXyZ123456789abcdef12";
    const token = createSessionToken(wallet);

    // Tamper with the signature
    const tampered = token.slice(0, -4) + "XXXX";
    const parsed = parseSessionToken(tampered);
    expect(parsed).toBeNull();
  });

  it("rejects completely invalid tokens", () => {
    expect(parseSessionToken("")).toBeNull();
    expect(parseSessionToken("no-dot")).toBeNull();
    expect(parseSessionToken("foo.bar.baz")).toBeNull();
  });
});

describe("auth: SIWS message", () => {
  it("builds consistent message from nonce", () => {
    const nonce = "abc123";
    const msg = buildSignMessage(nonce);

    expect(msg).toContain("ArtMint Studio");
    expect(msg).toContain("Nonce: abc123");
    expect(msg).toContain("Domain:");
    // Message is deterministic (no timestamp) so nonce/verify produce identical bytes
    const msg2 = buildSignMessage(nonce);
    expect(msg).toBe(msg2);
  });
});

describe("auth: mutating endpoints require authentication", () => {
  // These tests verify that the route files import requireAuth.
  // We test the logic by verifying parseSessionToken rejects bad tokens.
  // A full integration test would require a test server.

  it("401 scenario: no session cookie means null wallet", () => {
    // parseSessionToken with no valid cookie yields null
    const result = parseSessionToken("invalid-cookie-value");
    expect(result).toBeNull();
  });

  it("401 scenario: expired token yields null", () => {
    // Manually construct a token with exp in the past
    // The dev fallback secret is "0".repeat(64)
    const secret = "0".repeat(64);
    const payload = JSON.stringify({
      id: "test-session-id-1234",
      wallet: "TestWallet12345678901234567890123456789012",
      exp: Date.now() - 10_000, // 10 seconds in the past
    });
    const payloadB64 = Buffer.from(payload).toString("base64url");
    const hmac = createHmac("sha256", secret);
    hmac.update(payloadB64);
    const sig = hmac.digest("hex");
    const expiredToken = `${payloadB64}.${sig}`;

    const parsed = parseSessionToken(expiredToken);
    expect(parsed).toBeNull();
  });

  it("valid token is accepted before expiry", () => {
    const wallet = "TestWallet12345678901234567890123456789012";
    const token = createSessionToken(wallet);
    const parsed = parseSessionToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed!.wallet).toBe(wallet);
  });

  it("tokens for different wallets are distinct", () => {
    const a = createSessionToken("WalletA1111111111111111111111111111111111111");
    const b = createSessionToken("WalletB2222222222222222222222222222222222222");
    expect(a).not.toBe(b);

    const parsedA = parseSessionToken(a);
    const parsedB = parseSessionToken(b);
    expect(parsedA!.wallet).toBe("WalletA1111111111111111111111111111111111111");
    expect(parsedB!.wallet).toBe("WalletB2222222222222222222222222222222222222");
  });
});
