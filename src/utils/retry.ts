/**
 * DAO Deployer - Retry Utilities
 * 
 * Provides robust retry mechanisms with exponential backoff,
 * circuit breaker pattern, and intelligent error classification.
 * 
 * @module retry
 */

import { isRetryableError, DAOError } from "./errors";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Configuration options for retry operations
 * @interface RetryOptions
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier for exponential delay */
  backoffMultiplier?: number;
  /** Optional callback for retry attempts */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  /** Optional callback for final failure */
  onFailure?: (error: Error, attempts: number) => void;
  /** Optional callback for success after retries */
  onSuccess?: (attempts: number) => void;
  /** Custom condition to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Circuit breaker states
 */
export type CircuitState = "closed" | "open" | "half-open";

/**
 * Circuit breaker configuration
 * @interface CircuitBreakerOptions
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold?: number;
  /** Time in milliseconds before attempting reset */
  resetTimeout?: number;
  /** Number of successes needed to close circuit from half-open */
  successThreshold?: number;
}

/**
 * Result of a retry operation
 * @interface RetryResult<T>
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The result data if successful */
  data?: T;
  /** The error if failed */
  error?: Error;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent in milliseconds */
  totalTime: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, "onRetry" | "onFailure" | "onSuccess" | "signal" | "isRetryable">> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

const DEFAULT_CIRCUIT_BREAKER_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  resetTimeout: 30000,
  successThreshold: 3,
};

// ============================================================================
// RETRY IMPLEMENTATION
// ============================================================================

