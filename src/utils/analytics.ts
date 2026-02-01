/**
 * DAO Deployer - Usage Analytics Tracking
 * 
 * Tracks user interactions, feature usage, and engagement metrics.
 * Privacy-focused with opt-in/opt-out support and data anonymization.
 */

import { logger } from './logger.ts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type AnalyticsEventType = 
  | 'page_view'
  | 'feature_use'
  | 'transaction'
  | 'error'
  | 'engagement'
  | 'performance'
  | 'dao_action'
  | 'proposal_action'
  | 'task_action'
  | 'vote_action'
  | 'wallet_action';

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  name: string;
  timestamp: number;
  sessionId: string;
  userId?: string;
  anonymousId: string;
  properties: Record<string, unknown>;
  context: AnalyticsContext;
}

export interface AnalyticsContext {
  page: {
    url: string;
    title: string;
    referrer: string;
    path: string;
  };
  device: {
    type: 'desktop' | 'tablet' | 'mobile';
    os: string;
    browser: string;
    screenSize: string;
  };
  wallet?: {
    address?: string;
    chainId?: number;
    connector?: string;
  };
}

export interface AnalyticsConfig {
  enabled: boolean;
  anonymize: boolean;
  sampleRate: number;
  bufferSize: number;
  flushIntervalMs: number;
  endpoint?: string;
  apiKey?: string;
  debug: boolean;
  consentRequired: boolean;
  trackErrors: boolean;
  trackPerformance: boolean;
}

export interface FeatureUsage {
  feature: string;
  count: number;
  firstUsed: number;
  lastUsed: number;
  averageTimeSpent?: number;
}

export interface UserJourney {
  sessionId: string;
  startTime: number;
  endTime?: number;
  events: AnalyticsEvent[];
  pagesVisited: string[];
  featuresUsed: string[];
  transactions: string[];
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: AnalyticsConfig = {
  enabled: true,
  anonymize: true,
  sampleRate: 1.0,
  bufferSize: 100,
  flushIntervalMs: 5000,
  debug: process.env.NODE_ENV === 'development',
  consentRequired: true,
  trackErrors: true,
  trackPerformance: true,
};

// ============================================================================
// ANALYTICS MANAGER
// ============================================================================

export class Analytics {
  private config: AnalyticsConfig;
  private buffer: AnalyticsEvent[] = [];
  private sessionId: string;
  private anonymousId: string;
  private userId?: string;
  private hasConsent: boolean = false;
  private flushTimer?: ReturnType<typeof setInterval>;
  private featureUsage: Map<string, FeatureUsage> = new Map();
  private userJourney: UserJourney;
  private startTime: number = Date.now();

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateId();
    this.anonymousId = this.getOrCreateAnonymousId();
    this.userJourney = this.createUserJourney();

    if (this.config.enabled) {
      this.initialize();
    }
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  private initialize(): void {
    if (typeof window === 'undefined') return;

    // Set up automatic flushing
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);

    // Track page views automatically
    this.trackPageView();

    // Set up navigation tracking for SPA
    this.setupNavigationTracking();

    // Track performance metrics
    if (this.config.trackPerformance) {
      this.trackPerformanceMetrics();
    }

