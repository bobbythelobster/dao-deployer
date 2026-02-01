/**
 * DAO Deployer - Monitoring & Observability
 * 
 * Comprehensive monitoring system including:
 * - Error tracking (Sentry-style)
 * - Transaction monitoring
 * - Metrics collection
 * - Health checks
 * - Alerting
 */

import { logger, logError, logTransaction, logPerformance } from './logger.ts';
import { analytics } from './analytics.ts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
  description?: string;
}

export interface ErrorEvent {
  id: string;
  type: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  user?: {
    id?: string;
    address?: string;
  };
  timestamp: number;
  url: string;
  userAgent: string;
  release?: string;
  environment: string;
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
}

export interface TransactionEvent {
  id: string;
  hash: string;
  chainId: number;
  from: string;
  to?: string;
  value: string;
  gasPrice?: string;
  gasLimit: string;
  gasUsed?: string;
  status: 'pending' | 'success' | 'failed';
  method?: string;
  contractAddress?: string;
  error?: string;
  timestamp: number;
  duration?: number;
  confirmations?: number;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  lastChecked: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface MonitoringConfig {
  enabled: boolean;
  environment: string;
  release: string;
  dsn?: string; // Error tracking endpoint
  sampleRate: number;
  beforeSend?: (event: ErrorEvent) => ErrorEvent | null;
  maxBreadcrumbs: number;
  attachStacktrace: boolean;
  debug: boolean;
  tracesSampleRate: number;
  metricsEnabled: boolean;
  healthCheckInterval: number;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    failedTransactionRate: number;
  };
}

export interface Alert {
  id: string;
  type: 'error' | 'performance' | 'transaction' | 'health';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: MonitoringConfig = {
  enabled: true,
  environment: process.env.NODE_ENV || 'development',
  release: '1.0.0',
  sampleRate: 1.0,
  maxBreadcrumbs: 100,
  attachStacktrace: true,
  debug: process.env.NODE_ENV === 'development',
  tracesSampleRate: 0.1,
  metricsEnabled: true,
  healthCheckInterval: 30000, // 30 seconds
  alertThresholds: {
    errorRate: 0.05, // 5% error rate
    responseTime: 5000, // 5 seconds
    failedTransactionRate: 0.1, // 10% failed transactions
  },
};

// ============================================================================
// MONITORING MANAGER
// ============================================================================

export class Monitoring {
  private config: MonitoringConfig;
  private metrics: Map<string, Metric[]> = new Map();
  private breadcrumbs: Array<{ message: string; timestamp: number; data?: unknown }> = [];
  private healthChecks: Map<string, HealthCheck> = new Map();
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private alerts: Alert[] = [];
  private transactionHistory: TransactionEvent[] = [];
  private errorHistory: ErrorEvent[] = [];
  private user?: { id?: string; address?: string };
  private tags: Map<string, string> = new Map();
  private context: Record<string, unknown> = {};

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.enabled) {
      this.initialize();
    }
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  private initialize(): void {
    this.setupGlobalErrorHandlers();
    this.startHealthChecks();

    logger.debug('Monitoring initialized', {
      environment: this.config.environment,
      release: this.config.release,
    });
  }

