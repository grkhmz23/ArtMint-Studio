/**
 * Production Logger
 * 
 * Structured logging for production environments.
 * Sanitizes sensitive data and provides consistent log format.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  version: string;
  environment: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Sensitive keys that should be redacted
const SENSITIVE_KEYS = [
  "password",
  "secret",
  "token",
  "api_key",
  "apikey",
  "authorization",
  "cookie",
  "session",
  "private_key",
  "mnemonic",
];

/**
 * Redact sensitive values from context objects
 */
function sanitizeContext(context: LogContext | undefined): LogContext | undefined {
  if (!context) return undefined;
  
  const sanitized: LogContext = {};
  
  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key contains sensitive terms
    const isSensitive = SENSITIVE_KEYS.some(sk => lowerKey.includes(sk));
    
    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeContext(value as LogContext);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Create a structured log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: "artmint-web",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "unknown",
    environment: process.env.NODE_ENV || "development",
    context: sanitizeContext(context),
  };

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  return entry;
}

/**
 * Output log entry to console
 */
function outputLog(entry: LogEntry): void {
  const isProduction = process.env.NODE_ENV === "production";
  
  if (isProduction) {
    // In production, output JSON for log aggregation
    console.log(JSON.stringify(entry));
  } else {
    // In development, use readable format
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const prefix = `[${timestamp}] ${entry.level.toUpperCase()}:`;
    
    if (entry.error) {
      console.log(prefix, entry.message, entry.context, "\nError:", entry.error.message);
    } else {
      console.log(prefix, entry.message, entry.context);
    }
  }
}

/**
 * Check if current log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  const configuredLevel = (process.env.LOG_LEVEL || "info") as LogLevel;
  const levels: LogLevel[] = ["debug", "info", "warn", "error"];
  
  return levels.indexOf(level) >= levels.indexOf(configuredLevel);
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog("debug")) {
      outputLog(createLogEntry("debug", message, context));
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog("info")) {
      outputLog(createLogEntry("info", message, context));
    }
  },

  warn(message: string, context?: LogContext, error?: Error): void {
    if (shouldLog("warn")) {
      outputLog(createLogEntry("warn", message, context, error));
    }
  },

  error(message: string, context?: LogContext, error?: Error): void {
    if (shouldLog("error")) {
      outputLog(createLogEntry("error", message, context, error));
    }
  },

  /**
   * Log API request with standardized format
   */
  request(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    context?: LogContext
  ): void {
    const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    
    if (shouldLog(level)) {
      outputLog(createLogEntry(level, `${method} ${path} ${statusCode}`, {
        method,
        path,
        statusCode,
        durationMs,
        ...context,
      }));
    }
  },

  /**
   * Log Solana transaction
   */
  transaction(
    type: "mint" | "listing" | "confirm",
    signature: string,
    wallet: string,
    success: boolean,
    context?: LogContext
  ): void {
    const level: LogLevel = success ? "info" : "error";
    
    if (shouldLog(level)) {
      outputLog(createLogEntry(level, `Transaction ${type} ${success ? "success" : "failed"}`, {
        txType: type,
        signature: signature.slice(0, 16) + "...",
        wallet: wallet.slice(0, 8) + "...",
        success,
        ...context,
      }));
    }
  },
};

// Export for use in other modules
export default logger;