    // Track errors
    if (this.config.trackErrors) {
      this.setupErrorTracking();
    }

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.endSession();
      this.flush();
    });

    logger.debug('Analytics initialized', { sessionId: this.sessionId });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getOrCreateAnonymousId(): string {
    if (typeof window === 'undefined') return this.generateId();
    
    const stored = localStorage.getItem('dao_analytics_id');
    if (stored) return stored;
    
    const id = this.generateId();
    localStorage.setItem('dao_analytics_id', id);
    return id;
  }

  private createUserJourney(): UserJourney {
    return {
      sessionId: this.sessionId,
      startTime: Date.now(),
      events: [],
      pagesVisited: [],
      featuresUsed: [],
      transactions: [],
    };
  }

  // ========================================================================
  // CONSENT MANAGEMENT
  // ========================================================================

  setConsent(granted: boolean): void {
    this.hasConsent = granted;
    
    if (granted) {
      localStorage.setItem('dao_analytics_consent', 'granted');
      logger.debug('Analytics consent granted');
    } else {
      localStorage.setItem('dao_analytics_consent', 'denied');
      this.clearStoredData();
      logger.debug('Analytics consent denied');
    }
  }

  hasUserConsent(): boolean {
    if (!this.config.consentRequired) return true;
    
    const stored = localStorage.getItem('dao_analytics_consent');
    return stored === 'granted';
  }

  private clearStoredData(): void {
    localStorage.removeItem('dao_analytics_id');
    localStorage.removeItem('dao_analytics_consent');
  }

  // ========================================================================
  // CONTEXT BUILDING
  // ========================================================================

  private getContext(): AnalyticsContext {
    const context: AnalyticsContext = {
      page: this.getPageContext(),
      device: this.getDeviceContext(),
    };

    return context;
  }

  private getPageContext(): AnalyticsContext['page'] {
    if (typeof window === 'undefined') {
      return {
        url: '',
        title: '',
        referrer: '',
        path: '',
      };
    }

    return {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      path: window.location.pathname,
    };
  }

  private getDeviceContext(): AnalyticsContext['device'] {
    if (typeof window === 'undefined') {
      return {
        type: 'desktop',
        os: 'unknown',
        browser: 'unknown',
        screenSize: '0x0',
      };
    }

    const width = window.innerWidth;
    let type: 'desktop' | 'tablet' | 'mobile' = 'desktop';
    if (width < 768) type = 'mobile';
    else if (width < 1024) type = 'tablet';

    const userAgent = navigator.userAgent;
    const os = this.detectOS(userAgent);
    const browser = this.detectBrowser(userAgent);

    return {
      type,
      os,
      browser,
      screenSize: `${window.screen.width}x${window.screen.height}`,
    };
  }

  private detectOS(userAgent: string): string {
    if (userAgent.includes('Win')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    return 'Unknown';
  }

  private detectBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'Unknown';
  }

  // ========================================================================
  // EVENT TRACKING
  // ========================================================================

  private shouldTrack(): boolean {
    if (!this.config.enabled) return false;
    if (this.config.consentRequired && !this.hasUserConsent()) return false;
    if (Math.random() > this.config.sampleRate) return false;
    return true;
  }

  track(
    type: AnalyticsEventType,
    name: string,
    properties: Record<string, unknown> = {}
  ): void {
    if (!this.shouldTrack()) return;

    const event: AnalyticsEvent = {
      id: this.generateId(),
      type,
      name,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.config.anonymize ? undefined : this.userId,
      anonymousId: this.anonymousId,
      properties: this.sanitizeProperties(properties),
      context: this.getContext(),
    };

    this.buffer.push(event);
    this.userJourney.events.push(event);

    // Track feature usage
    if (type === 'feature_use') {
      this.trackFeatureUsage(name);
    }

    // Flush if buffer is full
    if (this.buffer.length >= this.config.bufferSize) {
      this.flush();
    }

    if (this.config.debug) {
      logger.debug(`Analytics event: ${type}.${name}`, { event });
    }
  }

  private sanitizeProperties(properties: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = ['password', 'privateKey', 'secret', 'token', 'apiKey', 'mnemonic'];

    for (const [key, value] of Object.entries(properties)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'bigint') {
        sanitized[key] = value.toString();
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // ========================================================================
  // SPECIFIC TRACKING METHODS
  // ========================================================================

  trackPageView(path?: string, title?: string): void {
    this.track('page_view', 'page_view', {
      path: path || window.location.pathname,
      title: title || document.title,
      referrer: document.referrer,
    });

    const currentPath = path || window.location.pathname;
    if (!this.userJourney.pagesVisited.includes(currentPath)) {
      this.userJourney.pagesVisited.push(currentPath);
    }
  }

  trackFeature(feature: string, details?: Record<string, unknown>): void {
    this.track('feature_use', feature, details);

    if (!this.userJourney.featuresUsed.includes(feature)) {
      this.userJourney.featuresUsed.push(feature);
    }
  }

  trackTransaction(
    action: string,
    details: {
      transactionHash: string;
      chainId: number;
      from: string;
      to?: string;
      value?: string;
      gasUsed?: string;
      status: 'pending' | 'success' | 'failed';
      error?: string;
    }
  ): void {
    this.track('transaction', action, details);
    this.userJourney.transactions.push(details.transactionHash);
  }

  trackDAOAction(
    action: 'create' | 'update' | 'delete' | 'view' | 'join' | 'leave',
    daoAddress: string,
    details?: Record<string, unknown>
  ): void {
    this.track('dao_action', `dao_${action}`, {
      daoAddress,
      ...details,
    });
  }

  trackProposalAction(
    action: 'create' | 'vote' | 'execute' | 'cancel' | 'view',
    proposalId: string,
    daoAddress: string,
    details?: Record<string, unknown>
  ): void {
    this.track('proposal_action', `proposal_${action}`, {
      proposalId,
      daoAddress,
      ...details,
    });
  }

  trackTaskAction(
    action: 'create' | 'bid' | 'accept' | 'complete' | 'cancel' | 'view',
    taskId: string,
    details?: Record<string, unknown>
  ): void {
    this.track('task_action', `task_${action}`, {
      taskId,
      ...details,
    });
  }

  trackVote(
    proposalId: string,
    voteType: 'yes' | 'no' | 'abstain',
    votingPower: string,
    details?: Record<string, unknown>
  ): void {
    this.track('vote_action', 'cast_vote', {
      proposalId,
      voteType,
      votingPower,
      ...details,
    });
  }

  trackWalletAction(
    action: 'connect' | 'disconnect' | 'switch_chain' | 'sign',
    walletAddress: string,
    details?: Record<string, unknown>
  ): void {
    this.track('wallet_action', action, {
      walletAddress: this.config.anonymize ? this.hashAddress(walletAddress) : walletAddress,
      ...details,
    });
  }

  trackError(error: Error, context?: Record<string, unknown>): void {
    if (!this.config.trackErrors) return;

    this.track('error', error.name, {
      message: error.message,
      stack: error.stack,
      ...context,
    });
  }

  trackEngagement(action: string, value?: number, details?: Record<string, unknown>): void {
    this.track('engagement', action, {
      value,
      sessionDuration: Date.now() - this.startTime,
      ...details,
    });
  }

  // ========================================================================
  // FEATURE USAGE TRACKING
  // ========================================================================

  private trackFeatureUsage(feature: string): void {
    const now = Date.now();
    const existing = this.featureUsage.get(feature);

    if (existing) {
      existing.count++;
      existing.lastUsed = now;
    } else {
      this.featureUsage.set(feature, {
        feature,
        count: 1,
        firstUsed: now,
        lastUsed: now,
      });
    }
  }

  getFeatureUsage(feature: string): FeatureUsage | undefined {
    return this.featureUsage.get(feature);
  }

  getAllFeatureUsage(): FeatureUsage[] {
    return Array.from(this.featureUsage.values());
  }

  // ========================================================================
  // NAVIGATION TRACKING
  // ========================================================================

  private setupNavigationTracking(): void {
    if (typeof window === 'undefined') return;

    // Track popstate events (back/forward navigation)
    window.addEventListener('popstate', () => {
      this.trackPageView();
    });

    // Track hash changes
    window.addEventListener('hashchange', () => {
      this.trackPageView();
    });
  }

  // ========================================================================
  // PERFORMANCE TRACKING
  // ========================================================================

  private trackPerformanceMetrics(): void {
    if (typeof window === 'undefined' || !('performance' in window)) return;

    // Track Web Vitals
    this.trackWebVitals();

    // Track navigation timing
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.track('performance', 'navigation_timing', {
            dns: navigation.domainLookupEnd - navigation.domainLookupStart,
            connect: navigation.connectEnd - navigation.connectStart,
            ttfb: navigation.responseStart - navigation.startTime,
            download: navigation.responseEnd - navigation.responseStart,
            domInteractive: navigation.domInteractive - navigation.startTime,
            domComplete: navigation.domComplete - navigation.startTime,
            loadComplete: navigation.loadEventEnd - navigation.startTime,
          });
        }
      }, 0);
    });
  }

  private trackWebVitals(): void {
    if (!('PerformanceObserver' in window)) return;

    // Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.track('performance', 'lcp', { value: lastEntry.startTime });
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      // LCP not supported
    }

    // First Input Delay
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'first-input') {
            const fidEntry = entry as PerformanceEventTiming;
            this.track('performance', 'fid', {
              value: fidEntry.processingStart - fidEntry.startTime,
            });
          }
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      // FID not supported
    }

    // Cumulative Layout Shift
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        });
        this.track('performance', 'cls', { value: clsValue });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      // CLS not supported
    }
  }

  // ========================================================================
  // ERROR TRACKING
  // ========================================================================

  private setupErrorTracking(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.trackError(event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      this.trackError(error, { type: 'unhandledrejection' });
    });
  }

  // ========================================================================
  // USER JOURNEY
  // ========================================================================

  getUserJourney(): UserJourney {
    return this.userJourney;
  }

  endSession(): void {
    this.userJourney.endTime = Date.now();
    this.trackEngagement('session_end', undefined, {
      duration: this.userJourney.endTime - this.userJourney.startTime,
      pagesVisited: this.userJourney.pagesVisited.length,
      featuresUsed: this.userJourney.featuresUsed.length,
      transactions: this.userJourney.transactions.length,
    });
  }

  // ========================================================================
  // DATA FLUSHING
  // ========================================================================

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    if (!this.config.endpoint) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'X-API-Key': this.config.apiKey }),
        },
        body: JSON.stringify({
          batch: events,
          sessionId: this.sessionId,
          timestamp: Date.now(),
        }),
        keepalive: true,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (this.config.debug) {
        logger.debug(`Flushed ${events.length} analytics events`);
      }
    } catch (error) {
      logger.warn('Failed to flush analytics events', error as Error);
      // Put events back in buffer
      this.buffer.unshift(...events);
    }
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  private hashAddress(address: string): string {
    // Simple hash for anonymization
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
      const char = address.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `addr_${Math.abs(hash).toString(36)}`;
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  clearUser(): void {
    this.userId = undefined;
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.endSession();
    this.flush();
  }

  // ========================================================================
  // CONFIGURATION
  // ========================================================================

  updateConfig(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  enable(): void {
    this.config.enabled = true;
  }

  disable(): void {
    this.config.enabled = false;
  }
}

// ============================================================================
// DEFAULT INSTANCE
// ============================================================================

export const analytics = new Analytics();

// ============================================================================
// REACTIVE ANALYTICS FOR SOLIDJS
// ============================================================================

import { createSignal, createEffect, onCleanup } from 'solid-js';

export function createAnalyticsTracker<T extends Record<string, unknown>>(
  feature: string,
  getData: () => T
) {
  const [trackCount, setTrackCount] = createSignal(0);

  createEffect(() => {
    const data = getData();
    const count = trackCount();
    
    if (count > 0) {
      analytics.trackFeature(feature, { ...data, interactionCount: count });
    }
  });

  const track = () => {
    setTrackCount(c => c + 1);
  };

  return { track, count: trackCount };
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const trackPageView = (path?: string, title?: string) =>
  analytics.trackPageView(path, title);

export const trackFeature = (feature: string, details?: Record<string, unknown>) =>
  analytics.trackFeature(feature, details);

export const trackTransaction = (
  action: string,
  details: Parameters<typeof analytics.trackTransaction>[1]
) => analytics.trackTransaction(action, details);

export const trackDAOAction = (
  action: Parameters<typeof analytics.trackDAOAction>[0],
  daoAddress: string,
  details?: Record<string, unknown>
) => analytics.trackDAOAction(action, daoAddress, details);

export const trackProposalAction = (
  action: Parameters<typeof analytics.trackProposalAction>[0],
  proposalId: string,
  daoAddress: string,
  details?: Record<string, unknown>
) => analytics.trackProposalAction(action, proposalId, daoAddress, details);

export const trackTaskAction = (
  action: Parameters<typeof analytics.trackTaskAction>[0],
  taskId: string,
  details?: Record<string, unknown>
) => analytics.trackTaskAction(action, taskId, details);

export const trackVote = (
  proposalId: string,
  voteType: 'yes' | 'no' | 'abstain',
  votingPower: string,
  details?: Record<string, unknown>
) => analytics.trackVote(proposalId, voteType, votingPower, details);

export const trackWalletAction = (
  action: Parameters<typeof analytics.trackWalletAction>[0],
  walletAddress: string,
  details?: Record<string, unknown>
) => analytics.trackWalletAction(action, walletAddress, details);

export const trackError = (error: Error, context?: Record<string, unknown>) =>
  analytics.trackError(error, context);

export const trackEngagement = (action: string, value?: number, details?: Record<string, unknown>) =>
  analytics.trackEngagement(action, value, details);
