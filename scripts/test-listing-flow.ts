#!/usr/bin/env ts-node
/**
 * Manual Testing Script for Exchange Art Listing Flow
 * 
 * This script helps test the listing APIs manually.
 * 
 * Usage:
 *   pnpm ts-node scripts/test-listing-flow.ts prepare <mint-address> <price-sol>
 *   pnpm ts-node scripts/test-listing-flow.ts confirm <mint-address> <tx-signature> <sale-state-key>
 * 
 * Example:
 *   pnpm ts-node scripts/test-listing-flow.ts prepare ABC123... 0.01
 */

import fetch from "node-fetch";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

interface PrepareResponse {
  success: boolean;
  prepared?: {
    serializedTransaction: string;
    saleStatePublicKey: string;
    saleStateSecretKey: string;
    blockhash: string;
    lastValidBlockHeight: number;
    estimatedFee: number;
    expiresAt: string;
  };
  listing?: {
    mintAddress: string;
    priceLamports: string;
    priceSol: number;
  };
  error?: string;
  code?: string;
}

interface ConfirmResponse {
  success: boolean;
  listing?: {
    mintAddress: string;
    priceLamports: string;
    priceSol: number;
    status: string;
    txSignature: string | null;
    saleStateKey: string | null;
  };
  error?: string;
  code?: string;
}

async function testPrepare(mintAddress: string, priceSol: string) {
  console.log("\n=== Testing POST /api/listing/prepare ===");
  console.log(`Mint: ${mintAddress}`);
  console.log(`Price: ${priceSol} SOL`);

  const priceLamports = Math.floor(parseFloat(priceSol) * 1e9).toString();

  try {
    const response = await fetch(`${BASE_URL}/api/listing/prepare`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mintAddress,
        priceLamports,
      }),
    });

    console.log(`\nStatus: ${response.status}`);
    
    const data = await response.json() as PrepareResponse;
    
    if (response.ok && data.success) {
      console.log("\n✅ Preparation successful!");
      console.log("\nPrepared transaction:");
      console.log(`  Transaction (base64): ${data.prepared!.serializedTransaction.slice(0, 50)}...`);
      console.log(`  Sale State Public Key: ${data.prepared!.saleStatePublicKey}`);
      console.log(`  Sale State Secret Key: ${data.prepared!.saleStateSecretKey.slice(0, 30)}...`);
      console.log(`  Blockhash: ${data.prepared!.blockhash}`);
      console.log(`  Last Valid Block Height: ${data.prepared!.lastValidBlockHeight}`);
      console.log(`  Estimated Fee: ${data.prepared!.estimatedFee} lamports`);
      console.log(`  Expires At: ${data.prepared!.expiresAt}`);
      console.log("\nListing details:");
      console.log(`  Mint: ${data.listing!.mintAddress}`);
      console.log(`  Price: ${data.listing!.priceSol} SOL`);
      
      return data.prepared;
    } else {
      console.log("\n❌ Preparation failed:");
      console.log(`  Error: ${data.error}`);
      if (data.code) console.log(`  Code: ${data.code}`);
      return null;
    }
  } catch (error) {
    console.error("\n💥 Request failed:", error);
    return null;
  }
}

async function testConfirm(
  mintAddress: string,
  txSignature: string,
  saleStateKey: string
) {
  console.log("\n=== Testing POST /api/listing/confirm ===");
  console.log(`Mint: ${mintAddress}`);
  console.log(`Transaction: ${txSignature}`);
  console.log(`Sale State Key: ${saleStateKey}`);

  try {
    const response = await fetch(`${BASE_URL}/api/listing/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mintAddress,
        txSignature,
        saleStateKey,
      }),
    });

    console.log(`\nStatus: ${response.status}`);
    
    const data = await response.json() as ConfirmResponse;
    
    if (response.ok && data.success) {
      console.log("\n✅ Confirmation successful!");
      console.log("\nListing activated:");
      console.log(`  Mint: ${data.listing!.mintAddress}`);
      console.log(`  Price: ${data.listing!.priceSol} SOL`);
      console.log(`  Status: ${data.listing!.status}`);
      console.log(`  Transaction: ${data.listing!.txSignature}`);
      console.log(`  Sale State: ${data.listing!.saleStateKey}`);
      return true;
    } else {
      console.log("\n❌ Confirmation failed:");
      console.log(`  Error: ${data.error}`);
      if (data.code) console.log(`  Code: ${data.code}`);
      
      if (response.status === 202) {
        console.log("\n⏳ Transaction is still processing. Try again in a few seconds.");
      }
      return false;
    }
  } catch (error) {
    console.error("\n💥 Request failed:", error);
    return false;
  }
}

async function testHealth() {
  console.log("\n=== Testing Server Health ===");
  
  try {
    const response = await fetch(`${BASE_URL}/api/health`, {
      method: "GET",
    });

    if (response.status === 200) {
      console.log("✅ Server is running");
      return true;
    } else {
      console.log(`⚠️  Server returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error("❌ Server is not running:", error);
    console.log(`\nMake sure the server is running on ${BASE_URL}`);
    console.log("Run: pnpm dev");
    return false;
  }
}

// Main execution
async function main() {
  const [command, ...args] = process.argv.slice(2);

  console.log("ArtMint Studio - Listing Flow Test Script");
  console.log("=========================================\n");
  console.log(`Base URL: ${BASE_URL}`);

  // Check server health first
  const isHealthy = await testHealth();
  if (!isHealthy) {
    process.exit(1);
  }

  switch (command) {
    case "prepare": {
      const [mintAddress, priceSol] = args;
      if (!mintAddress || !priceSol) {
        console.log("\nUsage: prepare <mint-address> <price-sol>");
        console.log("Example: prepare ABC123... 0.01");
        process.exit(1);
      }
      await testPrepare(mintAddress, priceSol);
      break;
    }

    case "confirm": {
      const [mintAddress, txSignature, saleStateKey] = args;
      if (!mintAddress || !txSignature || !saleStateKey) {
        console.log("\nUsage: confirm <mint-address> <tx-signature> <sale-state-key>");
        console.log("Example: confirm ABC123... 5xyz... DEF123...");
        process.exit(1);
      }
      await testConfirm(mintAddress, txSignature, saleStateKey);
      break;
    }

    default:
      console.log("\nCommands:");
      console.log("  prepare <mint-address> <price-sol>  - Test listing preparation");
      console.log("  confirm <mint> <tx-sig> <sale-key>  - Test listing confirmation");
      console.log("  health                              - Check server health");
      console.log("\nEnvironment Variables:");
      console.log("  TEST_BASE_URL  - Server URL (default: http://localhost:3000)");
      break;
  }

  console.log("\nDone!\n");
}

main().catch(console.error);
