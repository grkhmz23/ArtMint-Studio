import bs58 from "bs58";

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

export interface VerifyMintMetadataInstructionParams {
  message: TxMessageLike;
  expectedTokenMetadataProgramId: string;
  expectedWallet: string;
  expectedMintAddress: string;
  expectedMetadataUri: string;
  expectedMetadataAddress?: string;
  expectedName?: string | null;
  expectedSymbol?: string;
  expectedSellerFeeBasisPoints?: number;
  expectedCreators?: Array<{ address: string; verified: boolean; share: number }>;
}

export interface VerifyMintMetadataInstructionResult {
  ok: boolean;
  error?: string;
}

export interface VerifyNftMintCoreInstructionParams {
  message: TxMessageLike;
  expectedWallet: string;
  expectedMintAddress: string;
  expectedAssociatedTokenAddress: string;
  expectedMetadataAddress: string;
  expectedMasterEditionAddress: string;
  expectedSystemProgramId: string;
  expectedTokenProgramId: string;
  expectedAssociatedTokenProgramId: string;
  expectedTokenMetadataProgramId: string;
}

export interface VerifyNftMintCoreInstructionResult {
  ok: boolean;
  error?: string;
}

const COMPUTE_BUDGET_PROGRAM_ID = "ComputeBudget111111111111111111111111111111";

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

function readBorshString(buf: Buffer, offset: number): { value: string; next: number } | null {
  if (offset + 4 > buf.length) return null;
  const len = buf.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + len;
  if (end > buf.length) return null;
  return {
    value: buf.subarray(start, end).toString("utf8"),
    next: end,
  };
}

function readBorshPubkey(buf: Buffer, offset: number): { value: string; next: number } | null {
  const end = offset + 32;
  if (end > buf.length) return null;
  return {
    value: bs58.encode(buf.subarray(offset, end)),
    next: end,
  };
}

function getInstructions(message: TxMessageLike): CompiledInstructionLike[] {
  return message.compiledInstructions ?? message.instructions ?? [];
}

function readU64AsSafeNumber(buf: Buffer, offset: number): number | null {
  if (offset + 8 > buf.length) return null;
  const value = buf.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(value);
}

function verifySystemCreateMintAccountInstruction(params: {
  ix: CompiledInstructionLike;
  accountKeys: AccountKeyLookup;
  expectedWallet: string;
  expectedMintAddress: string;
  expectedTokenProgramId: string;
}): string | null {
  const { ix, accountKeys, expectedWallet, expectedMintAddress, expectedTokenProgramId } = params;
  const ixAccountIndexes = getIxAccountIndexes(ix);
  if (ixAccountIndexes.length < 2) return "System createAccount instruction missing expected accounts";

  const from = accountKeys.get(ixAccountIndexes[0])?.toBase58();
  const newAccount = accountKeys.get(ixAccountIndexes[1])?.toBase58();
  if (from !== expectedWallet || newAccount !== expectedMintAddress) {
    return "System createAccount mint/wallet mismatch";
  }

  const dataBytes = decodeIxData(ix.data);
  if (!dataBytes) return "System createAccount instruction data could not be decoded";
  const data = Buffer.from(dataBytes);
  if (data.length < 52) return "System createAccount instruction data too short";

  const systemIx = data.readUInt32LE(0);
  if (systemIx !== 0) return "Unexpected SystemProgram instruction (expected createAccount)";

  const lamports = readU64AsSafeNumber(data, 4);
  const space = readU64AsSafeNumber(data, 12);
  const owner = readBorshPubkey(data, 20);
  if (lamports === null || space === null || !owner) {
    return "Could not parse System createAccount fields";
  }
  if (lamports <= 0) return "Mint account rent lamports must be > 0";
  if (space !== 82) return "Mint account size must be 82 bytes";
  if (owner.value !== expectedTokenProgramId) return "Mint account owner is not SPL Token program";

  return null;
}

