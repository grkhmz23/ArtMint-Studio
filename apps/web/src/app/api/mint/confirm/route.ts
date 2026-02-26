import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Prisma } from "@prisma/client";
import { PROGRAM_IDS } from "@artmint/exchangeart";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { verifyTransaction } from "@/lib/solana-verify";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getConnection } from "@/lib/rpc";
import {
  verifyCreateMetadataV3Instruction,
  verifyNftMintCoreInstructions,
} from "@/lib/metaplex-mint-verify";

export const dynamic = "force-dynamic";

const confirmSchema = z.object({
  placeholderMintAddress: z.string().min(1),
  mintAddress: z.string().min(32).max(50),
  txSignature: z.string().min(64).max(128),
});

export async function POST(req: NextRequest) {
  try {
    // Auth — wallet comes from session
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    // Rate limit: 10 req/min per IP
    const clientIp = getClientIp(req);
    const ipLimit = await checkRateLimit(`confirm:ip:${clientIp}`, 10, 60_000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(ipLimit.resetMs / 1000)) } }
      );
    }

    const body = await req.json();
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const { placeholderMintAddress, mintAddress, txSignature } = parsed.data;

    // Check for TX signature replay — reject if already used
    const existingTx = await prisma.mint.findFirst({
      where: { txSignature },
    });
    if (existingTx) {
      return NextResponse.json(
        { error: "Transaction signature already used for another mint" },
        { status: 409 }
      );
    }

    // Verify the pending mint exists and belongs to the session wallet
    const existingMint = await prisma.mint.findUnique({
      where: { mintAddress: placeholderMintAddress },
    });

    if (!existingMint) {
      return NextResponse.json(
        { error: "Pending mint not found" },
        { status: 404 }
      );
    }

    if (existingMint.wallet !== wallet) {
      return NextResponse.json(
        { error: "Wallet does not match the original creator" },
        { status: 403 }
      );
    }

    if (existingMint.status === "confirmed") {
      return NextResponse.json(
        { error: "Mint already confirmed" },
        { status: 409 }
      );
    }

    let mintPubkey: PublicKey;
    let walletPubkey: PublicKey;
    try {
      mintPubkey = new PublicKey(mintAddress);
      walletPubkey = new PublicKey(wallet);
    } catch {
      return NextResponse.json({ error: "Invalid mint or wallet address" }, { status: 400 });
    }

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
      walletPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Verify the transaction on-chain
    const txResult = await verifyTransaction(
      txSignature,
      wallet,
      mintAddress,
      [
        metadataPda.toBase58(),
        masterEditionPda.toBase58(),
      ],
      [
        PROGRAM_IDS.tokenMetadata.toBase58(),
        TOKEN_PROGRAM_ID.toBase58(),
        ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
        SystemProgram.programId.toBase58(),
      ],
      { commitment: "finalized" }
    );
    if (!txResult.valid) {
      return NextResponse.json(
        { error: txResult.error || "Transaction verification failed" },
        { status: 400 }
      );
    }

    const connection = getConnection();
    try {
      const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
        commitment: "finalized",
      });

      if (!tx) {
        return NextResponse.json(
          { error: "Transaction not found during deep verification" },
          { status: 503 }
        );
      }

      const coreMintCheck = verifyNftMintCoreInstructions({
        message: tx.transaction.message as Parameters<typeof verifyNftMintCoreInstructions>[0]["message"],
        expectedWallet: wallet,
        expectedMintAddress: mintAddress,
        expectedAssociatedTokenAddress: associatedTokenAccount.toBase58(),
        expectedMetadataAddress: metadataPda.toBase58(),
        expectedMasterEditionAddress: masterEditionPda.toBase58(),
        expectedSystemProgramId: SystemProgram.programId.toBase58(),
        expectedTokenProgramId: TOKEN_PROGRAM_ID.toBase58(),
        expectedAssociatedTokenProgramId: ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
        expectedTokenMetadataProgramId: PROGRAM_IDS.tokenMetadata.toBase58(),
      });

      if (!coreMintCheck.ok) {
        return NextResponse.json(
          { error: coreMintCheck.error || "Core mint instruction verification failed" },
          { status: 400 }
        );
      }

      const metadataCheck = verifyCreateMetadataV3Instruction({
        message: tx.transaction.message as Parameters<typeof verifyCreateMetadataV3Instruction>[0]["message"],
        expectedTokenMetadataProgramId: PROGRAM_IDS.tokenMetadata.toBase58(),
        expectedWallet: wallet,
        expectedMintAddress: mintAddress,
        expectedMetadataUri: existingMint.metadataUrl,
        expectedMetadataAddress: metadataPda.toBase58(),
        expectedName: existingMint.title,
        expectedSymbol: "ARTMINT",
        expectedSellerFeeBasisPoints: 500,
        expectedCreators: [{ address: wallet, verified: true, share: 100 }],
      });

      if (!metadataCheck.ok) {
        return NextResponse.json(
          { error: metadataCheck.error || "Metadata instruction verification failed" },
          { status: 400 }
        );
      }
    } catch (err) {
      console.error("Mint deep verification error:", err instanceof Error ? err.message : err);
      return NextResponse.json(
        { error: "Failed to deeply verify mint transaction" },
        { status: 503 }
      );
    }

    // Atomically update — set real mint address, tx signature, and status
    try {
      await prisma.mint.update({
        where: { mintAddress: placeholderMintAddress },
        data: {
          mintAddress,
          txSignature,
          status: "confirmed",
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Transaction signature or mint address already used" },
          { status: 409 }
        );
      }
      throw err;
    }

    // Log activity
    await prisma.activity.create({
      data: {
        type: "mint",
        wallet,
        mintAddress,
      },
    });

    return NextResponse.json({ success: true, mintAddress });
  } catch (err) {
    console.error("Mint confirm error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Confirmation failed" }, { status: 500 });
  }
}
