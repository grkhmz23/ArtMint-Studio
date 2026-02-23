import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PROGRAM_IDS } from "./constants";
import { addPriorityFees, FeePresets } from "./fees";

/**
 * Build a Buy Now listing transaction using the Exchange Art Buy Now + Editions IDL.
 * Uses the `createBuynowSale` instruction from the editions_program_solana.
 */

export interface CreateBuyNowParams {
  connection: Connection;
  seller: PublicKey;
  mintAddress: PublicKey;
  priceLamports: bigint;
}

export interface CreateBuyNowResult {
  transaction: Transaction;
  saleStateKeypair: Keypair;
}

export interface PreparedListingTransaction {
  /** Serialized transaction (base64) - ready for partial signing */
  serializedTransaction: string;
  /** Sale state account public key */
  saleStatePublicKey: string;
  /** Sale state account secret key (base64) - client must sign with this */
  saleStateSecretKey: string;
  /** Blockhash used in transaction (for expiry checking) */
  blockhash: string;
  /** Block height at which transaction was prepared */
  lastValidBlockHeight: number;
  /** Estimated fee in lamports */
  estimatedFee: number;
}

export async function buildCreateBuyNowTransaction(
  params: CreateBuyNowParams
): Promise<CreateBuyNowResult> {
  const { connection, seller, mintAddress, priceLamports } = params;

  const saleStateKeypair = Keypair.generate();

  // Derive PDA for deposit authority
  const [pdaDepositAuthority, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("deposit_authority")],
    PROGRAM_IDS.buyNowEditions
  );

  // Seller's token account for the mint
  const sellerSourceTokenAccount = getAssociatedTokenAddressSync(
    mintAddress,
    seller,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Exchange Art deposit account (ATA of the PDA for this mint)
  const depositAccountAddress = getAssociatedTokenAddressSync(
    mintAddress,
    pdaDepositAuthority,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Build CreateBuyNowSaleIxData
  // struct: { bump: u8, price: u64, quantity: u16, start: u64, splTokenSettlement: bool, settlementMint: PublicKey }
  const data = Buffer.alloc(8 + 1 + 8 + 2 + 8 + 1 + 32); // discriminator + data
  let offset = 0;

  // Anchor discriminator for createBuynowSale
  // sha256("global:create_buynow_sale")[0..8]
  const discriminator = Buffer.from([
    0x7a, 0x27, 0xc1, 0xa1, 0xbb, 0x91, 0xce, 0xb7,
  ]);
  discriminator.copy(data, offset);
  offset += 8;

  // bump
  data.writeUInt8(bump, offset);
  offset += 1;

  // price (u64 LE)
  data.writeBigUInt64LE(priceLamports, offset);
  offset += 8;

  // quantity (u16 LE) - 1 for single NFT
  data.writeUInt16LE(1, offset);
  offset += 2;

  // start time (u64 LE) - 0 for immediate
  data.writeBigUInt64LE(BigInt(0), offset);
  offset += 8;

  // splTokenSettlement (bool) - false for SOL
  data.writeUInt8(0, offset);
  offset += 1;

  // settlementMint - SystemProgram (dummy for SOL)
  SystemProgram.programId.toBuffer().copy(data, offset);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: seller, isSigner: true, isWritable: true },
      { pubkey: sellerSourceTokenAccount, isSigner: false, isWritable: true },
      { pubkey: mintAddress, isSigner: false, isWritable: false },
      { pubkey: pdaDepositAuthority, isSigner: false, isWritable: false },
      { pubkey: saleStateKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: depositAccountAddress, isSigner: false, isWritable: true },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_IDS.buyNowEditions,
    data: data.subarray(0, offset + 32),
  });

  const transaction = new Transaction().add(ix);
  transaction.feePayer = seller;

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  // Add priority fees for reliable mainnet processing
  await addPriorityFees(transaction, FeePresets.listing, connection);

  return {
    transaction,
    saleStateKeypair,
  };
}

/**
 * Prepare a listing transaction for client-side signing.
 * 
 * This function builds the transaction and serializes it along with the
 * sale state keypair data that the client needs to sign.
 * 
 * @param params - Parameters for creating the listing
 * @returns Prepared transaction ready for client signing
 */
export async function prepareListingTransaction(
  params: CreateBuyNowParams
): Promise<PreparedListingTransaction> {
  const { connection } = params;

  // Build the transaction
  const { transaction, saleStateKeypair } = await buildCreateBuyNowTransaction(params);

  // Get fresh blockhash info
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  
  // Update blockhash
  transaction.recentBlockhash = blockhash;

  // Get fee estimate
  let estimatedFee = 5000; // Default fallback
  try {
    const fee = await connection.getFeeForMessage(transaction.compileMessage());
    if (fee.value !== null) {
      estimatedFee = fee.value;
    }
  } catch {
    // Use default if fee estimation fails
  }

  // Partially sign with the sale state keypair
  transaction.partialSign(saleStateKeypair);

  // Serialize the transaction
  const serializedTransaction = Buffer.from(
    transaction.serialize({ requireAllSignatures: false })
  ).toString("base64");

  return {
    serializedTransaction,
    saleStatePublicKey: saleStateKeypair.publicKey.toBase58(),
    saleStateSecretKey: Buffer.from(saleStateKeypair.secretKey).toString("base64"),
    blockhash,
    lastValidBlockHeight,
    estimatedFee,
  };
}