function verifyTokenInitializeMintInstruction(params: {
  ix: CompiledInstructionLike;
  accountKeys: AccountKeyLookup;
  expectedWallet: string;
  expectedMintAddress: string;
}): string | null {
  const { ix, accountKeys, expectedWallet, expectedMintAddress } = params;
  const ixAccountIndexes = getIxAccountIndexes(ix);
  if (ixAccountIndexes.length < 2) return "InitializeMint instruction missing expected accounts";

  const mint = accountKeys.get(ixAccountIndexes[0])?.toBase58();
  if (mint !== expectedMintAddress) return "InitializeMint mint account mismatch";

  const dataBytes = decodeIxData(ix.data);
  if (!dataBytes) return "InitializeMint instruction data could not be decoded";
  const data = Buffer.from(dataBytes);
  if (data.length < 67) return "InitializeMint instruction data too short";

  const discriminator = data.readUInt8(0);
  const decimals = data.readUInt8(1);
  const mintAuthority = bs58.encode(data.subarray(2, 34));
  const hasFreezeAuthority = data.readUInt8(34);
  const freezeAuthority = bs58.encode(data.subarray(35, 67));

  if (discriminator !== 0) return "Unexpected SPL Token instruction (expected InitializeMint)";
  if (decimals !== 0) return "NFT mint must use 0 decimals";
  if (mintAuthority !== expectedWallet) return "InitializeMint mint authority mismatch";
  if (hasFreezeAuthority !== 1) return "InitializeMint must set freeze authority";
  if (freezeAuthority !== expectedWallet) return "InitializeMint freeze authority mismatch";

  return null;
}

function verifyAssociatedTokenCreateInstruction(params: {
  ix: CompiledInstructionLike;
  accountKeys: AccountKeyLookup;
  expectedWallet: string;
  expectedMintAddress: string;
  expectedAssociatedTokenAddress: string;
  expectedSystemProgramId: string;
  expectedTokenProgramId: string;
}): string | null {
  const {
    ix,
    accountKeys,
    expectedWallet,
    expectedMintAddress,
    expectedAssociatedTokenAddress,
    expectedSystemProgramId,
    expectedTokenProgramId,
  } = params;

  const ixAccountIndexes = getIxAccountIndexes(ix);
  if (ixAccountIndexes.length < 6) {
    return "Associated Token instruction missing expected accounts";
  }

  const payer = accountKeys.get(ixAccountIndexes[0])?.toBase58();
  const ata = accountKeys.get(ixAccountIndexes[1])?.toBase58();
  const owner = accountKeys.get(ixAccountIndexes[2])?.toBase58();
  const mint = accountKeys.get(ixAccountIndexes[3])?.toBase58();
  const system = accountKeys.get(ixAccountIndexes[4])?.toBase58();
  const token = accountKeys.get(ixAccountIndexes[5])?.toBase58();

  if (payer !== expectedWallet || owner !== expectedWallet) {
    return "Associated Token instruction wallet mismatch";
  }
  if (ata !== expectedAssociatedTokenAddress) {
    return "Associated Token account mismatch";
  }
  if (mint !== expectedMintAddress) {
    return "Associated Token mint mismatch";
  }
  if (system !== expectedSystemProgramId) {
    return "Associated Token SystemProgram mismatch";
  }
  if (token !== expectedTokenProgramId) {
    return "Associated Token SPL Token program mismatch";
  }

  const dataBytes = decodeIxData(ix.data);
  if (!dataBytes) return "Associated Token instruction data could not be decoded";
  if (dataBytes.length !== 0) return "Associated Token create instruction must have empty data";

  return null;
}

