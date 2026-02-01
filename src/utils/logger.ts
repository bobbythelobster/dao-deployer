/**
 * DAO Deployer - Structured Logging Utility
 * 
 * Provides structured, leveled logging with context support.
 * Supports multiple transports (console, file, remote) and
 * configurable log levels for different environments.
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  [key: string]: unknown;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  chainId?: number;
  daoAddress?: string;
  transactionHash?: string;
  component?: string;
  feature?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
  metadata?: Record<string, unknown>;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  enableRemote: boolean;
  remoteEndpoint?: string;
  remoteApiKey?: string;
  includeTimestamp: boolean;
  includeStackTrace: boolean;
  redactFields: string[];
  format: 'json' | 'pretty' | 'simple';
}

export type LogTransport = (entry: LogEntry) => void | Promise<void>;

// ============================================================================
// LOG LEVEL PRIORITIES
// ============================================================================

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  enableConsole: true,
  enableFile: false,
  enableRemote: false,
  includeTimestamp: true,
  includeStackTrace: true,
  redactFields: ['password', 'privateKey', 'apiKey', 'secret', 'token'],
  format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
};

// ============================================================================
// LOGGER CLASS
// ============================================================================

export class Logger {
  private config: LoggerConfig;
  private transports: LogTransport[] = [];
  private context: LogContext = {};
  private buffer: LogEntry[] = [];
  private flushInterval?: ReturnType<typeof setInterval>;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupTransports();
    this.startBufferFlush();
  }

  // ========================================================================
  // TRANSPORT SETUP
  // ========================================================================

  private setupTransports(): void {
    if (this.config.enableConsole) {
      this.transports.push(this.createConsoleTransport());
    }

    if (this.config.enableFile && this.config.filePath) {
      this.transports.push(this.createFileTransport());
    }

    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.transports.push(this.createRemoteTransport());
    }
  }

  private createConsoleTransport(): LogTransport {
    return (entry: LogEntry) => {
      const formatted = this.formatEntry(entry);
      
      switch (entry.level) {
        case 'debug':
          console.debug(formatted);
          break;
        case 'info':
          console.info(formatted);
          break;
        case 'warn':
          console.warn(formatted);
          break;
        case 'error':
        case 'fatal':
          console.error(formatted);
          break;
      }
    };
  }

  private createFileTransport(): LogTransport {
    // File transport is async and would require file system access
    // For browser compatibility, this is a no-op that logs to console
    return async (entry: LogEntry) => {
      // In a Node.js environment, this would write to a file
      // For now, we just buffer the entry
      this.buffer.push(entry);
    };
  }

  private createRemoteTransport(): LogTransport {
    return async (entry: LogEntry) => {
      if (!this.config.remoteEndpoint) return;

      try {
        const response = await fetch(this.config.remoteEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.remoteApiKey && {
              'Authorization': `Bearer ${this.config.remoteApiKey}`,
            }),
          },
          body: JSON.stringify(entry),
        });

        if (!response.ok) {
          console.error('Failed to send log to remote endpoint:', response.statusText);
        }
      } catch (error) {
        // Silently fail to avoid infinite loops
        console.error('Remote logging failed:', error);
      }
    };
  }

  // ========================================================================
  // BUFFER & FLUSH
  // ========================================================================

  private startBufferFlush(): void {
    if (typeof window === 'undefined') return; // Only in browser

    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 5000);

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flushBuffer();
    });
  }

  private flushBuffer(): void {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    // Send batched logs to remote endpoint if configured
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.remoteApiKey && {
            'Authorization': `Bearer ${this.config.remoteApiKey}`,
          }),
        },
        body: JSON.stringify({ batch: entries }),
        keepalive: true,
      }).catch(() => {
        // Silently fail
      });
    }
  }

  // ========================================================================
  // ENTRY FORMATTING
  // ========================================================================

  private formatEntry(entry: LogEntry): string {
    const redactedContext = this.redactSensitiveData(entry.context);
    
    switch (this.config.format) {
      case 'json':
        return JSON.stringify({
          timestamp: entry.timestamp,
          level: entry.level,
          message: entry.message,
          context: redactedContext,
          error: entry.error ? {
            name: entry.error.name,
            message: entry.error.message,
            stack: this.config.includeStackTrace ? entry.error.stack : undefined,
          } : undefined,
          metadata: entry.metadata,
        });

      case 'pretty':
        const timestamp = this.config.includeTimestamp
          ? `[${new Date(entry.timestamp).toLocaleTimeString()}]`
          : '';
        const level = entry.level.toUpperCase().padEnd(5);
        const contextStr = redactedContext
          ? ` ${JSON.stringify(redactedContext)}`
          : '';
        const errorStr = entry.error
          ? `\n  Error: ${entry.error.name}: ${entry.error.message}`
          : '';
        return `${timestamp} ${level} ${entry.message}${contextStr}${errorStr}`;

      case 'simple':
      default:
        return `[${entry.level.toUpperCase()}] ${entry.message}`;
    }
  }

  private redactSensitiveData(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    const redacted: LogContext = {};
    for (const [key, value] of Object.entries(context)) {
      if (this.config.redactFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  // ========================================================================
  // LOGGING METHODS
  // ========================================================================

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLevel];
  }

  private createEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    metadata?: Record<string, unknown>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
      error,
      metadata,
    };
  }

  private async log(entry: LogEntry): Promise<void> {
    if (!this.shouldLog(entry.level)) return;

    for (const transport of this.transports) {
      try {
        await transport(entry);
      } catch (error) {
        console.error('Log transport failed:', error);
      }
    }
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  debug(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log(this.createEntry('debug', message, context, undefined, metadata));
  }

  info(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log(this.createEntry('info', message, context, undefined, metadata));
  }

  warn(message: string, context?: LogContext, error?: Error, metadata?: Record<string, unknown>): void {
    this.log(this.createEntry('warn', message, context, error, metadata));
  }

  error(message: string, context?: LogContext, error?: Error, metadata?: Record<string, unknown>): void {
    this.log(this.createEntry('error', message, context, error, metadata));
  }

  fatal(message: string, context?: LogContext, error?: Error, metadata?: Record<string, unknown>): void {
    this.log(this.createEntry('fatal', message, context, error, metadata));
  }

  // ========================================================================
  // CONTEXT MANAGEMENT
  // ========================================================================

  withContext(context: LogContext): Logger {
    const childLogger = new Logger(this.config);
    childLogger.context = { ...this.context, ...context };
    childLogger.transports = this.transports;
    return childLogger;
  }

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  // ========================================================================
  // CONFIGURATION
  // ========================================================================

  setLevel(level: LogLevel): void {
    this.config.minLevel = level;
  }

  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushBuffer();
  }
}

// ============================================================================
// DEFAULT LOGGER INSTANCE
// ============================================================================

export const logger = new Logger();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export const logDebug = (message: string, context?: LogContext, metadata?: Record<string, unknown>) =>
  logger.debug(message, context, metadata);

export const logInfo = (message: string, context?: LogContext, metadata?: Record<string, unknown>) =>
  logger.info(message, context, metadata);

export const logWarn = (message: string, context?: LogContext, error?: Error, metadata?: Record<string, unknown>) =>
  logger.warn(message, context, error, metadata);

export const logError = (message: string, context?: LogContext, error?: Error, metadata?: Record<string, unknown>) =>
  logger.error(message, context, error, metadata);

export const logFatal = (message: string, context?: LogContext, error?: Error, metadata?: Record<string, unknown>) =>
  logger.fatal(message, context, error, metadata);

// ============================================================================
// BLOCKCHAIN-SPECIFIC LOGGING
// ============================================================================

export interface TransactionLogContext extends LogContext {
  transactionHash: string;
  chainId: number;
  from: string;
  to?: string;
  value?: string;
  gasPrice?: string;
  gasLimit?: string;
  nonce?: number;
}

export const logTransaction = (
  message: string,
  context: TransactionLogContext,
  level: LogLevel = 'info'
): void => {
  const entry = logger['createEntry'](level, message, context);
  logger['log'](entry);
};

export const logContractCall = (
  contractAddress: string,
  functionName: string,
  args: unknown[],
  context?: LogContext,
  level: LogLevel = 'debug'
): void => {
  logger.log(logger['createEntry'](
    level,
    `Contract call: ${functionName}`,
    {
      ...context,
      contractAddress,
      functionName,
      args: args.map(arg => typeof arg === 'bigint' ? arg.toString() : arg),
    }
  ));
};

export const logDAOOperation = (
  operation: string,
  daoAddress: string,
  details?: Record<string, unknown>,
  context?: LogContext,
  level: LogLevel = 'info'
): void => {
  logger.log(logger['createEntry'](
    level,
    `DAO operation: ${operation}`,
    {
      ...context,
      daoAddress,
      operation,
      ...details,
    }
  ));
};

// ============================================================================
// PERFORMANCE LOGGING
// ============================================================================

export const logPerformance = (
  operation: string,
  durationMs: number,
  context?: LogContext,
  level: LogLevel = durationMs > 1000 ? 'warn' : 'debug'
): void => {
  logger.log(logger['createEntry'](
    level,
    `Performance: ${operation} took ${durationMs}ms`,
    {
      ...context,
      operation,
      durationMs,
    }
  ));
};

// ============================================================================
// USER ACTION LOGGING
// ============================================================================

export const logUserAction = (
  action: string,
  userId: string,
  details?: Record<string, unknown>,
  context?: LogContext
): void => {
  logger.info(
    `User action: ${action}`,
    {
      ...context,
      userId,
      action,
      ...details,
    }
  );
};

// ============================================================================
// ERROR BOUNDARY LOGGING
// ============================================================================

export const logComponentError = (
  componentName: string,
  error: Error,
  errorInfo?: { componentStack?: string },
  context?: LogContext
): void => {
  logger.error(
    `Component error in ${componentName}`,
    {
      ...context,
      componentName,
      componentStack: errorInfo?.componentStack,
    },
    error
  );
};
