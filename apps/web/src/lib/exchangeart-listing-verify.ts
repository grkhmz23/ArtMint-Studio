import bs58 from "bs58";

const CREATE_BUYNOW_SALE_DISCRIMINATOR = Uint8Array.from([
  0x7a, 0x27, 0xc1, 0xa1, 0xbb, 0x91, 0xce, 0xb7,
]);

type AccountKeyLookup = {
  get(index: number): { toBase58(): string } | undefined | null;
  length: number;
};

type CompiledInstructionLike = {
  programIdIndex: number;
  accounts?: number[];
  accountKeyIndexes?: number[];
  data: unknown;
};

export type TxMessageLike = {
  getAccountKeys(): AccountKeyLookup;
  compiledInstructions?: CompiledInstructionLike[];
  instructions?: CompiledInstructionLike[];
};

export interface BuyNowInstructionCheckParams {
  message: TxMessageLike;
  expectedProgramId: string;
  expectedSeller: string;
  expectedMintAddress: string;
  expectedSaleStateKey: string;
  expectedPriceLamports: string;
}

export interface BuyNowInstructionCheckResult {
  ok: boolean;
  error?: string;
}

function decodeIxData(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
    return new Uint8Array(data);
  }
  if (Array.isArray(data) && data.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) {
    return Uint8Array.from(data);
  }
  if (typeof data === "string") {
    try {
      return bs58.decode(data);
    } catch {
      return null;
    }
  }
  return null;
}

function getIxAccountIndexes(ix: CompiledInstructionLike): number[] {
  return (ix.accountKeyIndexes ?? ix.accounts ?? []).map((n) => Number(n));
}

function bytesEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Verify the submitted transaction contains the exact Exchange Art Buy Now listing
 * instruction we expect for this listing (program, seller, mint, sale state, price).
 */
export function verifyBuyNowListingInstruction(
  params: BuyNowInstructionCheckParams
): BuyNowInstructionCheckResult {
  const {
    message,
    expectedProgramId,
    expectedSeller,
    expectedMintAddress,
    expectedSaleStateKey,
    expectedPriceLamports,
  } = params;

  const accountKeys = message.getAccountKeys();
  const accountKeyStrings: string[] = [];
  for (let i = 0; i < accountKeys.length; i++) {
    const key = accountKeys.get(i)?.toBase58();
    if (key) accountKeyStrings.push(key);
  }

  const instructions = message.compiledInstructions ?? message.instructions ?? [];
  let sawBuyNowProgram = false;
  let candidateError = "No matching Exchange Art listing instruction found";

  for (const ix of instructions) {
    const programId = accountKeys.get(ix.programIdIndex)?.toBase58();
    if (programId !== expectedProgramId) continue;
    sawBuyNowProgram = true;

    const ixAccountIndexes = getIxAccountIndexes(ix);
    if (ixAccountIndexes.length < 5) {
      candidateError = "Exchange Art instruction missing expected accounts";
      continue;
    }

    const seller = accountKeys.get(ixAccountIndexes[0])?.toBase58();
    const mint = accountKeys.get(ixAccountIndexes[2])?.toBase58();
    const saleState = accountKeys.get(ixAccountIndexes[4])?.toBase58();

    if (seller !== expectedSeller) {
      candidateError = "Exchange Art listing seller account mismatch";
      continue;
    }
    if (mint !== expectedMintAddress) {
      candidateError = "Exchange Art listing mint account mismatch";
      continue;
    }
    if (saleState !== expectedSaleStateKey) {
      candidateError = "Exchange Art listing sale state account mismatch";
      continue;
    }

    const data = decodeIxData(ix.data);
    if (!data) {
      candidateError = "Exchange Art instruction data could not be decoded";
      continue;
    }
    if (data.length < 28) {
      candidateError = "Exchange Art instruction data too short";
      continue;
    }

    const discriminator = data.subarray(0, 8);
    if (!bytesEq(discriminator, CREATE_BUYNOW_SALE_DISCRIMINATOR)) {
      candidateError = "Exchange Art instruction discriminator mismatch";
      continue;
    }

    const buf = Buffer.from(data);
    const priceLamports = buf.readBigUInt64LE(9).toString();
    const quantity = buf.readUInt16LE(17);
    const startTime = buf.readBigUInt64LE(19);
    const splTokenSettlement = buf.readUInt8(27);

    if (priceLamports !== expectedPriceLamports) {
      candidateError = "Exchange Art listing price mismatch";
      continue;
    }
    if (quantity !== 1) {
      candidateError = "Exchange Art listing quantity must be 1";
      continue;
    }
    if (startTime !== BigInt(0)) {
      candidateError = "Exchange Art listing start time is not immediate";
      continue;
    }
    if (splTokenSettlement !== 0) {
      candidateError = "Exchange Art listing is not SOL-settled";
      continue;
    }

    return { ok: true };
  }

  if (!sawBuyNowProgram) {
    return { ok: false, error: `Required program ${expectedProgramId} not invoked in transaction` };
  }

  return { ok: false, error: candidateError };
}

