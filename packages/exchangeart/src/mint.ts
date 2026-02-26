import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { BN, Program } from "@coral-xyz/anchor";
import { PROGRAM_IDS, CODE_CANVAS_FEE_RECIPIENT, CODE_CANVAS_UPDATE_AUTH } from "./constants";
import { loadCodeCanvasIdl } from "./idl";
import { addPriorityFees, FeePresets } from "./fees";

/**
 * For the MVP, we build a simplified mint transaction.
 *
 * The Code Canvas program's mintNft instruction requires a pre-existing drop (collection).
 * In a real deployment, the app would be associated with an existing Code Canvas drop.
 * For the MVP, we use Metaplex's standard Token Metadata program to mint the NFT directly,
 * and record the Code Canvas program ID in the metadata for provenance.
 *
 * This approach mints a standard Metaplex NFT with all the deterministic art metadata,
 * which is compatible with Exchange Art's marketplace.
 */

export interface MintNftParams {
  connection: Connection;
  payer: PublicKey;
  metadataUri: string;
  name: string;
  symbol?: string;
  sellerFeeBasisPoints?: number;
}

export interface MintNftResult {
  transaction: Transaction;
  mintKeypair: Keypair;
  mintAddress: PublicKey;
}

export interface PreparedMintNftTransaction {
  /** Serialized transaction (base64) - ready for wallet signing */
  serializedTransaction: string;
  /** Mint public key that will be created by this transaction */
  mintAddress: string;
  /** Blockhash used in transaction (for expiry checking) */
  blockhash: string;
  /** Block height at which transaction was prepared */
  lastValidBlockHeight: number;
  /** Estimated fee in lamports */
  estimatedFee: number;
}

export class MintMetadataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MintMetadataValidationError";
  }
}

const METAPLEX_METADATA_LIMITS = {
  nameBytes: 32,
  symbolBytes: 10,
  uriBytes: 200,
} as const;

function assertUtf8ByteLength(field: string, value: string, maxBytes: number): void {
  const length = Buffer.byteLength(value, "utf8");
  if (length > maxBytes) {
    throw new MintMetadataValidationError(
      `${field} exceeds Metaplex limit (${length} bytes > ${maxBytes} bytes)`
    );
  }
}

function assertValidHttpMetadataUri(uri: string): void {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new MintMetadataValidationError("Metadata URI must be an absolute URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new MintMetadataValidationError("Metadata URI must use http:// or https://");
  }
}

function validateMetaplexMetadataFields(params: { name: string; symbol: string; metadataUri: string }): void {
  const { name, symbol, metadataUri } = params;
  assertUtf8ByteLength("Metadata name", name, METAPLEX_METADATA_LIMITS.nameBytes);
  assertUtf8ByteLength("Metadata symbol", symbol, METAPLEX_METADATA_LIMITS.symbolBytes);
  assertUtf8ByteLength("Metadata URI", metadataUri, METAPLEX_METADATA_LIMITS.uriBytes);
  assertValidHttpMetadataUri(metadataUri);
}

/**
 * Build a transaction to mint an NFT using Metaplex Token Metadata standard.
 * The metadata JSON at metadataUri contains the Exchange Art / Code Canvas provenance info.
 */
