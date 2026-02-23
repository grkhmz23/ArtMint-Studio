/**
 * Solana Token Utilities
 * 
 * Helper functions for verifying token ownership and account states.
 * Uses the global RPC manager for automatic failover.
 */

import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import { getConnection } from "./rpc";

export interface TokenOwnershipResult {
  ownsToken: boolean;
  tokenAccount: PublicKey | null;
  balance: bigint;
  error?: string;
}

/**
 * Verify that a wallet owns at least one token of the specified mint.
 * 
 * Uses the global RPC manager for automatic failover.
 * 
 * @param wallet - Wallet public key
 * @param mintAddress - Mint address of the NFT/token
 * @returns TokenOwnershipResult with ownership status and details
 */
export async function verifyTokenOwnership(
  wallet: PublicKey,
  mintAddress: PublicKey
): Promise<TokenOwnershipResult> {
  try {
    // Use the RPC manager for automatic failover
    const connection = getConnection();

    // Derive the associated token account
    const tokenAccount = getAssociatedTokenAddressSync(
      mintAddress,
      wallet,
      false,
      TOKEN_PROGRAM_ID
    );

    try {
      // Fetch the token account
      const accountInfo = await getAccount(connection, tokenAccount);

      // Check balance
      const balance = accountInfo.amount;
      const ownsToken = balance > BigInt(0);

      return {
        ownsToken,
        tokenAccount,
        balance,
        error: ownsToken ? undefined : "Wallet does not own this NFT",
      };
    } catch (err) {
      // Token account doesn't exist
      return {
        ownsToken: false,
        tokenAccount: null,
        balance: BigInt(0),
        error: "Token account not found - wallet does not own this NFT",
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      ownsToken: false,
      tokenAccount: null,
      balance: BigInt(0),
      error: `Failed to verify ownership: ${message}`,
    };
  }
}

/**
 * Check if a token is already listed on Exchange Art.
 * This checks if the sale state account exists for the given mint.
 * 
 * @param mintAddress - Mint address to check
 * @returns boolean indicating if the NFT is listed
 */
export async function isTokenListed(
  mintAddress: PublicKey
): Promise<boolean> {
  try {
    // In a full implementation, this would check for existing sale state accounts
    // For now, we rely on the database check in the API route
    // TODO: Add on-chain check for existing Exchange Art listings
    return false;
  } catch {
    return false;
  }
}

/**
 * Get token metadata account info (basic check).
 * 
 * Uses the global RPC manager for automatic failover.
 * 
 * @param mintAddress - Mint address
 * @returns Whether the mint exists and is a valid NFT
 */
export async function validateNftMint(
  mintAddress: PublicKey
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Use the RPC manager for automatic failover
    const connection = getConnection();

    // Check if mint account exists
    const mintInfo = await connection.getAccountInfo(mintAddress);
    
    if (!mintInfo) {
      return { valid: false, error: "Mint account does not exist" };
    }

    // Check if it's a token mint (owned by token program)
    if (!mintInfo.owner.equals(TOKEN_PROGRAM_ID)) {
      return { valid: false, error: "Account is not a valid SPL token" };
    }

    // Basic size check for mint accounts
    if (mintInfo.data.length < 82) {
      return { valid: false, error: "Invalid mint account data" };
    }

    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { valid: false, error: `Validation failed: ${message}` };
  }
}
