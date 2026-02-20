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
import { BN } from "@coral-xyz/anchor";
import { PROGRAM_IDS } from "./constants";

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

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  return {
    transaction,
    saleStateKeypair,
  };
}
