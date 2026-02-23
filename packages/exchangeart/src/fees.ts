/**
 * Transaction Fee Utilities
 * 
 * Adds compute unit limits and priority fees to transactions
 * for reliable processing during network congestion.
 * 
 * Environment Variables:
 *   PRIORITY_FEE_MICRO_LAMPORTS - Override default priority fee
 *   COMPUTE_UNIT_LIMIT_MINT - Override mint compute units
 *   COMPUTE_UNIT_LIMIT_LISTING - Override listing compute units
 *   DYNAMIC_PRIORITY_FEE - Set to "true" to enable dynamic fee fetching
 */

import {
  Transaction,
  ComputeBudgetProgram,
  Connection,
} from "@solana/web3.js";

export interface FeeOptions {
  /** Compute unit limit (default: 200000 for mint, 100000 for listing) */
  computeUnits?: number;
  /** Priority fee in micro-lamports (default: 5000 = 0.000005 SOL) */
  priorityFeeMicroLamports?: number;
  /** Get dynamic priority fee from recent chain data */
  useDynamicPriorityFee?: boolean;
}

/** Network types for fee configuration */
type NetworkType = "mainnet" | "devnet" | "localnet";

/**
 * Get current network type from environment
 */
function getNetworkType(): NetworkType {
  const cluster = (process.env.SOLANA_CLUSTER || "devnet").toLowerCase();
  if (cluster.includes("mainnet")) return "mainnet";
  if (cluster.includes("devnet")) return "devnet";
  return "localnet";
}

// Default values tuned for each network
const DEFAULTS = {
  mainnet: {
    computeUnitsMint: 200000,
    computeUnitsListing: 100000,
    priorityFeeMicroLamports: 5000, // 0.000005 SOL - higher for mainnet
  },
  devnet: {
    computeUnitsMint: 200000,
    computeUnitsListing: 100000,
    priorityFeeMicroLamports: 0, // No priority fee needed on devnet
  },
  localnet: {
    computeUnitsMint: 200000,
    computeUnitsListing: 100000,
    priorityFeeMicroLamports: 0,
  },
} as const;

// Get defaults for current network
function getNetworkDefaults() {
  return DEFAULTS[getNetworkType()];
}

/**
 * Get current priority fee estimate from the network
 * 
 * Uses the 75th percentile of recent prioritization fees
 * with a 20% buffer for reliability.
 * 
 * @param connection - Solana connection
 * @returns Recommended priority fee in micro-lamports
 */
export async function getPriorityFeeEstimate(
  connection: Connection
): Promise<number> {
  const defaults = getNetworkDefaults();
  
  try {
    // Get recent prioritization fees from the last 20 slots
    const recentFees = await connection.getRecentPrioritizationFees({
      lockedWritableAccounts: [],
    });

    if (recentFees.length === 0) {
      return defaults.priorityFeeMicroLamports;
    }

    // Calculate 75th percentile fee (aggressive but not excessive)
    const fees = recentFees
      .map((f) => f.prioritizationFee)
      .filter((f) => f > 0) // Filter out zero fees
      .sort((a, b) => a - b);
    
    if (fees.length === 0) {
      return defaults.priorityFeeMicroLamports;
    }
    
    const index = Math.floor(fees.length * 0.75);
    const percentileFee = fees[index] || fees[fees.length - 1];

    // Add 20% buffer
    const recommendedFee = Math.ceil(percentileFee * 1.2);

    // Cap at 0.001 SOL (1000000 micro-lamports) to prevent runaway fees
    const maxFee = 1000000;
    const result = Math.min(recommendedFee, maxFee);
    
    // Ensure minimum fee for mainnet
    if (getNetworkType() === "mainnet" && result < defaults.priorityFeeMicroLamports) {
      return defaults.priorityFeeMicroLamports;
    }
    
    return result;
  } catch (err) {
    console.warn("Failed to get priority fee estimate:", err);
    return defaults.priorityFeeMicroLamports;
  }
}

/**
 * Get compute unit limit from environment or default
 */
