import { Connection } from "@solana/web3.js";

const MAX_TX_AGE_SECONDS = 600; // 10 minutes

function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  return new Connection(rpcUrl, "confirmed");
}

export interface TxVerifyResult {
  valid: boolean;
  error?: string;
}

/**
 * Verify a Solana transaction signature:
 * 1. Signature exists and is confirmed/finalized
 * 2. Fee payer matches the expected wallet
 * 3. Transaction is recent (< 10 minutes)
 * 4. Transaction references the expected mint address (if provided)
 *
 * ALWAYS fails closed on any error — never returns valid:true on failure.
 */
export async function verifyTransaction(
  txSignature: string,
  expectedWallet: string,
  expectedMintAddress?: string
): Promise<TxVerifyResult> {
  try {
    const connection = getConnection();

    // Fetch the transaction
    const tx = await connection.getTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
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

    const ageSeconds = Math.floor(Date.now() / 1000) - tx.blockTime;
    if (ageSeconds > MAX_TX_AGE_SECONDS) {
      return {
        valid: false,
        error: `Transaction too old (${ageSeconds}s ago, max ${MAX_TX_AGE_SECONDS}s)`,
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

    // If a mint address is expected, verify it appears in the account keys
    if (expectedMintAddress) {
      let found = false;
      for (let i = 0; i < accountKeys.length; i++) {
        if (accountKeys.get(i)?.toBase58() === expectedMintAddress) {
          found = true;
          break;
        }
      }
      if (!found) {
        return {
          valid: false,
          error: `Mint address ${expectedMintAddress} not referenced in transaction`,
        };
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