function verifyTokenMintToInstruction(params: {
  ix: CompiledInstructionLike;
  accountKeys: AccountKeyLookup;
  expectedWallet: string;
  expectedMintAddress: string;
  expectedAssociatedTokenAddress: string;
}): string | null {
  const { ix, accountKeys, expectedWallet, expectedMintAddress, expectedAssociatedTokenAddress } = params;
  const ixAccountIndexes = getIxAccountIndexes(ix);
  if (ixAccountIndexes.length < 3) return "MintTo instruction missing expected accounts";

  const mint = accountKeys.get(ixAccountIndexes[0])?.toBase58();
  const destination = accountKeys.get(ixAccountIndexes[1])?.toBase58();
  const authority = accountKeys.get(ixAccountIndexes[2])?.toBase58();
  if (mint !== expectedMintAddress) return "MintTo mint account mismatch";
  if (destination !== expectedAssociatedTokenAddress) return "MintTo destination ATA mismatch";
  if (authority !== expectedWallet) return "MintTo authority mismatch";

  const dataBytes = decodeIxData(ix.data);
  if (!dataBytes) return "MintTo instruction data could not be decoded";
  const data = Buffer.from(dataBytes);
  if (data.length < 9) return "MintTo instruction data too short";

  const discriminator = data.readUInt8(0);
  const amount = data.readBigUInt64LE(1);
  if (discriminator !== 7) return "Unexpected SPL Token instruction (expected MintTo)";
  if (amount !== BigInt(1)) return "NFT MintTo amount must be exactly 1";

  return null;
}

function verifyCreateMasterEditionV3Instruction(params: {
  ix: CompiledInstructionLike;
  accountKeys: AccountKeyLookup;
  expectedWallet: string;
  expectedMintAddress: string;
  expectedMetadataAddress: string;
  expectedMasterEditionAddress: string;
  expectedTokenProgramId: string;
  expectedSystemProgramId: string;
}): string | null {
  const {
    ix,
    accountKeys,
    expectedWallet,
    expectedMintAddress,
    expectedMetadataAddress,
    expectedMasterEditionAddress,
    expectedTokenProgramId,
    expectedSystemProgramId,
  } = params;

  const ixAccountIndexes = getIxAccountIndexes(ix);
  if (ixAccountIndexes.length < 9) {
    return "CreateMasterEditionV3 instruction missing expected accounts";
  }

  const edition = accountKeys.get(ixAccountIndexes[0])?.toBase58();
  const mint = accountKeys.get(ixAccountIndexes[1])?.toBase58();
  const updateAuthority = accountKeys.get(ixAccountIndexes[2])?.toBase58();
  const mintAuthority = accountKeys.get(ixAccountIndexes[3])?.toBase58();
  const payer = accountKeys.get(ixAccountIndexes[4])?.toBase58();
  const metadata = accountKeys.get(ixAccountIndexes[5])?.toBase58();
  const tokenProgram = accountKeys.get(ixAccountIndexes[6])?.toBase58();
  const systemProgram = accountKeys.get(ixAccountIndexes[7])?.toBase58();

  if (edition !== expectedMasterEditionAddress) return "Master Edition PDA mismatch";
  if (mint !== expectedMintAddress) return "Master Edition mint mismatch";
  if (metadata !== expectedMetadataAddress) return "Master Edition metadata PDA mismatch";
  if (updateAuthority !== expectedWallet || mintAuthority !== expectedWallet || payer !== expectedWallet) {
    return "Master Edition authority/payer mismatch";
  }
  if (tokenProgram !== expectedTokenProgramId) return "Master Edition token program mismatch";
  if (systemProgram !== expectedSystemProgramId) return "Master Edition system program mismatch";

  const dataBytes = decodeIxData(ix.data);
  if (!dataBytes) return "CreateMasterEditionV3 instruction data could not be decoded";
  const data = Buffer.from(dataBytes);
  if (data.length < 10) return "CreateMasterEditionV3 instruction data too short";

  const discriminator = data.readUInt8(0);
  const hasMaxSupply = data.readUInt8(1);
  const maxSupply = data.readBigUInt64LE(2);
  if (discriminator !== 17) return "Token Metadata instruction is not CreateMasterEditionV3";
  if (hasMaxSupply !== 1) return "Master Edition maxSupply option must be set";
  if (maxSupply !== BigInt(0)) return "Master Edition maxSupply must be 0 for 1/1 NFT";

  return null;
}