/**
 * Calculates delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} initialDelay - Initial delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @param {number} multiplier - Backoff multiplier
 * @returns {number} Calculated delay in milliseconds
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt);
  
  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  const delayWithJitter = exponentialDelay + jitter;
  
  // Cap at max delay
  return Math.min(delayWithJitter, maxDelay);
}

/**
 * Sleeps for a specified duration, respecting abort signals
 * @param {number} ms - Milliseconds to sleep
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<void>}
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Operation aborted"));
      return;
    }
    
    const timeout = setTimeout(resolve, ms);
    
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new Error("Operation aborted"));
      }, { once: true });
    }
  });
}

/**
 * Executes a function with retry logic
 * 
 * @template T - Return type of the function
 * @param {() => Promise<T>} fn - Function to execute
 * @param {RetryOptions} [options] - Retry configuration
 * @returns {Promise<RetryResult<T>>} Result of the operation
 * 
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetchDAOData(daoId),
 *   {
 *     maxRetries: 5,
 *     onRetry: (attempt, error) => console.log(`Retry ${attempt}: ${error.message}`),
 *   }
 * );
 * 
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  
  // Use provided isRetryable or default
  const shouldRetry = opts.isRetryable || isRetryableError;
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    // Check for abort signal
    if (opts.signal?.aborted) {
      return {
        success: false,
        error: new Error("Operation aborted"),
        attempts: attempt,
        totalTime: Date.now() - startTime,
      };
    }
    
    try {
      const data = await fn();
      
      // Success callback if we retried
      if (attempt > 0 && opts.onSuccess) {
        opts.onSuccess(attempt + 1);
      }
      
      return {
        success: true,
        data,
        attempts: attempt + 1,
        totalTime: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on last attempt
      if (attempt >= opts.maxRetries) {
        break;
      }
      
      // Check if error is retryable
      if (!shouldRetry(lastError)) {
        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          totalTime: Date.now() - startTime,
        };
      }
      
      // Calculate delay for next attempt
      const delay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.maxDelay,
        opts.backoffMultiplier
      );
      
      // Retry callback
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, lastError, delay);
      }
      
      // Wait before retrying
      try {
        await sleep(delay, opts.signal);
      } catch (abortError) {
        return {
          success: false,
          error: abortError instanceof Error ? abortError : new Error(String(abortError)),
          attempts: attempt + 1,
          totalTime: Date.now() - startTime,
        };
      }
    }
  }
  
  // All retries exhausted
  if (opts.onFailure && lastError) {
    opts.onFailure(lastError, opts.maxRetries + 1);
  }
  
  return {
    success: false,
    error: lastError,
    attempts: opts.maxRetries + 1,
    totalTime: Date.now() - startTime,
  };
}

/**
 * Simplified retry wrapper that throws on failure
 * 
 * @template T - Return type of the function
 * @param {() => Promise<T>} fn - Function to execute
 * @param {RetryOptions} [options] - Retry configuration
 * @returns {Promise<T>} Result of the function
 * @throws {Error} If all retries fail
 * 
 * @example
 * ```typescript
 * try {
 *   const data = await retry(() => fetchCriticalData());
 *   // Process data
 * } catch (error) {
 *   // Handle final failure
 * }
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const result = await withRetry(fn, options);
  
  if (!result.success) {
    throw result.error || new Error("Operation failed after retries");
  }
  
  return result.data as T;
}

// ============================================================================
// CIRCUIT BREAKER IMPLEMENTATION
// ============================================================================

/**
 * Circuit Breaker class for fault tolerance
 * 
 * Prevents cascading failures by stopping requests to a failing service
 * and periodically testing if it has recovered.
 * 
 * @class CircuitBreaker
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 3,
 *   resetTimeout: 10000,
 * });
 * 
 * try {
 *   const result = await breaker.execute(() => fetchData());
 * } catch (error) {
 *   if (breaker.isOpen()) {
 *     console.log("Service temporarily unavailable");
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = 0;
  private options: Required<CircuitBreakerOptions>;
  
  constructor(options: CircuitBreakerOptions = {}) {
    this.options = { ...DEFAULT_CIRCUIT_BREAKER_OPTIONS, ...options };
  }
  
  /**
   * Gets the current state of the circuit
   * @returns {CircuitState} Current state
   */
  getState(): CircuitState {
    return this.state;
  }
  
  /**
   * Checks if circuit is open (failing fast)
   * @returns {boolean} True if circuit is open
   */
  isOpen(): boolean {
    return this.state === "open";
  }
  
  /**
   * Checks if circuit is closed (normal operation)
   * @returns {boolean} True if circuit is closed
   */
  isClosed(): boolean {
    return this.state === "closed";
  }
  
  /**
   * Executes a function with circuit breaker protection
   * 
   * @template T - Return type
   * @param {() => Promise<T>} fn - Function to execute
   * @returns {Promise<T>} Result of the function
   * @throws {Error} If circuit is open or execution fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === "open") {
      if (Date.now() < this.nextAttempt) {
        throw new Error("Circuit breaker is open - service temporarily unavailable");
      }
      // Transition to half-open
      this.state = "half-open";
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  /**
   * Handles successful execution
   * @private
   */
  private onSuccess(): void {
    if (this.state === "half-open") {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        // Close the circuit
        this.reset();
      }
    } else {
      this.failureCount = 0;
    }
  }
  
  /**
   * Handles failed execution
   * @private
   */
  private onFailure(): void {
    this.failureCount++;
    
    if (this.failureCount >= this.options.failureThreshold) {
      // Open the circuit
      this.state = "open";
      this.nextAttempt = Date.now() + this.options.resetTimeout;
    }
  }
  
  /**
   * Resets the circuit breaker to closed state
   */
  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = 0;
  }
  
  /**
   * Forces the circuit breaker to open
   */
  forceOpen(): void {
    this.state = "open";
    this.nextAttempt = Date.now() + this.options.resetTimeout;
  }
  
  /**
   * Gets current statistics
   * @returns {Object} Circuit breaker statistics
   */
  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    nextAttempt: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
    };
  }
}

// ============================================================================
// DEBOUNCE & THROTTLE
// ============================================================================

