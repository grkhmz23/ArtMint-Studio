import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  let pdaCounter = 0;

  class MockPublicKey {
    value: string;

    constructor(value: string) {
      this.value = value;
    }

    toBase58() {
      return this.value;
    }

    toBuffer() {
      return Buffer.from(this.value.padEnd(32, "0").slice(0, 32));
    }

    equals(other: unknown) {
      if (!other || typeof other !== "object") return false;
      const candidate = other as { toBase58?: () => string; value?: string };
      return (candidate.toBase58 ? candidate.toBase58() : candidate.value) === this.value;
    }

    static findProgramAddressSync() {
      pdaCounter += 1;
      return [new MockPublicKey(`PDA${pdaCounter.toString().padStart(30, "0")}`), 255] as const;
    }
  }

  return {
    MockPublicKey,
    requireAuth: vi.fn(),
    checkRateLimit: vi.fn(),
    getClientIp: vi.fn(),
    getConnection: vi.fn(),
    prepareMintNftTransaction: vi.fn(),
    verifyTransaction: vi.fn(),
    verifyNftMintCoreInstructions: vi.fn(),
    verifyCreateMetadataV3Instruction: vi.fn(),
    mintFindUnique: vi.fn(),
    mintFindFirst: vi.fn(),
    mintUpdate: vi.fn(),
    activityCreate: vi.fn(),
    resetPdas: () => {
      pdaCounter = 0;
    },
  };
});

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
}));

vi.mock("@/lib/rpc", () => ({
  getConnection: mocks.getConnection,
}));

vi.mock("@/lib/solana-verify", () => ({
  verifyTransaction: mocks.verifyTransaction,
}));

vi.mock("@/lib/metaplex-mint-verify", () => ({
  verifyNftMintCoreInstructions: mocks.verifyNftMintCoreInstructions,
  verifyCreateMetadataV3Instruction: mocks.verifyCreateMetadataV3Instruction,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mint: {
      findUnique: mocks.mintFindUnique,
      findFirst: mocks.mintFindFirst,
      update: mocks.mintUpdate,
    },
    activity: {
      create: mocks.activityCreate,
    },
  },
}));

vi.mock("@solana/web3.js", () => {
  const PublicKey = mocks.MockPublicKey;
  return {
    PublicKey,
    SystemProgram: {
      programId: new PublicKey("11111111111111111111111111111111"),
    },
  };
});

vi.mock("@solana/spl-token", () => {
  const PublicKey = mocks.MockPublicKey;
  return {
    TOKEN_PROGRAM_ID: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    ASSOCIATED_TOKEN_PROGRAM_ID: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
    getAssociatedTokenAddressSync: vi.fn(() => new PublicKey("ATA11111111111111111111111111111111111111111")),
  };
});

vi.mock("@artmint/exchangeart", () => {
  const PublicKey = mocks.MockPublicKey;
  class MintMetadataValidationError extends Error {}
  return {
    prepareMintNftTransaction: mocks.prepareMintNftTransaction,
    MintMetadataValidationError,
    PROGRAM_IDS: {
      tokenMetadata: new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
      buyNowEditions: new PublicKey("EXBuYPNgBUXMTsjCbezENRUtFQzjUNZxvPGTd11Pznk5"),
    },
  };
});

import { POST as mintPrepareTxPost } from "../app/api/mint/prepare/route";
import { POST as mintConfirmPost } from "../app/api/mint/confirm/route";

function makeJsonReq(body: unknown, headers?: Record<string, string>) {
  return {
    headers: new Headers(headers),
    json: async () => body,
  } as any;
}