/**
 * Verify the mint transaction contains the expected Metaplex CreateMetadataAccountV3
 * instruction for this exact ArtMint metadata URI and wallet/mint.
 */
export function verifyCreateMetadataV3Instruction(
  params: VerifyMintMetadataInstructionParams
): VerifyMintMetadataInstructionResult {
  const {
    message,
    expectedTokenMetadataProgramId,
    expectedWallet,
    expectedMintAddress,
    expectedMetadataUri,
    expectedMetadataAddress,
    expectedName,
    expectedSymbol = "ARTMINT",
    expectedSellerFeeBasisPoints,
    expectedCreators,
  } = params;

  const accountKeys = message.getAccountKeys();
  const instructions = getInstructions(message);
  let sawTokenMetadataProgram = false;
  let candidateError = "No matching Metaplex metadata instruction found";

  for (const ix of instructions) {
    const programId = accountKeys.get(ix.programIdIndex)?.toBase58();
    if (programId !== expectedTokenMetadataProgramId) continue;
    sawTokenMetadataProgram = true;

    const ixAccountIndexes = getIxAccountIndexes(ix);
    if (ixAccountIndexes.length < 5) {
      candidateError = "Token Metadata instruction missing expected accounts";
      continue;
    }

    const metadataKey = accountKeys.get(ixAccountIndexes[0])?.toBase58();
    const mintKey = accountKeys.get(ixAccountIndexes[1])?.toBase58();
    const mintAuthority = accountKeys.get(ixAccountIndexes[2])?.toBase58();
    const payer = accountKeys.get(ixAccountIndexes[3])?.toBase58();
    const updateAuthority = accountKeys.get(ixAccountIndexes[4])?.toBase58();

    if (!metadataKey) {
      candidateError = "Token Metadata metadata account missing";
      continue;
    }
    if (expectedMetadataAddress && metadataKey !== expectedMetadataAddress) {
      candidateError = "Token Metadata metadata PDA mismatch";
      continue;
    }
    if (mintKey !== expectedMintAddress) {
      candidateError = "Token Metadata mint account mismatch";
      continue;
    }
    if (mintAuthority !== expectedWallet || payer !== expectedWallet || updateAuthority !== expectedWallet) {
      candidateError = "Token Metadata authority/payer mismatch";
      continue;
    }

    const dataBytes = decodeIxData(ix.data);
    if (!dataBytes) {
      candidateError = "Token Metadata instruction data could not be decoded";
      continue;
    }
    if (dataBytes.length < 2) {
      candidateError = "Token Metadata instruction data too short";
      continue;
    }

    const data = Buffer.from(dataBytes);
    const discriminator = data.readUInt8(0);
    if (discriminator !== 33) {
      candidateError = "Token Metadata instruction is not CreateMetadataAccountV3";
      continue;
    }

    let offset = 1;
    const nameField = readBorshString(data, offset);
    if (!nameField) {
      candidateError = "Could not parse metadata name";
      continue;
    }
    offset = nameField.next;

    const symbolField = readBorshString(data, offset);
    if (!symbolField) {
      candidateError = "Could not parse metadata symbol";
      continue;
    }
    offset = symbolField.next;

    const uriField = readBorshString(data, offset);
    if (!uriField) {
      candidateError = "Could not parse metadata URI";
      continue;
    }
    offset = uriField.next;

    if (offset + 2 > data.length) {
      candidateError = "Could not parse metadata seller fee";
      continue;
    }
    const sellerFeeBasisPoints = data.readUInt16LE(offset);
    offset += 2;
    if (
      expectedSellerFeeBasisPoints !== undefined &&
      sellerFeeBasisPoints !== expectedSellerFeeBasisPoints
    ) {
      candidateError = "Metadata seller fee basis points mismatch";
      continue;
    }

    if (expectedCreators) {
      if (offset + 1 > data.length) {
        candidateError = "Could not parse metadata creators option";
        continue;
      }
      const hasCreators = data.readUInt8(offset);
      offset += 1;
      if (hasCreators !== 1) {
        candidateError = "Metadata creators must be present";
        continue;
      }
      if (offset + 4 > data.length) {
        candidateError = "Could not parse metadata creators length";
        continue;
      }
      const creatorsLen = data.readUInt32LE(offset);
      offset += 4;
      if (creatorsLen !== expectedCreators.length) {
        candidateError = "Metadata creators list length mismatch";
        continue;
      }
      let creatorsOk = true;
      for (let i = 0; i < creatorsLen; i++) {
        const creator = readBorshPubkey(data, offset);
        if (!creator) {
          candidateError = "Could not parse metadata creator address";
          creatorsOk = false;
          break;
        }
        offset = creator.next;
        if (offset + 2 > data.length) {
          candidateError = "Could not parse metadata creator flags";
          creatorsOk = false;
          break;
        }
        const verified = data.readUInt8(offset) === 1;
        const share = data.readUInt8(offset + 1);
        offset += 2;
        const expectedCreator = expectedCreators[i];
        if (!expectedCreator) {
          candidateError = "Unexpected metadata creator entry";
          creatorsOk = false;
          break;
        }
        if (
          creator.value !== expectedCreator.address ||
          verified !== expectedCreator.verified ||
          share !== expectedCreator.share
        ) {
          candidateError = "Metadata creators mismatch";
          creatorsOk = false;
          break;
        }
      }
      if (!creatorsOk) continue;
    }

    if (expectedName && nameField.value !== expectedName) {
      candidateError = "Metadata name mismatch";
      continue;
    }
    if (symbolField.value !== expectedSymbol) {
      candidateError = "Metadata symbol mismatch";
      continue;
    }
    if (uriField.value !== expectedMetadataUri) {
      candidateError = "Metadata URI mismatch";
      continue;
    }

    return { ok: true };
  }

  if (!sawTokenMetadataProgram) {
    return {
      ok: false,
      error: `Required program ${expectedTokenMetadataProgramId} not invoked in transaction`,
    };
  }

  return { ok: false, error: candidateError };
}