/**
 * Debounces a function call
 * 
 * @template T - Function type
 * @param {T} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {T & { cancel: () => void }} Debounced function with cancel method
 * 
 * @example
 * ```typescript
 * const debouncedSearch = debounce((query: string) => {
 *   performSearch(query);
 * }, 300);
 * 
 * // Cancel pending execution
 * debouncedSearch.cancel();
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const debouncedFn = (...args: Parameters<T>): ReturnType<T> | undefined => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      timeoutId = null;
      return fn(...args);
    }, delay);
    
    return undefined;
  };
  
  debouncedFn.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  return debouncedFn as T & { cancel: () => void };
}

/**
 * Throttles a function call
 * 
 * @template T - Function type
 * @param {T} fn - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {T & { cancel: () => void; flush: () => void }} Throttled function
 * 
 * @example
 * ```typescript
 * const throttledScroll = throttle(() => {
 *   handleScroll();
 * }, 100);
 * ```
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): T & { cancel: () => void; flush: () => void } {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const throttledFn = (...args: Parameters<T>): ReturnType<T> | undefined => {
    if (!inThrottle) {
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = null;
        }
      }, limit);
      return fn(...args);
    } else {
      lastArgs = args;
      return undefined;
    }
  };
  
  throttledFn.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    inThrottle = false;
    lastArgs = null;
  };
  
  throttledFn.flush = () => {
    if (lastArgs) {
      fn(...lastArgs);
      lastArgs = null;
    }
  };
  
  return throttledFn as T & { cancel: () => void; flush: () => void };
}

// ============================================================================
// BATCHING UTILITIES
// ============================================================================

/**
 * Batches multiple requests together
 * 
 * Collects requests over a time window and executes them as a batch.
 * 
 * @template T - Input type
 * @template R - Result type
 * @param {(items: T[]) => Promise<R[]>} batchFn - Batch processing function
 * @param {number} [windowMs=50] - Time window to collect requests
 * @returns {(item: T) => Promise<R>} Individual request function
 * 
 * @example
 * ```typescript
 * const fetchUser = batchRequests(
 *   async (ids: string[]) => {
 *     return await fetchUsersBatch(ids);
 *   },
 *   50
 * );
 * 
 * // These will be batched together
 * const user1 = await fetchUser("1");
 * const user2 = await fetchUser("2");
 * ```
 */
export function batchRequests<T, R>(
  batchFn: (items: T[]) => Promise<R[]>,
  windowMs: number = 50
): (item: T) => Promise<R> {
  let batch: { item: T; resolve: (result: R) => void; reject: (error: Error) => void }[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const processBatch = async () => {
    if (batch.length === 0) return;
    
    const currentBatch = batch;
    batch = [];
    timeoutId = null;
    
    try {
      const results = await batchFn(currentBatch.map(b => b.item));
      currentBatch.forEach((b, index) => {
        b.resolve(results[index]);
      });
    } catch (error) {
      currentBatch.forEach(b => {
        b.reject(error instanceof Error ? error : new Error(String(error)));
      });
    }
  };
  
  return (item: T): Promise<R> => {
    return new Promise((resolve, reject) => {
      batch.push({ item, resolve, reject });
      
      if (!timeoutId) {
        timeoutId = setTimeout(processBatch, windowMs);
      }
    });
  };
}

// ============================================================================
// TIMEOUT UTILITIES
// ============================================================================

/**
 * Wraps a promise with a timeout
 * 
 * @template T - Promise return type
 * @param {Promise<T>} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} [message="Operation timed out"] - Timeout message
 * @returns {Promise<T>} Promise that rejects on timeout
 * 
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   fetchData(),
 *   5000,
 *   "Data fetch timed out"
 * );
 * ```
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string = "Operation timed out"
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

/**
 * Creates a cancellable promise
 * 
 * @template T - Promise return type
 * @param {Promise<T>} promise - Promise to make cancellable
 * @returns {Object} Cancellable promise with abort method
 */
export function makeCancellable<T>(promise: Promise<T>): {
  promise: Promise<T>;
  abort: () => void;
} {
  let isCancelled = false;
  
  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise
      .then(result => {
        if (isCancelled) {
          reject(new Error("Operation was cancelled"));
        } else {
          resolve(result);
        }
      })
      .catch(error => {
        if (isCancelled) {
          reject(new Error("Operation was cancelled"));
        } else {
          reject(error);
        }
      });
  });
  
  return {
    promise: wrappedPromise,
    abort: () => {
      isCancelled = true;
    },
  };
}