  private setupGlobalErrorHandlers(): void {
    if (typeof window === 'undefined') return;

    // Global error handler
    window.addEventListener('error', (event) => {
      this.captureException(event.error, {
        type: 'uncaught_error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));
      this.captureException(error, { type: 'unhandled_rejection' });
    });

    // Console error tracking
    if (this.config.debug) {
      const originalError = console.error;
      console.error = (...args: unknown[]) => {
        originalError.apply(console, args);
        
        const error = args[0] instanceof Error
          ? args[0]
          : new Error(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
        
        this.captureException(error, { type: 'console_error' });
      };
    }
  }

  // ========================================================================
  // ERROR TRACKING (Sentry-style)
  // ========================================================================

  captureException(error: Error, context?: Record<string, unknown>): string {
    if (!this.config.enabled) return '';
    if (Math.random() > this.config.sampleRate) return '';

    const event = this.createErrorEvent(error, context);
    
    // Apply beforeSend filter
    if (this.config.beforeSend) {
      const filtered = this.config.beforeSend(event);
      if (!filtered) return '';
    }

    // Store in history
    this.errorHistory.push(event);
    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }

    // Send to endpoint if configured
    if (this.config.dsn) {
      this.sendErrorEvent(event);
    }

    // Log locally
    logError('Captured exception', context, error, {
      errorId: event.id,
      level: event.level,
    });

    // Track in analytics
    analytics.trackError(error, context);

    // Check alert thresholds
    this.checkErrorAlert();

    return event.id;
  }

  captureMessage(message: string, level: ErrorEvent['level'] = 'info', context?: Record<string, unknown>): string {
    if (!this.config.enabled) return '';

    const event: ErrorEvent = {
      id: this.generateId(),
      type: 'message',
      message,
      level,
      context,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      release: this.config.release,
      environment: this.config.environment,
      user: this.user,
    };

    if (this.config.dsn) {
      this.sendErrorEvent(event);
    }

    logger.log(logger['createEntry'](level === 'fatal' || level === 'error' ? 'error' : 'info', message, context as any));

    return event.id;
  }

  private createErrorEvent(error: Error, context?: Record<string, unknown>): ErrorEvent {
    return {
      id: this.generateId(),
      type: error.name || 'Error',
      message: error.message,
      stack: this.config.attachStacktrace ? error.stack : undefined,
      context: {
        ...this.context,
        ...context,
        breadcrumbs: this.breadcrumbs.slice(-10),
        tags: Object.fromEntries(this.tags),
      },
      user: this.user,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      release: this.config.release,
      environment: this.config.environment,
      level: this.getErrorLevel(error),
    };
  }

  private getErrorLevel(error: Error): ErrorEvent['level'] {
    if (error.name === 'FatalError') return 'fatal';
    if (error.name === 'Warning') return 'warning';
    return 'error';
  }

  private async sendErrorEvent(event: ErrorEvent): Promise<void> {
    if (!this.config.dsn) return;

    try {
      const response = await fetch(this.config.dsn, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        keepalive: true,
      });

      if (!response.ok) {
        logger.warn('Failed to send error event', new Error(`HTTP ${response.status}`));
      }
    } catch (error) {
      logger.warn('Error sending event to monitoring endpoint', error as Error);
    }
  }

  // ========================================================================
  // BREADCRUMBS
  // ========================================================================

  addBreadcrumb(message: string, data?: unknown): void {
    this.breadcrumbs.push({
      message,
      timestamp: Date.now(),
      data,
    });

    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  // ========================================================================
  // USER & CONTEXT
  // ========================================================================

  setUser(user: { id?: string; address?: string }): void {
    this.user = user;
  }

  setTag(key: string, value: string): void {
    this.tags.set(key, value);
  }

  setContext(key: string, value: Record<string, unknown>): void {
    this.context[key] = value;
  }

  clearContext(): void {
    this.context = {};
    this.tags.clear();
    this.breadcrumbs = [];
  }

  // ========================================================================
  // TRANSACTION MONITORING
  // ========================================================================

  startTransaction(
    hash: string,
    chainId: number,
    from: string,
    details: {
      to?: string;
      value?: string;
      gasLimit?: string;
      gasPrice?: string;
      method?: string;
      contractAddress?: string;
    }
  ): TransactionEvent {
    const transaction: TransactionEvent = {
      id: this.generateId(),
      hash,
      chainId,
      from,
      to: details.to,
      value: details.value || '0',
      gasLimit: details.gasLimit || '0',
      gasPrice: details.gasPrice,
      status: 'pending',
      method: details.method,
      contractAddress: details.contractAddress,
      timestamp: Date.now(),
    };

    this.transactionHistory.push(transaction);
    
    // Increment pending transaction counter
    this.incrementCounter('transactions_pending', { chainId: String(chainId) });

    logTransaction('Transaction started', {
      transactionHash: hash,
      chainId,
      from,
      to: details.to,
      value: details.value,
      gasLimit: details.gasLimit,
      gasPrice: details.gasPrice,
    });

    return transaction;
  }

  updateTransaction(
    hash: string,
    updates: Partial<Pick<TransactionEvent, 'gasUsed' | 'status' | 'confirmations' | 'error'>>
  ): void {
    const transaction = this.transactionHistory.find(t => t.hash === hash);
    if (!transaction) return;

    const oldStatus = transaction.status;
    Object.assign(transaction, updates);

    // Calculate duration if completing
    if (updates.status && updates.status !== 'pending') {
      transaction.duration = Date.now() - transaction.timestamp;
    }

    // Update metrics
    if (oldStatus === 'pending' && updates.status !== 'pending') {
      this.decrementCounter('transactions_pending', { chainId: String(transaction.chainId) });
    }

    if (updates.status === 'success') {
      this.incrementCounter('transactions_success', { chainId: String(transaction.chainId) });
      this.recordHistogram('transaction_duration', transaction.duration || 0, {
        chainId: String(transaction.chainId),
      });
    } else if (updates.status === 'failed') {
      this.incrementCounter('transactions_failed', { chainId: String(transaction.chainId) });
    }

    // Log
    logTransaction(
      `Transaction ${updates.status || 'updated'}`,
      {
        transactionHash: hash,
        chainId: transaction.chainId,
        from: transaction.from,
        to: transaction.to,
        value: transaction.value,
        gasUsed: transaction.gasUsed,
        status: transaction.status,
        duration: transaction.duration,
        error: transaction.error,
      },
      updates.status === 'failed' ? 'error' : 'info'
    );

    // Track in analytics
    analytics.trackTransaction(transaction.method || 'transaction', {
      transactionHash: hash,
      chainId: transaction.chainId,
      from: transaction.from,
      to: transaction.to,
      value: transaction.value,
      gasUsed: transaction.gasUsed,
      status: transaction.status,
      error: transaction.error,
    });

    // Check alert thresholds
    if (updates.status === 'failed') {
      this.checkTransactionAlert();
    }
  }

  getTransaction(hash: string): TransactionEvent | undefined {
    return this.transactionHistory.find(t => t.hash === hash);
  }

  getRecentTransactions(limit: number = 10): TransactionEvent[] {
    return this.transactionHistory.slice(-limit);
  }

  getTransactionStats(timeWindowMs: number = 3600000): {
    total: number;
    pending: number;
    success: number;
    failed: number;
    averageDuration: number;
    successRate: number;
  } {
    const cutoff = Date.now() - timeWindowMs;
    const recent = this.transactionHistory.filter(t => t.timestamp > cutoff);

    const total = recent.length;
    const pending = recent.filter(t => t.status === 'pending').length;
    const success = recent.filter(t => t.status === 'success').length;
    const failed = recent.filter(t => t.status === 'failed').length;

    const completed = recent.filter(t => t.duration !== undefined);
    const averageDuration = completed.length > 0
      ? completed.reduce((sum, t) => sum + (t.duration || 0), 0) / completed.length
      : 0;

    const successRate = total > 0 ? success / total : 0;

    return {
      total,
      pending,
      success,
      failed,
      averageDuration,
      successRate,
    };
  }

  // ========================================================================
  // METRICS COLLECTION
  // ========================================================================

  private recordMetric(metric: Metric): void {
    if (!this.config.metricsEnabled) return;

    const key = this.getMetricKey(metric.name, metric.labels);
    const existing = this.metrics.get(key) || [];
    existing.push(metric);
    
    // Keep only last 1000 values per metric
    if (existing.length > 1000) {
      existing.shift();
    }
    
    this.metrics.set(key, existing);

    if (this.config.debug) {
      logger.debug(`Metric recorded: ${metric.name}`, { metric });
    }
  }

  private getMetricKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    this.recordMetric({
      name,
      type: 'counter',
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  decrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    this.recordMetric({
      name,
      type: 'counter',
      value: -value,
      labels,
      timestamp: Date.now(),
    });
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    this.recordMetric({
      name,
      type: 'gauge',
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    this.recordMetric({
      name,
      type: 'histogram',
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  getMetrics(name?: string, labels?: Record<string, string>): Metric[] {
    if (name) {
      const key = this.getMetricKey(name, labels || {});
      return this.metrics.get(key) || [];
    }

    return Array.from(this.metrics.values()).flat();
  }

  getMetricSummary(name: string, labels?: Record<string, string>): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
  } | null {
    const metrics = this.getMetrics(name, labels);
    if (metrics.length === 0) return null;

    const values = metrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  // Prometheus-compatible metrics export
  exportMetrics(): string {
    const lines: string[] = [];
    const grouped = new Map<string, Metric[]>();

    // Group by name
    for (const [key, metrics] of this.metrics) {
      const name = key.split('{')[0];
      const existing = grouped.get(name) || [];
      existing.push(...metrics);
      grouped.set(name, existing);
    }

    for (const [name, metrics] of grouped) {
      if (metrics.length === 0) continue;

      const type = metrics[0].type;
      lines.push(`# HELP ${name} ${metrics[0].description || name}`);
      lines.push(`# TYPE ${name} ${type}`);

      for (const metric of metrics) {
        const labelStr = Object.entries(metric.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        const key = labelStr ? `${name}{${labelStr}}` : name;
        lines.push(`${key} ${metric.value}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  // ========================================================================
  // HEALTH CHECKS
  // ========================================================================

  registerHealthCheck(
    name: string,
    checkFn: () => Promise<HealthCheck> | HealthCheck
  ): void {
    this.healthChecks.set(name, {
      name,
      status: 'healthy',
      responseTime: 0,
      lastChecked: 0,
    });

    // Store the check function for later execution
    (this.healthChecks.get(name) as any).checkFn = checkFn;
  }

  private startHealthChecks(): void {
    if (!this.config.enabled) return;

    this.healthCheckTimer = setInterval(async () => {
      await this.runHealthChecks();
    }, this.config.healthCheckInterval);

    // Run initial check
    this.runHealthChecks();
  }

  private async runHealthChecks(): Promise<void> {
    for (const [name, healthCheck] of this.healthChecks) {
      const checkFn = (healthCheck as any).checkFn;
      if (!checkFn) continue;

      const startTime = Date.now();
      
      try {
        const result = await checkFn();
        result.responseTime = Date.now() - startTime;
        result.lastChecked = Date.now();
        
        this.healthChecks.set(name, result);

        // Check alert thresholds
        if (result.status !== 'healthy' || result.responseTime > this.config.alertThresholds.responseTime) {
          this.createAlert(
            'health',
            result.status === 'unhealthy' ? 'critical' : 'high',
            `Health check "${name}" is ${result.status}`,
            { healthCheck: result }
          );
        }
      } catch (error) {
        this.healthChecks.set(name, {
          name,
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          lastChecked: Date.now(),
          message: error instanceof Error ? error.message : 'Unknown error',
        });

        this.createAlert('health', 'critical', `Health check "${name}" failed`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  getHealthStatus(): {
    overall: 'healthy' | 'unhealthy' | 'degraded';
    checks: HealthCheck[];
  } {
    const checks = Array.from(this.healthChecks.values());
    
    let overall: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    for (const check of checks) {
      if (check.status === 'unhealthy') {
        overall = 'unhealthy';
        break;
      }
      if (check.status === 'degraded' && overall === 'healthy') {
        overall = 'degraded';
      }
    }

    return { overall, checks };
  }

  // ========================================================================
  // ALERTING
  // ========================================================================

  private createAlert(
    type: Alert['type'],
    severity: Alert['severity'],
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    const alert: Alert = {
      id: this.generateId(),
      type,
      severity,
      message,
      timestamp: Date.now(),
      metadata,
      acknowledged: false,
    };

    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    logError(`Alert: ${message}`, { alert }, undefined, { severity, type });

    // Could also send to external alerting system (PagerDuty, Slack, etc.)
  }

  private checkErrorAlert(): void {
    const recentErrors = this.errorHistory.filter(
      e => e.timestamp > Date.now() - 60000 // Last minute
    );

    const errorRate = recentErrors.length / 60; // Errors per second
    
    if (errorRate > this.config.alertThresholds.errorRate) {
      this.createAlert(
        'error',
        'high',
        `High error rate detected: ${errorRate.toFixed(2)} errors/second`,
        { errorRate, recentErrors: recentErrors.length }
      );
    }
  }

  private checkTransactionAlert(): void {
    const stats = this.getTransactionStats(300000); // Last 5 minutes
    
    if (stats.total > 0 && stats.failed / stats.total > this.config.alertThresholds.failedTransactionRate) {
      this.createAlert(
        'transaction',
        'high',
        `High transaction failure rate: ${(stats.failed / stats.total * 100).toFixed(1)}%`,
        { stats }
      );
    }
  }

  getAlerts(acknowledged?: boolean): Alert[] {
    if (acknowledged === undefined) return this.alerts;
    return this.alerts.filter(a => a.acknowledged === acknowledged);
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  // ========================================================================
  // PERFORMANCE MONITORING
  // ========================================================================

  measure<T>(
    name: string,
    fn: () => T,
    labels?: Record<string, string>
  ): T {
    const start = performance.now();
    
    try {
      const result = fn();
      const duration = performance.now() - start;
      
      this.recordHistogram(`${name}_duration`, duration, labels);
      this.incrementCounter(`${name}_total`, labels);
      
      logPerformance(name, duration, labels as any);
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordHistogram(`${name}_duration`, duration, { ...labels, error: 'true' });
      this.incrementCounter(`${name}_errors`, labels);
      throw error;
    }
  }

  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    labels?: Record<string, string>
  ): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      this.recordHistogram(`${name}_duration`, duration, labels);
      this.incrementCounter(`${name}_total`, labels);
      
      logPerformance(name, duration, labels as any);
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordHistogram(`${name}_duration`, duration, { ...labels, error: 'true' });
      this.incrementCounter(`${name}_errors`, labels);
      throw error;
    }
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
  }

  // ========================================================================
  // CONFIGURATION
  // ========================================================================

  updateConfig(config: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...config };
  }

  enable(): void {
    this.config.enabled = true;
    this.initialize();
  }

  disable(): void {
    this.config.enabled = false;
    this.destroy();
  }
}

// ============================================================================
// DEFAULT INSTANCE
// ============================================================================

export const monitoring = new Monitoring();

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const captureException = (error: Error, context?: Record<string, unknown>) =>
  monitoring.captureException(error, context);

export const captureMessage = (message: string, level?: ErrorEvent['level'], context?: Record<string, unknown>) =>
  monitoring.captureMessage(message, level, context);

export const addBreadcrumb = (message: string, data?: unknown) =>
  monitoring.addBreadcrumb(message, data);

export const setUser = (user: { id?: string; address?: string }) =>
  monitoring.setUser(user);

export const setTag = (key: string, value: string) =>
  monitoring.setTag(key, value);

export const startTransaction = (
  hash: string,
  chainId: number,
  from: string,
  details: Parameters<typeof monitoring.startTransaction>[3]
) => monitoring.startTransaction(hash, chainId, from, details);

export const updateTransaction = (hash: string, updates: Parameters<typeof monitoring.updateTransaction>[1]) =>
  monitoring.updateTransaction(hash, updates);

export const incrementCounter = (name: string, labels?: Record<string, string>, value?: number) =>
  monitoring.incrementCounter(name, labels, value);

export const setGauge = (name: string, value: number, labels?: Record<string, string>) =>
  monitoring.setGauge(name, value, labels);

export const recordHistogram = (name: string, value: number, labels?: Record<string, string>) =>
  monitoring.recordHistogram(name, value, labels);

export const measure = <T>(name: string, fn: () => T, labels?: Record<string, string>) =>
  monitoring.measure(name, fn, labels);

export const measureAsync = <T>(name: string, fn: () => Promise<T>, labels?: Record<string, string>) =>
  monitoring.measureAsync(name, fn, labels);

export const registerHealthCheck = (name: string, checkFn: () => Promise<HealthCheck> | HealthCheck) =>
  monitoring.registerHealthCheck(name, checkFn);

export const getHealthStatus = () => monitoring.getHealthStatus();

export const getMetrics = (name?: string, labels?: Record<string, string>) =>
  monitoring.getMetrics(name, labels);

export const exportMetrics = () => monitoring.exportMetrics();