export async function buildMintNftTransaction(
  params: MintNftParams
): Promise<MintNftResult> {
  const {
    connection,
    payer,
    metadataUri,
    name,
    symbol = "ARTMINT",
    sellerFeeBasisPoints = 500,
  } = params;

  validateMetaplexMetadataFields({ name, symbol, metadataUri });

  const mintKeypair = Keypair.generate();
  const mintPubkey = mintKeypair.publicKey;

  // Derive PDAs
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      PROGRAM_IDS.tokenMetadata.toBuffer(),
      mintPubkey.toBuffer(),
    ],
    PROGRAM_IDS.tokenMetadata
  );

  const [masterEditionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      PROGRAM_IDS.tokenMetadata.toBuffer(),
      mintPubkey.toBuffer(),
      Buffer.from("edition"),
    ],
    PROGRAM_IDS.tokenMetadata
  );

  const associatedTokenAccount = getAssociatedTokenAddressSync(
    mintPubkey,
    payer,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Build the instructions:
  // 1. Create mint account
  // 2. Initialize mint
  // 3. Create associated token account
  // 4. Mint to token account
  // 5. Create metadata
  // 6. Create master edition

  const lamports = await connection.getMinimumBalanceForRentExemption(82);

  const createMintAccountIx = SystemProgram.createAccount({
    fromPubkey: payer,
    newAccountPubkey: mintPubkey,
    lamports,
    space: 82,
    programId: TOKEN_PROGRAM_ID,
  });

  // Initialize Mint instruction (manual since we can't use spl-token createInitializeMintInstruction directly in all cases)
  const initMintIx = createInitializeMintIx(mintPubkey, payer);

  // Create ATA
  const createAtaIx = createAssociatedTokenAccountIx(payer, associatedTokenAccount, payer, mintPubkey);

  // Mint to
  const mintToIx = createMintToIx(mintPubkey, associatedTokenAccount, payer, 1);

  // Create Metadata v3
  const createMetadataIx = createMetadataV3Ix({
    metadata: metadataPda,
    mint: mintPubkey,
    mintAuthority: payer,
    payer,
    updateAuthority: payer,
    name,
    symbol,
    uri: metadataUri,
    sellerFeeBasisPoints,
    creators: [{ address: payer, verified: true, share: 100 }],
  });

  // Create Master Edition
  const createMasterEditionIx = createMasterEditionV3Ix({
    edition: masterEditionPda,
    mint: mintPubkey,
    updateAuthority: payer,
    mintAuthority: payer,
    metadata: metadataPda,
    payer,
    maxSupply: 0,
  });

  const transaction = new Transaction();
  transaction.add(
    createMintAccountIx,
    initMintIx,
    createAtaIx,
    mintToIx,
    createMetadataIx,
    createMasterEditionIx
  );
  transaction.feePayer = payer;

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  // Add priority fees for reliable mainnet processing
  await addPriorityFees(transaction, FeePresets.mint, connection);

  return {
    transaction,
    mintKeypair,
    mintAddress: mintPubkey,
  };
}

/**
 * Prepare a mint transaction for client-side wallet signing.
 * The server generates and partially signs the mint account keypair,
 * then returns a serialized transaction and the resulting mint address.
 */
export async function prepareMintNftTransaction(
  params: MintNftParams
): Promise<PreparedMintNftTransaction> {
  const { connection } = params;
  const { transaction, mintKeypair, mintAddress } = await buildMintNftTransaction(params);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  let estimatedFee = 5000;
  try {
    const fee = await connection.getFeeForMessage(transaction.compileMessage());
    if (fee.value !== null) {
      estimatedFee = fee.value;
    }
  } catch {
    // fall back to default fee estimate
  }

  transaction.partialSign(mintKeypair);

  const serializedTransaction = Buffer.from(
    transaction.serialize({ requireAllSignatures: false })
  ).toString("base64");

  return {
    serializedTransaction,
    mintAddress: mintAddress.toBase58(),
    blockhash,
    lastValidBlockHeight,
    estimatedFee,
  };
}

// Helper: Token Metadata Program instruction builders

function createInitializeMintIx(mint: PublicKey, authority: PublicKey): TransactionInstruction {
  // InitializeMint instruction for Token program
  const data = Buffer.alloc(67);
  data.writeUInt8(0, 0); // InitializeMint instruction
  data.writeUInt8(0, 1); // decimals
  authority.toBuffer().copy(data, 2);
  data.writeUInt8(1, 34); // has freeze authority
  authority.toBuffer().copy(data, 35);

  return new TransactionInstruction({
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}

function createAssociatedTokenAccountIx(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0),
  });
}

