import { describe, expect, it } from "vitest";
import bs58 from "bs58";
import { verifyBuyNowListingInstruction, type TxMessageLike } from "../lib/exchangeart-listing-verify";

const BUY_NOW_PROGRAM = "EXBuYPNgBUXMTsjCbezENRUtFQzjUNZxvPGTd11Pznk5";
const SELLER = "Seller111111111111111111111111111111111111111";
const MINT = "Mint11111111111111111111111111111111111111111";
const SALE_STATE = "SaleState11111111111111111111111111111111111";
const OTHER = "Other1111111111111111111111111111111111111111";

function buildCreateBuyNowData(priceLamports: bigint): Uint8Array {
  const data = Buffer.alloc(8 + 1 + 8 + 2 + 8 + 1 + 32);
  let offset = 0;

  Buffer.from([0x7a, 0x27, 0xc1, 0xa1, 0xbb, 0x91, 0xce, 0xb7]).copy(data, offset);
  offset += 8;
  data.writeUInt8(123, offset); // bump
  offset += 1;
  data.writeBigUInt64LE(priceLamports, offset);
  offset += 8;
  data.writeUInt16LE(1, offset); // quantity
  offset += 2;
  data.writeBigUInt64LE(BigInt(0), offset); // start
  offset += 8;
  data.writeUInt8(0, offset); // SOL settlement
  offset += 1;
  Buffer.alloc(32, 1).copy(data, offset); // settlement mint placeholder

  return new Uint8Array(data);
}

function makeMessage(params?: {
  data?: Uint8Array | string;
  programId?: string;
  seller?: string;
  mint?: string;
  saleState?: string;
}): TxMessageLike {
  const keys = [
    params?.seller ?? SELLER,     // instruction account 0 (seller)
    OTHER,                        // seller token account
    params?.mint ?? MINT,         // instruction account 2 (mint)
    OTHER,                        // deposit authority
    params?.saleState ?? SALE_STATE, // instruction account 4 (sale state)
    OTHER, OTHER, OTHER, OTHER, OTHER,
    params?.programId ?? BUY_NOW_PROGRAM, // program id key referenced by programIdIndex
  ];

  return {
    getAccountKeys: () => ({
      length: keys.length,
      get: (index: number) => {
        const value = keys[index];
        return value ? { toBase58: () => value } : null;
      },
    }),
    compiledInstructions: [
      {
        programIdIndex: 10,
        accountKeyIndexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        data: params?.data ?? buildCreateBuyNowData(BigInt(1_500_000_000)),
      },
    ],
  };
}

describe("verifyBuyNowListingInstruction", () => {
  it("accepts a matching Exchange Art create buy now instruction", () => {
    const result = verifyBuyNowListingInstruction({
      message: makeMessage(),
      expectedProgramId: BUY_NOW_PROGRAM,
      expectedSeller: SELLER,
      expectedMintAddress: MINT,
      expectedSaleStateKey: SALE_STATE,
      expectedPriceLamports: "1500000000",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects when price does not match listing", () => {
    const result = verifyBuyNowListingInstruction({
      message: makeMessage(),
      expectedProgramId: BUY_NOW_PROGRAM,
      expectedSeller: SELLER,
      expectedMintAddress: MINT,
      expectedSaleStateKey: SALE_STATE,
      expectedPriceLamports: "999999999",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("price mismatch");
  });

  it("rejects when seller/mint/sale state accounts do not match", () => {
    const result = verifyBuyNowListingInstruction({
      message: makeMessage({ saleState: OTHER }),
      expectedProgramId: BUY_NOW_PROGRAM,
      expectedSeller: SELLER,
      expectedMintAddress: MINT,
      expectedSaleStateKey: SALE_STATE,
      expectedPriceLamports: "1500000000",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("sale state");
  });

  it("rejects when required program is not invoked", () => {
    const result = verifyBuyNowListingInstruction({
      message: makeMessage({ programId: OTHER }),
      expectedProgramId: BUY_NOW_PROGRAM,
      expectedSeller: SELLER,
      expectedMintAddress: MINT,
      expectedSaleStateKey: SALE_STATE,
      expectedPriceLamports: "1500000000",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Required program");
  });

  it("supports base58-encoded instruction data", () => {
    const dataB58 = bs58.encode(buildCreateBuyNowData(BigInt(2_000_000_000)));
    const result = verifyBuyNowListingInstruction({
      message: makeMessage({ data: dataB58 }),
      expectedProgramId: BUY_NOW_PROGRAM,
      expectedSeller: SELLER,
      expectedMintAddress: MINT,
      expectedSaleStateKey: SALE_STATE,
      expectedPriceLamports: "2000000000",
    });

    expect(result.ok).toBe(true);
  });
});

