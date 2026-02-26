/**
 * Solana Transaction Verification
 * 
 * Verifies transaction signatures on-chain with automatic RPC failover.
 */

import { getConnection } from "./rpc";
import type { Finality } from "@solana/web3.js";

const MAX_TX_AGE_SECONDS = 600; // 10 minutes

export interface TxVerifyResult {
  valid: boolean;
  error?: string;
}

export interface TxVerifyOptions {
  commitment?: Finality;
  maxTxAgeSeconds?: number;
}

/**
 * Verify a Solana transaction signature:
 * 1. Signature exists and is confirmed/finalized
 * 2. Fee payer matches the expected wallet
 * 3. Transaction is recent (< 10 minutes)
 * 4. Transaction references the expected mint address (if provided)
 *
 * ALWAYS fails closed on any error — never returns valid:true on failure.
 * 
 * Uses the global RPC manager for automatic failover.
 */
export async function verifyTransaction(
  txSignature: string,
  expectedWallet: string,
  expectedMintAddress?: string,
  requiredAccountAddresses: string[] = [],
  requiredProgramIds: string[] = [],
  options: TxVerifyOptions = {}
): Promise<TxVerifyResult> {
  try {
    // Use the RPC manager for automatic failover
    const connection = getConnection();

    // Fetch the transaction
    const tx = await connection.getTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: options.commitment,
    });

    if (!tx) {
      return { valid: false, error: "Transaction not found on-chain" };
    }

    if (tx.meta?.err) {
      return { valid: false, error: "Transaction failed on-chain" };
    }

    // Verify block time is available and recent — fail closed if null
    if (!tx.blockTime) {
      return { valid: false, error: "Block time unavailable — cannot verify recency" };
    }

    const maxTxAgeSeconds = options.maxTxAgeSeconds ?? MAX_TX_AGE_SECONDS;
    const ageSeconds = Math.floor(Date.now() / 1000) - tx.blockTime;
    if (ageSeconds > maxTxAgeSeconds) {
      return {
        valid: false,
        error: `Transaction too old (${ageSeconds}s ago, max ${maxTxAgeSeconds}s)`,
      };
    }

    // Verify fee payer / signer matches expected wallet
    const accountKeys = tx.transaction.message.getAccountKeys();
    const feePayer = accountKeys.get(0)?.toBase58();

    if (feePayer !== expectedWallet) {
      return {
        valid: false,
        error: `Fee payer ${feePayer} does not match expected wallet ${expectedWallet}`,
      };
    }

    const accountKeyStrings: string[] = [];
    for (let i = 0; i < accountKeys.length; i++) {
      const key = accountKeys.get(i)?.toBase58();
      if (key) accountKeyStrings.push(key);
    }

    // If a mint address is expected, verify it appears in the account keys
    if (expectedMintAddress && !accountKeyStrings.includes(expectedMintAddress)) {
      return {
        valid: false,
        error: `Mint address ${expectedMintAddress} not referenced in transaction`,
      };
    }

    for (const requiredAddress of requiredAccountAddresses) {
      if (!accountKeyStrings.includes(requiredAddress)) {
        return {
          valid: false,
          error: `Required account ${requiredAddress} not referenced in transaction`,
        };
      }
    }

    if (requiredProgramIds.length > 0) {
      const message = tx.transaction.message as unknown as {
        compiledInstructions?: Array<{ programIdIndex: number }>;
        instructions?: Array<{ programIdIndex: number }>;
      };
      const compiledInstructions =
        message.compiledInstructions ?? message.instructions ?? [];

      for (const requiredProgramId of requiredProgramIds) {
        const invoked = compiledInstructions.some((ix) => {
          const programKey = accountKeys.get(ix.programIdIndex)?.toBase58();
          return programKey === requiredProgramId;
        });

        if (!invoked) {
          return {
            valid: false,
            error: `Required program ${requiredProgramId} not invoked in transaction`,
          };
        }
      }
    }

    return { valid: true };
  } catch (err) {
    // FAIL CLOSED on any error — never return valid:true
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("TX verification error:", message);
    return { valid: false, error: `Verification failed: ${message}` };
  }
}