function createMintToIx(
  mint: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  amount: number
): TransactionInstruction {
  const data = Buffer.alloc(9);
  data.writeUInt8(7, 0); // MintTo instruction
  data.writeBigUInt64LE(BigInt(amount), 1);

  return new TransactionInstruction({
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}

interface CreateMetadataParams {
  metadata: PublicKey;
  mint: PublicKey;
  mintAuthority: PublicKey;
  payer: PublicKey;
  updateAuthority: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  creators: Array<{ address: PublicKey; verified: boolean; share: number }>;
}

function createMetadataV3Ix(params: CreateMetadataParams): TransactionInstruction {
  const {
    metadata,
    mint,
    mintAuthority,
    payer,
    updateAuthority,
    name,
    symbol,
    uri,
    sellerFeeBasisPoints,
    creators,
  } = params;

  // Serialize CreateMetadataAccountV3 instruction
  // Discriminator: 33 (CreateMetadataAccountV3)
  const nameBytes = Buffer.from(name);
  const symbolBytes = Buffer.from(symbol);
  const uriBytes = Buffer.from(uri);

  const buffers: Buffer[] = [];
  // Instruction discriminator
  buffers.push(Buffer.from([33]));
  // DataV2 struct:
  // name (borsh string: u32 len + bytes)
  const nameLenBuf = Buffer.alloc(4);
  nameLenBuf.writeUInt32LE(nameBytes.length);
  buffers.push(nameLenBuf);
  buffers.push(nameBytes);
  // symbol
  const symbolLenBuf = Buffer.alloc(4);
  symbolLenBuf.writeUInt32LE(symbolBytes.length);
  buffers.push(symbolLenBuf);
  buffers.push(symbolBytes);
  // uri
  const uriLenBuf = Buffer.alloc(4);
  uriLenBuf.writeUInt32LE(uriBytes.length);
  buffers.push(uriLenBuf);
  buffers.push(uriBytes);
  // seller_fee_basis_points
  const feeBuf = Buffer.alloc(2);
  feeBuf.writeUInt16LE(sellerFeeBasisPoints);
  buffers.push(feeBuf);
  // creators (Option<Vec<Creator>>)
  buffers.push(Buffer.from([1])); // Some
  const creatorsLenBuf = Buffer.alloc(4);
  creatorsLenBuf.writeUInt32LE(creators.length);
  buffers.push(creatorsLenBuf);
  for (const c of creators) {
    buffers.push(c.address.toBuffer());
    buffers.push(Buffer.from([c.verified ? 1 : 0]));
    buffers.push(Buffer.from([c.share]));
  }
  // collection (Option<Collection>) -> None
  buffers.push(Buffer.from([0]));
  // uses (Option<Uses>) -> None
  buffers.push(Buffer.from([0]));
  // isMutable
  buffers.push(Buffer.from([1]));
  // collectionDetails (Option) -> None
  buffers.push(Buffer.from([0]));

  const data = Buffer.concat(buffers);

  return new TransactionInstruction({
    keys: [
      { pubkey: metadata, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: mintAuthority, isSigner: true, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: updateAuthority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_IDS.tokenMetadata,
    data,
  });
}

interface CreateMasterEditionParams {
  edition: PublicKey;
  mint: PublicKey;
  updateAuthority: PublicKey;
  mintAuthority: PublicKey;
  metadata: PublicKey;
  payer: PublicKey;
  maxSupply: number;
}

function createMasterEditionV3Ix(params: CreateMasterEditionParams): TransactionInstruction {
  const { edition, mint, updateAuthority, mintAuthority, metadata, payer, maxSupply } = params;

  // CreateMasterEditionV3 discriminator: 17
  const data = Buffer.alloc(10);
  data.writeUInt8(17, 0); // instruction
  data.writeUInt8(1, 1); // Some(maxSupply)
  data.writeBigUInt64LE(BigInt(maxSupply), 2);

  return new TransactionInstruction({
    keys: [
      { pubkey: edition, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: updateAuthority, isSigner: true, isWritable: false },
      { pubkey: mintAuthority, isSigner: true, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: metadata, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_IDS.tokenMetadata,
    data,
  });
}
