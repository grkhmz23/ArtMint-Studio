import { describe, expect, it } from "vitest";
import bs58 from "bs58";
import {
  verifyCreateMetadataV3Instruction,
  verifyNftMintCoreInstructions,
  type TxMessageLike,
} from "../lib/metaplex-mint-verify";

const TOKEN_METADATA_PROGRAM = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
const WALLET = "Wallet111111111111111111111111111111111111111";
const MINT = "Mint11111111111111111111111111111111111111111";
const METADATA = "Meta11111111111111111111111111111111111111111";
const OTHER = "Other1111111111111111111111111111111111111111";

function buildCreateMetadataV3Data(params?: {
  name?: string;
  symbol?: string;
  uri?: string;
  sellerFeeBasisPoints?: number;
  creatorAddress?: string;
  creatorVerified?: boolean;
  creatorShare?: number;
}): Uint8Array {
  const name = params?.name ?? "ArtMint #123";
  const symbol = params?.symbol ?? "ARTMINT";
  const uri = params?.uri ?? "https://example.com/meta.json";

  const buffers: Buffer[] = [];
  buffers.push(Buffer.from([33]));

  const nameBytes = Buffer.from(name);
  const nameLen = Buffer.alloc(4);
  nameLen.writeUInt32LE(nameBytes.length);
  buffers.push(nameLen, nameBytes);

  const symbolBytes = Buffer.from(symbol);
  const symbolLen = Buffer.alloc(4);
  symbolLen.writeUInt32LE(symbolBytes.length);
  buffers.push(symbolLen, symbolBytes);

  const uriBytes = Buffer.from(uri);
  const uriLen = Buffer.alloc(4);
  uriLen.writeUInt32LE(uriBytes.length);
  buffers.push(uriLen, uriBytes);

  const feeBuf = Buffer.alloc(2);
  feeBuf.writeUInt16LE(params?.sellerFeeBasisPoints ?? 500);
  buffers.push(feeBuf);

  // Minimal valid tail matching createMetadataV3 builder
  buffers.push(Buffer.from([1])); // creators Some
  const creatorsLen = Buffer.alloc(4);
  creatorsLen.writeUInt32LE(1);
  buffers.push(creatorsLen);
  const creatorAddress = params?.creatorAddress;
  buffers.push(creatorAddress ? Buffer.from(bs58.decode(creatorAddress)) : Buffer.alloc(32, 1));
  buffers.push(Buffer.from([params?.creatorVerified === false ? 0 : 1]));
  buffers.push(Buffer.from([params?.creatorShare ?? 100]));
  buffers.push(Buffer.from([0])); // collection none
  buffers.push(Buffer.from([0])); // uses none
  buffers.push(Buffer.from([1])); // isMutable
  buffers.push(Buffer.from([0])); // collectionDetails none

  return new Uint8Array(Buffer.concat(buffers));
}

function makeMessage(params?: {
  programId?: string;
  wallet?: string;
  mint?: string;
  metadata?: string;
  data?: Uint8Array | string;
}): TxMessageLike {
  const keys = [
    params?.metadata ?? METADATA, // metadata
    params?.mint ?? MINT, // mint
    params?.wallet ?? WALLET, // mint authority
    params?.wallet ?? WALLET, // payer
    params?.wallet ?? WALLET, // update authority
    OTHER,
    OTHER,
    params?.programId ?? TOKEN_METADATA_PROGRAM, // token metadata program
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
        programIdIndex: 7,
        accountKeyIndexes: [0, 1, 2, 3, 4, 5, 6],
        data: params?.data ?? buildCreateMetadataV3Data(),
      },
    ],
  };
}