describe("mint completion routes", () => {
  const wallet = "Wallet111111111111111111111111111111111111111";
  const placeholderMintAddress = "pending-1234567890abcdef";
  const realMintAddress = "Mint11111111111111111111111111111111111111111";
  const txSignature = "a".repeat(88);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetPdas();

    mocks.requireAuth.mockResolvedValue(wallet);
    mocks.getClientIp.mockReturnValue("127.0.0.1");
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, resetMs: 0 });
    mocks.getConnection.mockReturnValue({
      getTransaction: vi.fn().mockResolvedValue({
        transaction: { message: { some: "message" } },
      }),
    });
    mocks.prepareMintNftTransaction.mockResolvedValue({
      serializedTransaction: Buffer.from("tx").toString("base64"),
      mintAddress: realMintAddress,
      blockhash: "blockhash-1",
      lastValidBlockHeight: 123,
      estimatedFee: 5000,
    });
    mocks.verifyTransaction.mockResolvedValue({ valid: true });
    mocks.verifyNftMintCoreInstructions.mockReturnValue({ ok: true });
    mocks.verifyCreateMetadataV3Instruction.mockReturnValue({ ok: true });
    mocks.mintFindFirst.mockResolvedValue(null);
    mocks.mintUpdate.mockResolvedValue({});
    mocks.activityCreate.mockResolvedValue({});
  });

  it("POST /api/mint/prepare returns a prepared transaction for pending mints", async () => {
    mocks.mintFindUnique.mockResolvedValue({
      mintAddress: placeholderMintAddress,
      wallet,
      status: "pending",
      metadataUrl: "https://storage.test/meta.json",
      title: "Prepared Mint",
    });

    const res = await mintPrepareTxPost(
      makeJsonReq({ placeholderMintAddress })
    );

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.pendingMint.placeholderMintAddress).toBe(placeholderMintAddress);
    expect(json.prepared.mintAddress).toBe(realMintAddress);
    expect(json.prepared.expiresAt).toBeTruthy();
    expect(mocks.prepareMintNftTransaction).toHaveBeenCalledTimes(1);
  });

  it("POST /api/mint/prepare rejects non-pending records", async () => {
    mocks.mintFindUnique.mockResolvedValue({
      mintAddress: realMintAddress,
      wallet,
      status: "pending",
      metadataUrl: "https://storage.test/meta.json",
      title: "Already Real",
    });

    const res = await mintPrepareTxPost(
      makeJsonReq({ placeholderMintAddress: realMintAddress })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("not pending");
    expect(mocks.prepareMintNftTransaction).not.toHaveBeenCalled();
  });

  it("POST /api/mint/prepare enforces body-size limit", async () => {
    const res = await mintPrepareTxPost(
      makeJsonReq(
        { placeholderMintAddress },
        { "content-length": "2048" }
      )
    );

    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.error).toContain("too large");
  });

  it("POST /api/mint/confirm rejects tx signature replay", async () => {
    mocks.mintFindFirst.mockResolvedValue({ id: "existing-mint" });

    const res = await mintConfirmPost(
      makeJsonReq({
        placeholderMintAddress,
        mintAddress: realMintAddress,
        txSignature,
      })
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("already used");
    expect(mocks.mintUpdate).not.toHaveBeenCalled();
  });

  it("POST /api/mint/confirm verifies and confirms a mint", async () => {
    mocks.mintFindUnique.mockResolvedValue({
      mintAddress: placeholderMintAddress,
      wallet,
      status: "pending",
      metadataUrl: "https://storage.test/meta.json",
      title: "Prepared Mint",
    });

    const res = await mintConfirmPost(
      makeJsonReq({
        placeholderMintAddress,
        mintAddress: realMintAddress,
        txSignature,
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.mintAddress).toBe(realMintAddress);

    expect(mocks.verifyTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.verifyNftMintCoreInstructions).toHaveBeenCalledTimes(1);
    expect(mocks.verifyCreateMetadataV3Instruction).toHaveBeenCalledTimes(1);
    expect(mocks.mintUpdate).toHaveBeenCalledWith({
      where: { mintAddress: placeholderMintAddress },
      data: {
        mintAddress: realMintAddress,
        txSignature,
        status: "confirmed",
      },
    });
    expect(mocks.activityCreate).toHaveBeenCalledWith({
      data: {
        type: "mint",
        wallet,
        mintAddress: realMintAddress,
      },
    });
  });

  it("POST /api/mint/confirm rejects deep metadata verification mismatches", async () => {
    mocks.mintFindUnique.mockResolvedValue({
      mintAddress: placeholderMintAddress,
      wallet,
      status: "pending",
      metadataUrl: "https://storage.test/meta.json",
      title: "Prepared Mint",
    });
    mocks.verifyCreateMetadataV3Instruction.mockReturnValue({
      ok: false,
      error: "Metadata URI mismatch",
    });

    const res = await mintConfirmPost(
      makeJsonReq({
        placeholderMintAddress,
        mintAddress: realMintAddress,
        txSignature,
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Metadata URI mismatch");
    expect(mocks.mintUpdate).not.toHaveBeenCalled();
  });

  it("POST /api/mint/confirm rejects core NFT mint instruction mismatches", async () => {
    mocks.mintFindUnique.mockResolvedValue({
      mintAddress: placeholderMintAddress,
      wallet,
      status: "pending",
      metadataUrl: "https://storage.test/meta.json",
      title: "Prepared Mint",
    });
    mocks.verifyNftMintCoreInstructions.mockReturnValue({
      ok: false,
      error: "Missing MintTo instruction",
    });

    const res = await mintConfirmPost(
      makeJsonReq({
        placeholderMintAddress,
        mintAddress: realMintAddress,
        txSignature,
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Missing MintTo instruction");
    expect(mocks.mintUpdate).not.toHaveBeenCalled();
  });
});
