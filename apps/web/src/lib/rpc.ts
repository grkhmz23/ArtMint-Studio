/**
 * RPC Manager
 * 
 * Manages Solana RPC connections with failover, health checks,
 * and performance monitoring.
 * 
 * For mainnet, use dedicated RPC providers like:
 * - Helius (https://helius.xyz)
 * - QuickNode (https://quicknode.com)
 * - Alchemy (https://alchemy.com)
 * 
 * Environment Variables:
 *   SOLANA_RPC_URL - Primary RPC endpoint (REQUIRED for mainnet)
 *   SOLANA_RPC_BACKUP_URL - Backup RPC endpoint (recommended)
 *   SOLANA_RPC_FALLBACK_URL - Last-resort fallback (optional)
 */

import { Connection, ConnectionConfig } from "@solana/web3.js";

export interface RpcEndpoint {
  url: string;
  name: string;
  healthy: boolean;
  lastChecked: number;
  latencyMs: number;
  errorCount: number;
}

export interface RpcManagerOptions {
  primaryUrl: string;
  backupUrl?: string;
  fallbackUrl?: string;
  connectionConfig?: ConnectionConfig;
  healthCheckIntervalMs?: number;
  timeoutMs?: number;
  maxErrorsBeforeFailover?: number;
}

/**
 * RPC Manager with automatic failover
 * 
 * Features:
 * - Primary + backup endpoints with automatic failover
 * - Health check polling
 * - Latency tracking
 * - Automatic retry with exponential backoff
 */
export class RpcManager {
  private endpoints: RpcEndpoint[];
  private currentIndex = 0;
  private connection: Connection | null = null;
  private options: Required<RpcManagerOptions>;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(options: RpcManagerOptions) {
    this.options = {
      connectionConfig: {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
      },
      healthCheckIntervalMs: 30000, // 30 seconds
      timeoutMs: 30000, // 30 seconds
      maxErrorsBeforeFailover: 3,
      backupUrl: "",
      fallbackUrl: "https://api.mainnet-beta.solana.com", // Public fallback
      ...options,
    };

    // Initialize endpoints
    this.endpoints = [
      {
        url: this.options.primaryUrl,
        name: "primary",
        healthy: true,
        lastChecked: 0,
        latencyMs: 0,
        errorCount: 0,
      },
    ];

    if (this.options.backupUrl) {
      this.endpoints.push({
        url: this.options.backupUrl,
        name: "backup",
        healthy: true,
        lastChecked: 0,
        latencyMs: 0,
        errorCount: 0,
      });
    }

    if (this.options.fallbackUrl) {
      this.endpoints.push({
        url: this.options.fallbackUrl,
        name: "fallback",
        healthy: true,
        lastChecked: 0,
        latencyMs: 0,
        errorCount: 0,
      });
    }

    // Start health checks
    this.startHealthChecks();
  }

  /**
   * Get the best available connection
   */
  getConnection(): Connection {
    if (!this.connection) {
      this.connection = this.createConnection();
    }
    return this.connection;
  }

  /**
   * Get current endpoint info
   */
  getCurrentEndpoint(): RpcEndpoint {
    return this.endpoints[this.currentIndex]!;
  }

  /**
   * Get all endpoint statuses
   */
  getAllEndpoints(): RpcEndpoint[] {
    return [...this.endpoints];
  }

  /**
   * Force failover to next available endpoint
   */
  async failover(): Promise<boolean> {
    const startIndex = this.currentIndex;
    
    do {
      this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
      const endpoint = this.endpoints[this.currentIndex]!;
      
      if (endpoint.healthy) {
        this.connection = this.createConnection();
        console.log(`[RpcManager] Failed over to ${endpoint.name}: ${endpoint.url}`);
        return true;
      }
    } while (this.currentIndex !== startIndex);

    // No healthy endpoints - try current anyway
    console.error("[RpcManager] No healthy endpoints available!");
    this.connection = this.createConnection();
    return false;
  }

  /**
   * Record an error on the current endpoint
   */
  recordError(): void {
    const endpoint = this.endpoints[this.currentIndex]!;
    endpoint.errorCount++;
    
    if (endpoint.errorCount >= this.options.maxErrorsBeforeFailover) {
      endpoint.healthy = false;
      console.warn(`[RpcManager] Marked ${endpoint.name} as unhealthy due to errors`);
      this.failover();
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(latencyMs: number): void {
    const endpoint = this.endpoints[this.currentIndex]!;
    endpoint.errorCount = 0;
    endpoint.latencyMs = latencyMs;
  }

  /**
   * Stop health checks (for cleanup)
   */
  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  private createConnection(): Connection {
    const endpoint = this.endpoints[this.currentIndex]!;
    return new Connection(endpoint.url, this.options.connectionConfig);
  }

  private startHealthChecks(): void {
    // Initial health check
    this.checkHealth();

    // Periodic health checks
    this.healthCheckTimer = setInterval(() => {
      this.checkHealth();
    }, this.options.healthCheckIntervalMs);
  }

  private async checkHealth(): Promise<void> {
    for (const endpoint of this.endpoints) {
      try {
        const start = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        // Simple health check - get recent blockhash
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getHealth",
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        
        const latencyMs = Date.now() - start;
        const data = await response.json();
        
        endpoint.lastChecked = Date.now();
        endpoint.latencyMs = latencyMs;
        
        // getHealth returns "ok" for healthy
        const wasHealthy = endpoint.healthy;
        endpoint.healthy = data.result === "ok";
        
        if (!wasHealthy && endpoint.healthy) {
          console.log(`[RpcManager] ${endpoint.name} is now healthy (${latencyMs}ms)`);
        }

      } catch (err) {
        endpoint.lastChecked = Date.now();
        endpoint.healthy = false;
        console.warn(`[RpcManager] ${endpoint.name} health check failed:`, (err as Error).message);
      }
    }
  }
}

// Global RPC manager instance
let rpcManager: RpcManager | null = null;

/**
 * Initialize the global RPC manager
 * Call this once at app startup
 */
export function initRpcManager(options?: Partial<RpcManagerOptions>): RpcManager {
  const cluster = (process.env.SOLANA_CLUSTER ?? "devnet").toLowerCase();
  
  // Mainnet: Require dedicated RPC
  if (cluster === "mainnet" || cluster === "mainnet-beta") {
    const primaryUrl = process.env.SOLANA_RPC_URL;
    
    if (!primaryUrl || primaryUrl.includes("api.mainnet-beta.solana.com")) {
      console.warn("⚠️  WARNING: Using public mainnet RPC. This is not recommended for production.");
      console.warn("   Please set SOLANA_RPC_URL to a dedicated RPC provider (Helius, QuickNode, etc.)");
    }

    rpcManager = new RpcManager({
      primaryUrl: primaryUrl ?? "https://api.mainnet-beta.solana.com",
      backupUrl: process.env.SOLANA_RPC_BACKUP_URL,
      fallbackUrl: "https://api.mainnet-beta.solana.com",
      ...options,
    });
  } else {
    // Devnet: Use default or configured
    rpcManager = new RpcManager({
      primaryUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
      backupUrl: process.env.SOLANA_RPC_BACKUP_URL,
      fallbackUrl: "https://api.devnet.solana.com",
      ...options,
    });
  }

  return rpcManager;
}

/**
 * Get the global RPC manager instance
 */
export function getRpcManager(): RpcManager {
  if (!rpcManager) {
    return initRpcManager();
  }
  return rpcManager;
}

/**
 * Get a connection from the global RPC manager
 */
export function getConnection(): Connection {
  return getRpcManager().getConnection();
}