describe("verifyCreateMetadataV3Instruction", () => {
  it("accepts a matching CreateMetadataAccountV3 instruction", () => {
    const result = verifyCreateMetadataV3Instruction({
      message: makeMessage(),
      expectedTokenMetadataProgramId: TOKEN_METADATA_PROGRAM,
      expectedWallet: WALLET,
      expectedMintAddress: MINT,
      expectedMetadataUri: "https://example.com/meta.json",
      expectedName: "ArtMint #123",
      expectedSymbol: "ARTMINT",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects metadata URI mismatch", () => {
    const result = verifyCreateMetadataV3Instruction({
      message: makeMessage(),
      expectedTokenMetadataProgramId: TOKEN_METADATA_PROGRAM,
      expectedWallet: WALLET,
      expectedMintAddress: MINT,
      expectedMetadataUri: "https://example.com/other.json",
      expectedName: "ArtMint #123",
      expectedSymbol: "ARTMINT",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("URI mismatch");
  });

  it("rejects authority mismatch", () => {
    const result = verifyCreateMetadataV3Instruction({
      message: makeMessage({ wallet: OTHER }),
      expectedTokenMetadataProgramId: TOKEN_METADATA_PROGRAM,
      expectedWallet: WALLET,
      expectedMintAddress: MINT,
      expectedMetadataUri: "https://example.com/meta.json",
      expectedName: "ArtMint #123",
      expectedSymbol: "ARTMINT",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("authority/payer mismatch");
  });

  it("supports base58-encoded instruction data", () => {
    const result = verifyCreateMetadataV3Instruction({
      message: makeMessage({
        data: bs58.encode(buildCreateMetadataV3Data({ uri: "https://example.com/base58.json" })),
      }),
      expectedTokenMetadataProgramId: TOKEN_METADATA_PROGRAM,
      expectedWallet: WALLET,
      expectedMintAddress: MINT,
      expectedMetadataUri: "https://example.com/base58.json",
      expectedName: "ArtMint #123",
      expectedSymbol: "ARTMINT",
    });

    expect(result.ok).toBe(true);
  });

  it("verifies seller fee and creators when expected", () => {
    const creatorAddress = bs58.encode(Buffer.alloc(32, 9));
    const result = verifyCreateMetadataV3Instruction({
      message: makeMessage({
        data: buildCreateMetadataV3Data({
          sellerFeeBasisPoints: 500,
          creatorAddress,
          creatorVerified: true,
          creatorShare: 100,
        }),
      }),
      expectedTokenMetadataProgramId: TOKEN_METADATA_PROGRAM,
      expectedWallet: WALLET,
      expectedMintAddress: MINT,
      expectedMetadataUri: "https://example.com/meta.json",
      expectedName: "ArtMint #123",
      expectedSymbol: "ARTMINT",
      expectedSellerFeeBasisPoints: 500,
      expectedCreators: [{ address: creatorAddress, verified: true, share: 100 }],
    });

    expect(result.ok).toBe(true);
  });

  it("rejects seller fee mismatch", () => {
    const result = verifyCreateMetadataV3Instruction({
      message: makeMessage({
        data: buildCreateMetadataV3Data({ sellerFeeBasisPoints: 750 }),
      }),
      expectedTokenMetadataProgramId: TOKEN_METADATA_PROGRAM,
      expectedWallet: WALLET,
      expectedMintAddress: MINT,
      expectedMetadataUri: "https://example.com/meta.json",
      expectedName: "ArtMint #123",
      expectedSymbol: "ARTMINT",
      expectedSellerFeeBasisPoints: 500,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("seller fee");
  });
});

const CORE_WALLET = bs58.encode(Buffer.alloc(32, 11));
const CORE_MINT = bs58.encode(Buffer.alloc(32, 12));
const CORE_ATA = bs58.encode(Buffer.alloc(32, 13));
const CORE_METADATA = bs58.encode(Buffer.alloc(32, 14));
const CORE_MASTER_EDITION = bs58.encode(Buffer.alloc(32, 15));
const CORE_RENT = "SysvarRent111111111111111111111111111111111";
const CORE_SYSTEM_PROGRAM = "11111111111111111111111111111111";
const CORE_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const CORE_ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

function buildSystemCreateAccountData(owner: string, space = 82): Uint8Array {
  const data = Buffer.alloc(52);
  data.writeUInt32LE(0, 0); // CreateAccount
  data.writeBigUInt64LE(BigInt(1_000_000), 4);
  data.writeBigUInt64LE(BigInt(space), 12);
  Buffer.from(bs58.decode(owner)).copy(data, 20);
  return new Uint8Array(data);
}

function buildInitializeMintData(authority: string): Uint8Array {
  const data = Buffer.alloc(67);
  data.writeUInt8(0, 0); // InitializeMint
  data.writeUInt8(0, 1); // decimals
  Buffer.from(bs58.decode(authority)).copy(data, 2);
  data.writeUInt8(1, 34); // freeze auth present
  Buffer.from(bs58.decode(authority)).copy(data, 35);
  return new Uint8Array(data);
}

function buildMintToData(amount: bigint): Uint8Array {
  const data = Buffer.alloc(9);
  data.writeUInt8(7, 0);
  data.writeBigUInt64LE(amount, 1);
  return new Uint8Array(data);
}

function buildMasterEditionV3Data(maxSupply: bigint): Uint8Array {
  const data = Buffer.alloc(10);
  data.writeUInt8(17, 0);
  data.writeUInt8(1, 1); // Some(maxSupply)
  data.writeBigUInt64LE(maxSupply, 2);
  return new Uint8Array(data);
}

function makeCoreMintMessage(params?: {
  mintToAmount?: bigint;
  extraProgramId?: string;
}): TxMessageLike {
  const keys = [
    CORE_WALLET, // 0
    CORE_MINT, // 1
    CORE_ATA, // 2
    CORE_METADATA, // 3
    CORE_MASTER_EDITION, // 4
    CORE_RENT, // 5
    CORE_SYSTEM_PROGRAM, // 6
    CORE_TOKEN_PROGRAM, // 7
    CORE_ATA_PROGRAM, // 8
    TOKEN_METADATA_PROGRAM, // 9
    "ComputeBudget111111111111111111111111111111", // 10
    params?.extraProgramId ?? "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", // 11
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
      { programIdIndex: 10, accountKeyIndexes: [], data: Uint8Array.from([2, 1, 0]) }, // compute budget ignored
      {
        programIdIndex: 6,
        accountKeyIndexes: [0, 1],
        data: buildSystemCreateAccountData(CORE_TOKEN_PROGRAM),
      },
      {
        programIdIndex: 7,
        accountKeyIndexes: [1, 5],
        data: buildInitializeMintData(CORE_WALLET),
      },
      {
        programIdIndex: 8,
        accountKeyIndexes: [0, 2, 0, 1, 6, 7],
        data: new Uint8Array([]),
      },
      {
        programIdIndex: 7,
        accountKeyIndexes: [1, 2, 0],
        data: buildMintToData(params?.mintToAmount ?? BigInt(1)),
      },
      {
        programIdIndex: 9,
        accountKeyIndexes: [3, 1, 0, 0, 0, 6, 5],
        data: buildCreateMetadataV3Data(),
      },
      {
        programIdIndex: 9,
        accountKeyIndexes: [4, 1, 0, 0, 0, 3, 7, 6, 5],
        data: buildMasterEditionV3Data(BigInt(0)),
      },
    ],
  };
}

describe("verifyNftMintCoreInstructions", () => {
  it("accepts a matching NFT mint instruction set", () => {
    const result = verifyNftMintCoreInstructions({
      message: makeCoreMintMessage(),
      expectedWallet: CORE_WALLET,
      expectedMintAddress: CORE_MINT,
      expectedAssociatedTokenAddress: CORE_ATA,
      expectedMetadataAddress: CORE_METADATA,
      expectedMasterEditionAddress: CORE_MASTER_EDITION,
      expectedSystemProgramId: CORE_SYSTEM_PROGRAM,
      expectedTokenProgramId: CORE_TOKEN_PROGRAM,
      expectedAssociatedTokenProgramId: CORE_ATA_PROGRAM,
      expectedTokenMetadataProgramId: TOKEN_METADATA_PROGRAM,
    });

    expect(result.ok).toBe(true);
  });

  it("rejects NFT mints when MintTo amount is not 1", () => {
    const result = verifyNftMintCoreInstructions({
      message: makeCoreMintMessage({ mintToAmount: BigInt(2) }),
      expectedWallet: CORE_WALLET,
      expectedMintAddress: CORE_MINT,
      expectedAssociatedTokenAddress: CORE_ATA,
      expectedMetadataAddress: CORE_METADATA,
      expectedMasterEditionAddress: CORE_MASTER_EDITION,
      expectedSystemProgramId: CORE_SYSTEM_PROGRAM,
      expectedTokenProgramId: CORE_TOKEN_PROGRAM,
      expectedAssociatedTokenProgramId: CORE_ATA_PROGRAM,
      expectedTokenMetadataProgramId: TOKEN_METADATA_PROGRAM,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("MintTo amount");
  });
});
