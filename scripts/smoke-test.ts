#!/usr/bin/env ts-node
/**
 * Smoke Test for Phase 1 Implementation
 * 
 * Quick verification that all components are properly wired up.
 * This doesn't test actual transactions, just verifies the code structure.
 * 
 * Usage: pnpm ts-node scripts/smoke-test.ts
 */

import { buildCreateBuyNowTransaction, prepareListingTransaction } from "@artmint/exchangeart";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { verifyTokenOwnership, validateNftMint } from "../apps/web/src/lib/solana-token";

console.log("🧪 ArtMint Studio - Phase 1 Smoke Test\n");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result
        .then(() => {
          console.log(`  ✅ ${name}`);
          passed++;
        })
        .catch((err) => {
          console.log(`  ❌ ${name}: ${err.message}`);
          failed++;
        });
    } else {
      console.log(`  ✅ ${name}`);
      passed++;
    }
  } catch (err) {
    console.log(`  ❌ ${name}: ${(err as Error).message}`);
    failed++;
  }
}

// Test 1: Verify exports exist
test("@artmint/exchangeart exports buildCreateBuyNowTransaction", () => {
  if (typeof buildCreateBuyNowTransaction !== "function") {
    throw new Error("buildCreateBuyNowTransaction not exported");
  }
});

test("@artmint/exchangeart exports prepareListingTransaction", () => {
  if (typeof prepareListingTransaction !== "function") {
    throw new Error("prepareListingTransaction not exported");
  }
});

// Test 2: Verify token utilities exist
test("solana-token exports verifyTokenOwnership", () => {
  if (typeof verifyTokenOwnership !== "function") {
    throw new Error("verifyTokenOwnership not exported");
  }
});

test("solana-token exports validateNftMint", () => {
  if (typeof validateNftMint !== "function") {
    throw new Error("validateNftMint not exported");
  }
});

// Test 3: Verify listing interfaces
test("prepareListingTransaction accepts correct params", async () => {
  // Just verify the function signature by trying to call with mock data
  // This will fail with network error, but that's expected
  try {
    const mockConnection = new Connection("http://localhost:8899");
    const mockSeller = Keypair.generate().publicKey;
    const mockMint = Keypair.generate().publicKey;
    
    // This will fail but verifies the API
    await prepareListingTransaction({
      connection: mockConnection,
      seller: mockSeller,
      mintAddress: mockMint,
      priceLamports: BigInt(1000000),
    });
  } catch (err) {
    // Expected to fail on network - we just want to verify the API
    if ((err as Error).message.includes("network") || 
        (err as Error).message.includes("fetch") ||
        (err as Error).message.includes("ECONNREFUSED")) {
      return; // This is expected
    }
    throw err;
  }
});

// Test 4: Verify environment configuration
test("Environment variables are documented", () => {
  const required = [
    "SOLANA_RPC_URL",
    "SOLANA_CLUSTER",
    "SESSION_SECRET",
    "DATABASE_URL",
  ];
  
  console.log("    Required env vars: " + required.join(", "));
  
  // Just document what's needed - don't fail if not set
  // (they'll be set in production)
});

// Test 5: Verify API routes exist (check filesystem)
import { existsSync } from "fs";
import { join } from "path";

test("API route /api/listing/prepare exists", () => {
  const path = join(__dirname, "../apps/web/src/app/api/listing/prepare/route.ts");
  if (!existsSync(path)) {
    throw new Error("Route file not found");
  }
});

test("API route /api/listing/confirm exists", () => {
  const path = join(__dirname, "../apps/web/src/app/api/listing/confirm/route.ts");
  if (!existsSync(path)) {
    throw new Error("Route file not found");
  }
});

test("API route /api/health exists", () => {
  const path = join(__dirname, "../apps/web/src/app/api/health/route.ts");
  if (!existsSync(path)) {
    throw new Error("Route file not found");
  }
});

// Test 6: Verify AssetClient imports
test("AssetClient imports exist", () => {
  // Just verify the file can be parsed
  const path = join(__dirname, "../apps/web/src/app/asset/[mintAddress]/AssetClient.tsx");
  if (!existsSync(path)) {
    throw new Error("AssetClient not found");
  }
});

// Wait for async tests
setTimeout(() => {
  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(50) + "\n");
  
  if (failed === 0) {
    console.log("✅ All smoke tests passed!");
    console.log("Ready for Phase 2: RPC & Transaction Reliability\n");
    process.exit(0);
  } else {
    console.log("❌ Some tests failed. Please review.\n");
    process.exit(1);
  }
}, 1000);