function getComputeUnitLimit(type: "mint" | "listing"): number {
  const defaults = getNetworkDefaults();
  const envVar = type === "mint" 
    ? process.env.COMPUTE_UNIT_LIMIT_MINT 
    : process.env.COMPUTE_UNIT_LIMIT_LISTING;
  
  if (envVar) {
    const parsed = parseInt(envVar, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  
  return type === "mint" 
    ? defaults.computeUnitsMint 
    : defaults.computeUnitsListing;
}

/**
 * Get priority fee from environment or default
 */
function getPriorityFee(): number {
  const defaults = getNetworkDefaults();
  const envFee = process.env.PRIORITY_FEE_MICRO_LAMPORTS;
  
  if (envFee) {
    const parsed = parseInt(envFee, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  
  return defaults.priorityFeeMicroLamports;
}

/**
 * Check if dynamic priority fees are enabled
 */
function isDynamicPriorityFeeEnabled(): boolean {
  return process.env.DYNAMIC_PRIORITY_FEE?.toLowerCase() === "true";
}

/**
 * Add compute unit limit and priority fee instructions to a transaction
 * 
 * Priority fee is added as the first instruction for optimal execution.
 * Compute unit limit is added to prevent excessive CU usage.
 * 
 * @param transaction - Transaction to modify
 * @param options - Fee configuration options
 * @param connection - Optional connection for dynamic fee fetching
 */
export async function addPriorityFees(
  transaction: Transaction,
  options: FeeOptions = {},
  connection?: Connection
): Promise<void> {
  const defaults = getNetworkDefaults();
  
  // Determine compute unit limit
  const computeUnits = options.computeUnits ?? getComputeUnitLimit("mint");
  
  // Determine priority fee
  let fee = options.priorityFeeMicroLamports ?? getPriorityFee();

  // If dynamic fee requested and connection available, fetch from chain
  const useDynamic = options.useDynamicPriorityFee ?? isDynamicPriorityFeeEnabled();
  if (useDynamic && connection && getNetworkType() === "mainnet") {
    fee = await getPriorityFeeEstimate(connection);
  }

  // Add compute unit limit instruction (must be first)
  if (computeUnits) {
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits })
    );
  }

  // Add priority fee instruction (after compute limit)
  transaction.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: fee })
  );
}

/**
 * Pre-configured fee options for different transaction types
 * 
 * These presets are optimized for different scenarios:
 * - mint: Standard NFT minting
 * - listing: Exchange Art marketplace listing
 * - highPriority: For urgent transactions during congestion
 * - maxPriority: For critical transactions that must land quickly
 */
export const FeePresets = {
  /** For NFT minting transactions */
  get mint() {
    return {
      computeUnits: getComputeUnitLimit("mint"),
      priorityFeeMicroLamports: getPriorityFee(),
    } satisfies FeeOptions;
  },

  /** For Exchange Art listing transactions */
  get listing() {
    return {
      computeUnits: getComputeUnitLimit("listing"),
      priorityFeeMicroLamports: getPriorityFee(),
    } satisfies FeeOptions;
  },

  /** High priority for urgent transactions */
  highPriority: {
    computeUnits: 200000,
    priorityFeeMicroLamports: 50000, // 0.00005 SOL
  } satisfies FeeOptions,

  /** Maximum priority for critical transactions */
  maxPriority: {
    computeUnits: 200000,
    priorityFeeMicroLamports: 100000, // 0.0001 SOL
  } satisfies FeeOptions,
} as const;

/**
 * Calculate estimated transaction cost
 * 
 * @param feeOptions - Fee configuration
 * @returns Cost breakdown in lamports
 */
export function estimateTransactionCost(feeOptions: FeeOptions): {
  baseFee: number;
  priorityFee: number;
  total: number;
  totalSol: number;
} {
  const defaults = getNetworkDefaults();
  const baseFee = 5000; // Minimum transaction fee
  const priorityFee = feeOptions.priorityFeeMicroLamports ?? defaults.priorityFeeMicroLamports;
  const total = baseFee + priorityFee;
  
  return {
    baseFee,
    priorityFee,
    total,
    totalSol: total / 1e9,
  };
}

/**
 * Get fee recommendation for the current network conditions
 * 
 * Returns recommended fees based on recent network activity
 * and current congestion levels.
 */
export async function getFeeRecommendation(
  connection: Connection
): Promise<{
  networkType: NetworkType;
  recommendedFee: number;
  congestionLevel: "low" | "medium" | "high";
  estimatedCost: ReturnType<typeof estimateTransactionCost>;
}> {
  const networkType = getNetworkType();
  
  if (networkType !== "mainnet") {
    const cost = estimateTransactionCost({ priorityFeeMicroLamports: 0 });
    return {
      networkType,
      recommendedFee: 0,
      congestionLevel: "low",
      estimatedCost: cost,
    };
  }
  
  const recommendedFee = await getPriorityFeeEstimate(connection);
  
  // Determine congestion level
  let congestionLevel: "low" | "medium" | "high" = "low";
  if (recommendedFee > 50000) {
    congestionLevel = "high";
  } else if (recommendedFee > 10000) {
    congestionLevel = "medium";
  }
  
  const cost = estimateTransactionCost({ priorityFeeMicroLamports: recommendedFee });
  
  return {
    networkType,
    recommendedFee,
    congestionLevel,
    estimatedCost: cost,
  };
}
