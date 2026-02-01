/**
 * DAO Deployer - Retry Logic with Exponential Backoff
 * 
 * Provides robust retry mechanisms for failed transactions
 * and network requests with configurable strategies.
 */

import { isRetryableError, DAOError, UserRejectedError } from "./errors";

// Retry configuration options
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatuses?: number[];
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

// Retry state
interface RetryState {
  attempt: number;
  lastError?: Error;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
  // Add jitter (±25%) to prevent thundering herd
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error should trigger a retry
 */
function shouldRetry(error: unknown, config: RetryConfig): boolean {
  // Don't retry if it's not an error
  if (!(error instanceof Error)) return false;
  
  // Never retry user rejections
  if (error instanceof UserRejectedError) return false;
  
  // Use error classification for blockchain errors
  if (error instanceof DAOError) {
    return isRetryableError(error);
  }
  
  // Check HTTP status codes for network errors
  if (error.message.includes("HTTP")) {
    const statusMatch = error.message.match(/HTTP (\d{3})/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      return config.retryableStatuses?.includes(status) ?? false;
    }
  }
  
  // Retry network errors
  if (
    error.message.includes("network") ||
    error.message.includes("timeout") ||
    error.message.includes("ECONNREFUSED") ||
    error.message.includes("ETIMEDOUT") ||
    error.message.includes("fetch failed")
  ) {
    return true;
  }
  
  return false;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const state: RetryState = { attempt: 1 };
  
  while (state.attempt <= fullConfig.maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      state.lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry
      if (state.attempt >= fullConfig.maxAttempts || !shouldRetry(error, fullConfig)) {
        throw error;
      }
      
      // Calculate delay and notify
      const delay = calculateDelay(state.attempt, fullConfig);
      fullConfig.onRetry?.(state.attempt, state.lastError, delay);
      
      // Wait before retrying
      await sleep(delay);
      state.attempt++;
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw state.lastError || new Error("Retry failed");
}

/**
 * Retry a blockchain transaction with specific logic
 */
export async function withTransactionRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    onRetry?: (attempt: number, error: Error) => void;
    onError?: (error: Error) => void;
  } = {}
): Promise<T> {
  const config: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: options.maxAttempts || 3,
    initialDelay: 2000, // Longer initial delay for transactions
    onRetry: (attempt, error, delay) => {
      console.log(`Transaction retry ${attempt}/${options.maxAttempts || 3} after ${delay}ms: ${error.message}`);
      options.onRetry?.(attempt, error);
    },
  };
  
  try {
    return await withRetry(fn, config);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    options.onError?.(err);
    throw error;
  }
}

/**
 * Retry a data fetch operation
 */
export async function withFetchRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const config: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: options.maxAttempts || 3,
    initialDelay: 500, // Shorter for data fetching
    onRetry: (attempt, error, delay) => {
      console.log(`Fetch retry ${attempt}/${options.maxAttempts || 3} after ${delay}ms: ${error.message}`);
      options.onRetry?.(attempt, error);
    },
  };
  
  return withRetry(fn, config);
}

/**
 * Create a retry wrapper for a specific function
 */
export function createRetryWrapper<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  config: Partial<RetryConfig> = {}
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return withRetry(() => fn(...args), config) as Promise<ReturnType<T>>;
  };
}

/**
 * Hook for managing retry state in components
 */
export function createRetryState(maxAttempts: number = 3) {
  let attempt = 0;
  let isRetrying = false;
  
  return {
    get attempt() { return attempt; },
    get isRetrying() { return isRetrying; },
    
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      attempt = 0;
      isRetrying = false;
      
      while (attempt < maxAttempts) {
        try {
          isRetrying = attempt > 0;
          return await fn();
        } catch (error) {
          attempt++;
          if (attempt >= maxAttempts) {
            isRetrying = false;
            throw error;
          }
          // Wait before retry
          await sleep(calculateDelay(attempt, DEFAULT_RETRY_CONFIG));
        }
      }
      
      throw new Error("Max retry attempts reached");
    },
    
    reset() {
      attempt = 0;
      isRetrying = false;
    },
  };
}

// Export types
export type { RetryConfig, RetryState };