/**
 * Verify the transaction contains the expected core NFT minting instructions:
 * System create mint account, SPL InitializeMint + MintTo(1), ATA creation,
 * and Metaplex CreateMasterEditionV3. This strongly constrains the tx shape
 * without relying on client-submitted details alone.
 */
export function verifyNftMintCoreInstructions(
  params: VerifyNftMintCoreInstructionParams
): VerifyNftMintCoreInstructionResult {
  const {
    message,
    expectedWallet,
    expectedMintAddress,
    expectedAssociatedTokenAddress,
    expectedMetadataAddress,
    expectedMasterEditionAddress,
    expectedSystemProgramId,
    expectedTokenProgramId,
    expectedAssociatedTokenProgramId,
    expectedTokenMetadataProgramId,
  } = params;

  const accountKeys = message.getAccountKeys();
  const instructions = getInstructions(message);
  let sawCreateMint = false;
  let sawInitializeMint = false;
  let sawCreateAta = false;
  let sawMintTo = false;
  let sawCreateMetadata = false;
  let sawCreateMasterEdition = false;

  for (const ix of instructions) {
    const programId = accountKeys.get(ix.programIdIndex)?.toBase58();
    if (!programId) {
      return { ok: false, error: "Instruction references missing program account" };
    }

    if (programId === COMPUTE_BUDGET_PROGRAM_ID) {
      continue;
    }

    if (programId === expectedSystemProgramId) {
      const error = verifySystemCreateMintAccountInstruction({
        ix,
        accountKeys,
        expectedWallet,
        expectedMintAddress,
        expectedTokenProgramId,
      });
      if (error) return { ok: false, error };
      if (sawCreateMint) return { ok: false, error: "Duplicate mint account creation instruction" };
      sawCreateMint = true;
      continue;
    }

    if (programId === expectedAssociatedTokenProgramId) {
      const error = verifyAssociatedTokenCreateInstruction({
        ix,
        accountKeys,
        expectedWallet,
        expectedMintAddress,
        expectedAssociatedTokenAddress,
        expectedSystemProgramId,
        expectedTokenProgramId,
      });
      if (error) return { ok: false, error };
      if (sawCreateAta) return { ok: false, error: "Duplicate associated token account creation instruction" };
      sawCreateAta = true;
      continue;
    }

    if (programId === expectedTokenProgramId) {
      const dataBytes = decodeIxData(ix.data);
      if (!dataBytes || dataBytes.length < 1) {
        return { ok: false, error: "SPL Token instruction data could not be decoded" };
      }
      const discriminator = dataBytes[0];
      if (discriminator === 0) {
        const error = verifyTokenInitializeMintInstruction({
          ix,
          accountKeys,
          expectedWallet,
          expectedMintAddress,
        });
        if (error) return { ok: false, error };
        if (sawInitializeMint) return { ok: false, error: "Duplicate InitializeMint instruction" };
        sawInitializeMint = true;
        continue;
      }
      if (discriminator === 7) {
        const error = verifyTokenMintToInstruction({
          ix,
          accountKeys,
          expectedWallet,
          expectedMintAddress,
          expectedAssociatedTokenAddress,
        });
        if (error) return { ok: false, error };
        if (sawMintTo) return { ok: false, error: "Duplicate MintTo instruction" };
        sawMintTo = true;
        continue;
      }
      return { ok: false, error: `Unexpected SPL Token instruction discriminator ${discriminator}` };
    }

    if (programId === expectedTokenMetadataProgramId) {
      const dataBytes = decodeIxData(ix.data);
      if (!dataBytes || dataBytes.length < 1) {
        return { ok: false, error: "Token Metadata instruction data could not be decoded" };
      }
      const discriminator = dataBytes[0];
      if (discriminator === 33) {
        if (sawCreateMetadata) {
          return { ok: false, error: "Duplicate CreateMetadataAccountV3 instruction" };
        }
        sawCreateMetadata = true;
        continue;
      }
      if (discriminator === 17) {
        const error = verifyCreateMasterEditionV3Instruction({
          ix,
          accountKeys,
          expectedWallet,
          expectedMintAddress,
          expectedMetadataAddress,
          expectedMasterEditionAddress,
          expectedTokenProgramId,
          expectedSystemProgramId,
        });
        if (error) return { ok: false, error };
        if (sawCreateMasterEdition) {
          return { ok: false, error: "Duplicate CreateMasterEditionV3 instruction" };
        }
        sawCreateMasterEdition = true;
        continue;
      }
      return { ok: false, error: `Unexpected Token Metadata instruction discriminator ${discriminator}` };
    }

    return { ok: false, error: `Unexpected program invoked in mint tx: ${programId}` };
  }

  if (!sawCreateMint) return { ok: false, error: "Missing mint account creation instruction" };
  if (!sawInitializeMint) return { ok: false, error: "Missing InitializeMint instruction" };
  if (!sawCreateAta) return { ok: false, error: "Missing associated token account creation instruction" };
  if (!sawMintTo) return { ok: false, error: "Missing MintTo instruction" };
  if (!sawCreateMetadata) return { ok: false, error: "Missing CreateMetadataAccountV3 instruction" };
  if (!sawCreateMasterEdition) return { ok: false, error: "Missing CreateMasterEditionV3 instruction" };

  return { ok: true };
}
