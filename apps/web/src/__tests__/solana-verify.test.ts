import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @solana/web3.js Connection before importing
vi.mock("@solana/web3.js", () => {
  return {
    Connection: vi.fn(),
  };
});

import { Connection } from "@solana/web3.js";
import { verifyTransaction } from "../lib/solana-verify";

const mockGetTransaction = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // Set cluster to mainnet so errors fail-closed (not swallowed by devnet logic)
  process.env.SOLANA_CLUSTER = "mainnet-beta";
  (Connection as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    getTransaction: mockGetTransaction,
  }));
});

describe("solana-verify: verifyTransaction", () => {
  const wallet = "ABcDeFgHiJkLmNoPqRsTuVwXyZ123456789abcdef12";
  const mintAddr = "MintAddress1111111111111111111111111111111111";
  const txSig = "5abc123def456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567";

  it("rejects when transaction not found", async () => {
    mockGetTransaction.mockResolvedValue(null);

    const result = await verifyTransaction(txSig, wallet);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("rejects when transaction has on-chain error", async () => {
    mockGetTransaction.mockResolvedValue({
      meta: { err: { InstructionError: [0, "Custom"] } },
      blockTime: Math.floor(Date.now() / 1000),
      transaction: {
        message: {
          getAccountKeys: () => ({
            get: (i: number) => (i === 0 ? { toBase58: () => wallet } : null),
            length: 1,
          }),
        },
      },
    });

    const result = await verifyTransaction(txSig, wallet);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("failed on-chain");
  });

  it("rejects when transaction is too old", async () => {
    const oldBlockTime = Math.floor(Date.now() / 1000) - 700; // > 600s
    mockGetTransaction.mockResolvedValue({
      meta: { err: null },
      blockTime: oldBlockTime,
      transaction: {
        message: {
          getAccountKeys: () => ({
            get: (i: number) => (i === 0 ? { toBase58: () => wallet } : null),
            length: 1,
          }),
        },
      },
    });

    const result = await verifyTransaction(txSig, wallet);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too old");
  });

  it("rejects when fee payer does not match expected wallet", async () => {
    mockGetTransaction.mockResolvedValue({
      meta: { err: null },
      blockTime: Math.floor(Date.now() / 1000),
      transaction: {
        message: {
          getAccountKeys: () => ({
            get: (i: number) =>
              i === 0 ? { toBase58: () => "WrongWalletAddress1111111111111111111111111" } : null,
            length: 1,
          }),
        },
      },
    });

    const result = await verifyTransaction(txSig, wallet);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("does not match");
  });

  it("rejects when mint address not in account keys", async () => {
    mockGetTransaction.mockResolvedValue({
      meta: { err: null },
      blockTime: Math.floor(Date.now() / 1000),
      transaction: {
        message: {
          getAccountKeys: () => ({
            get: (i: number) => (i === 0 ? { toBase58: () => wallet } : null),
            length: 1,
          }),
        },
      },
    });

    const result = await verifyTransaction(txSig, wallet, mintAddr);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not referenced");
  });

  it("accepts valid transaction with matching wallet", async () => {
    mockGetTransaction.mockResolvedValue({
      meta: { err: null },
      blockTime: Math.floor(Date.now() / 1000),
      transaction: {
        message: {
          getAccountKeys: () => ({
            get: (i: number) => (i === 0 ? { toBase58: () => wallet } : null),
            length: 1,
          }),
        },
      },
    });

    const result = await verifyTransaction(txSig, wallet);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts valid transaction with matching wallet and mint", async () => {
    mockGetTransaction.mockResolvedValue({
      meta: { err: null },
      blockTime: Math.floor(Date.now() / 1000),
      transaction: {
        message: {
          getAccountKeys: () => ({
            get: (i: number) => {
              if (i === 0) return { toBase58: () => wallet };
              if (i === 1) return { toBase58: () => mintAddr };
              return null;
            },
            length: 2,
          }),
        },
      },
    });

    const result = await verifyTransaction(txSig, wallet, mintAddr);
    expect(result.valid).toBe(true);
  });

  it("fails closed on RPC error in mainnet", async () => {
    mockGetTransaction.mockRejectedValue(new Error("RPC unavailable"));

    const result = await verifyTransaction(txSig, wallet);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Verification failed");
  });

  it("fails open on RPC error in devnet", async () => {
    process.env.SOLANA_CLUSTER = "devnet";
    mockGetTransaction.mockRejectedValue(new Error("RPC unavailable"));

    const result = await verifyTransaction(txSig, wallet);
    // devnet fail-open behavior
    expect(result.valid).toBe(true);
  });
});
