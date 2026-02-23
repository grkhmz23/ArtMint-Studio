import { NextResponse } from "next/server";
import { logger } from "./logger";

/**
 * Standard API Error Codes
 */
export const ApiErrorCodes = {
  // Authentication errors
  AUTH_REQUIRED: "auth_required",
  AUTH_INVALID: "auth_invalid",
  SESSION_EXPIRED: "session_expired",
  
  // Rate limiting
  RATE_LIMITED: "rate_limited",
  
  // Validation errors
  VALIDATION_ERROR: "validation_error",
  INVALID_REQUEST: "invalid_request",
  
  // Resource errors
  NOT_FOUND: "not_found",
  ALREADY_EXISTS: "already_exists",
  
  // Transaction errors
  TX_FAILED: "tx_failed",
  TX_VERIFICATION_FAILED: "tx_verification_failed",
  TX_REPLAY: "tx_replay",
  
  // Solana errors
  RPC_ERROR: "rpc_error",
  INSUFFICIENT_FUNDS: "insufficient_funds",
  
  // Server errors
  INTERNAL_ERROR: "internal_error",
  SERVICE_UNAVAILABLE: "service_unavailable",
} as const;

export type ApiErrorCode = typeof ApiErrorCodes[keyof typeof ApiErrorCodes];

/**
 * Structured API Error Response
 */
export interface ApiErrorResponse {
  error: string;
  code: ApiErrorCode;
  details?: unknown;
  requestId?: string;
}

/**
 * API Error Handler Options
 */
interface ErrorHandlerOptions {
  log?: boolean;
  context?: Record<string, unknown>;
}

/**
 * Generate a unique request ID for error tracking
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a standardized API error response
 */
export function createApiError(
  message: string,
  code: ApiErrorCode,
  statusCode: number,
  details?: unknown,
  options: ErrorHandlerOptions = {}
): NextResponse {
  const requestId = generateRequestId();
  
  const response: ApiErrorResponse = {
    error: message,
    code,
    requestId,
  };

  if (details) {
    response.details = details;
  }

  // Log error if requested
  if (options.log !== false) {
    logger.error(`API Error: ${message}`, {
      code,
      statusCode,
      requestId,
      ...options.context,
    });
  }

  return NextResponse.json(response, { status: statusCode });
}

/**
 * Common error response helpers
 */
export const apiErrors = {
  authRequired(context?: Record<string, unknown>) {
    return createApiError(
      "Authentication required",
      ApiErrorCodes.AUTH_REQUIRED,
      401,
      undefined,
      { context }
    );
  },

  rateLimited(retryAfterSeconds?: number, context?: Record<string, unknown>) {
    const headers: Record<string, string> = {};
    if (retryAfterSeconds) {
      headers["Retry-After"] = String(retryAfterSeconds);
    }
    
    const response = createApiError(
      "Rate limit exceeded",
      ApiErrorCodes.RATE_LIMITED,
      429,
      retryAfterSeconds ? { retryAfterSeconds } : undefined,
      { context }
    );

    // Add retry-after header
    if (retryAfterSeconds) {
      response.headers.set("Retry-After", String(retryAfterSeconds));
    }

    return response;
  },

  validationError(details: unknown, context?: Record<string, unknown>) {
    return createApiError(
      "Validation failed",
      ApiErrorCodes.VALIDATION_ERROR,
      400,
      details,
      { context }
    );
  },

  notFound(resource: string, context?: Record<string, unknown>) {
    return createApiError(
      `${resource} not found`,
      ApiErrorCodes.NOT_FOUND,
      404,
      undefined,
      { context }
    );
  },

  alreadyExists(resource: string, context?: Record<string, unknown>) {
    return createApiError(
      `${resource} already exists`,
      ApiErrorCodes.ALREADY_EXISTS,
      409,
      undefined,
      { context }
    );
  },

  transactionFailed(details?: unknown, context?: Record<string, unknown>) {
    return createApiError(
      "Transaction failed",
      ApiErrorCodes.TX_FAILED,
      400,
      details,
      { context }
    );
  },

  internalError(error?: Error, context?: Record<string, unknown>) {
    return createApiError(
      "Internal server error",
      ApiErrorCodes.INTERNAL_ERROR,
      500,
      process.env.NODE_ENV === "development" && error ? error.message : undefined,
      { context, log: true }
    );
  },

  serviceUnavailable(context?: Record<string, unknown>) {
    return createApiError(
      "Service temporarily unavailable",
      ApiErrorCodes.SERVICE_UNAVAILABLE,
      503,
      undefined,
      { context }
    );
  },
};

/**
 * Wrap an async API handler with error handling
 */
export function withErrorHandling(
  handler: (req: Request) => Promise<NextResponse>,
  options: ErrorHandlerOptions = {}
): (req: Request) => Promise<NextResponse> {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (error) {
      logger.error(
        "Unhandled API error",
        {
          path: req.url,
          method: req.method,
          ...options.context,
        },
        error instanceof Error ? error : undefined
      );

      return apiErrors.internalError(
        error instanceof Error ? error : undefined,
        options.context
      );
    }
  };
}
