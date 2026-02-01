/**
 * DAO Deployer - Web Server
 * 
 * Production-ready Bun HTTP server for serving the DAO Deployer application.
 * Includes health checks, static file serving, and API endpoints.
 */

import { serve } from 'bun';

// Configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOSTNAME || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Version from package
const VERSION = '1.0.0';

// Start time for uptime calculation
const startTime = Date.now();

// ============================================================================
// METRICS STORAGE
// ============================================================================

interface ServerMetrics {
  requestsTotal: number;
  requestsByPath: Map<string, number>;
  requestsByStatus: Map<number, number>;
  responseTimeSum: number;
  responseTimeCount: number;
  errorsTotal: number;
  lastRequestTime: number;
}

const metrics: ServerMetrics = {
  requestsTotal: 0,
  requestsByPath: new Map(),
  requestsByStatus: new Map(),
  responseTimeSum: 0,
  responseTimeCount: 0,
  errorsTotal: 0,
  lastRequestTime: Date.now(),
};

// ============================================================================
// REQUEST METRICS MIDDLEWARE
// ============================================================================

function trackRequest(path: string, status: number, duration: number): void {
  metrics.requestsTotal++;
  metrics.lastRequestTime = Date.now();
  
  // Track by path
  const pathCount = metrics.requestsByPath.get(path) || 0;
  metrics.requestsByPath.set(path, pathCount + 1);
  
  // Track by status
  const statusCount = metrics.requestsByStatus.get(status) || 0;
  metrics.requestsByStatus.set(status, statusCount + 1);
  
  // Track response times
  metrics.responseTimeSum += duration;
  metrics.responseTimeCount++;
  
  // Track errors
  if (status >= 400) {
    metrics.errorsTotal++;
  }
}

function getAverageResponseTime(): number {
  if (metrics.responseTimeCount === 0) return 0;
  return Math.round(metrics.responseTimeSum / metrics.responseTimeCount);
}

function getRequestsPerMinute(): number {
  const oneMinuteAgo = Date.now() - 60000;
  if (metrics.lastRequestTime < oneMinuteAgo) return 0;
  
  // Approximate based on recent activity
  const timeWindow = Math.max(Date.now() - startTime, 60000);
  return Math.round((metrics.requestsTotal / timeWindow) * 60000);
}

/**
 * Get uptime in seconds
 */
function getUptime(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

/**
 * Format uptime as human-readable string
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
}

/**
 * Health check response
 */
function healthCheck(): Response {
  const uptime = getUptime();
  const memory = process.memoryUsage();
  
  // Determine health status based on memory usage
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  const memoryUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
  
  if (memoryUsagePercent > 90) {
    status = 'unhealthy';
  } else if (memoryUsagePercent > 75) {
    status = 'degraded';
  }
  
  const health = {
    status,
    version: VERSION,
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: uptime,
      formatted: formatUptime(uptime),
    },
    environment: NODE_ENV,
    checks: {
      server: {
        status: 'ok',
        responseTime: getAverageResponseTime(),
      },
      memory: {
        status: memoryUsagePercent > 90 ? 'critical' : memoryUsagePercent > 75 ? 'warning' : 'ok',
        usage: {
          heapUsed: formatBytes(memory.heapUsed),
          heapTotal: formatBytes(memory.heapTotal),
          external: formatBytes(memory.external),
          rss: formatBytes(memory.rss),
          percentUsed: Math.round(memoryUsagePercent),
        },
      },
    },
  };
  
  const statusCode = status === 'unhealthy' ? 503 : 200;
  
  return new Response(JSON.stringify(health, null, 2), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Detailed metrics endpoint
 */
function metricsEndpoint(): Response {
  const uptime = getUptime();
  const memory = process.memoryUsage();
  
  const metricsData = {
    timestamp: new Date().toISOString(),
    version: VERSION,
    uptime: {
      seconds: uptime,
      formatted: formatUptime(uptime),
    },
    requests: {
      total: metrics.requestsTotal,
      perMinute: getRequestsPerMinute(),
      byPath: Object.fromEntries(metrics.requestsByPath),
      byStatus: Object.fromEntries(metrics.requestsByStatus),
      errors: metrics.errorsTotal,
    },
    performance: {
      averageResponseTime: getAverageResponseTime(),
      responseTimeCount: metrics.responseTimeCount,
    },
    memory: {
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
      rss: memory.rss,
      percentUsed: Math.round((memory.heapUsed / memory.heapTotal) * 100),
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid,
    },
  };
  
  return new Response(JSON.stringify(metricsData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Prometheus-compatible metrics endpoint
 */
function prometheusMetrics(): Response {
  const memory = process.memoryUsage();
  const uptime = getUptime();
  
  const lines: string[] = [
    '# HELP dao_deployer_uptime_seconds Server uptime in seconds',
    '# TYPE dao_deployer_uptime_seconds gauge',
    `dao_deployer_uptime_seconds ${uptime}`,
    '',
    '# HELP dao_deployer_memory_bytes Memory usage in bytes',
    '# TYPE dao_deployer_memory_bytes gauge',
    `dao_deployer_memory_bytes{type="heapUsed"} ${memory.heapUsed}`,
    `dao_deployer_memory_bytes{type="heapTotal"} ${memory.heapTotal}`,
    `dao_deployer_memory_bytes{type="rss"} ${memory.rss}`,
    `dao_deployer_memory_bytes{type="external"} ${memory.external}`,
    '',
    '# HELP dao_deployer_requests_total Total number of requests',
    '# TYPE dao_deployer_requests_total counter',
    `dao_deployer_requests_total ${metrics.requestsTotal}`,
    '',
    '# HELP dao_deployer_requests_by_path Total requests by path',
    '# TYPE dao_deployer_requests_by_path counter',
  ];
  
  for (const [path, count] of metrics.requestsByPath) {
    lines.push(`dao_deployer_requests_by_path{path="${path}"} ${count}`);
  }
  
  lines.push(
    '',
    '# HELP dao_deployer_requests_by_status Total requests by status code',
    '# TYPE dao_deployer_requests_by_status counter'
  );
  
  for (const [status, count] of metrics.requestsByStatus) {
    lines.push(`dao_deployer_requests_by_status{status="${status}"} ${count}`);
  }
  
  lines.push(
    '',
    '# HELP dao_deployer_errors_total Total number of errors',
    '# TYPE dao_deployer_errors_total counter',
    `dao_deployer_errors_total ${metrics.errorsTotal}`,
    '',
    '# HELP dao_deployer_response_time_average Average response time in milliseconds',
    '# TYPE dao_deployer_response_time_average gauge',
    `dao_deployer_response_time_average ${getAverageResponseTime()}`,
    ''
  );
  
  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * API status response
 */
function apiStatus(): Response {
  const status = {
    name: 'DAO Deployer',
    version: VERSION,
    description: 'Aragon OSX DAO Deployer with Soul-Bound Token Governance',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: formatUptime(getUptime()),
    features: [
      'dao-creation',
      'proposal-management',
      'voting',
      'task-market',
      'treasury-management',
    ],
    networks: [
      'ethereum',
      'base',
      'polygon',
      'arbitrum',
      'optimism',
    ],
  };
  
  return new Response(JSON.stringify(status, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Serve static files
 */
async function serveStaticFile(path: string): Promise<Response> {
  // Map root path to index.html
  if (path === '/' || path === '') {
    path = '/index.html';
  }
  
  // Security: prevent directory traversal
  if (path.includes('..')) {
    return new Response('Not Found', { status: 404 });
  }
  
  // Try to serve from dist/public first (built assets)
  const filePath = `./dist/public${path}`;
  
  try {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    
    if (!exists) {
      // If not found and requesting a non-HTML file, return 404
      if (!path.endsWith('.html')) {
        return new Response('Not Found', { status: 404 });
      }
      
      // For HTML files, try to serve index.html (SPA fallback)
      const indexFile = Bun.file('./dist/public/index.html');
      if (await indexFile.exists()) {
        return new Response(indexFile, {
          headers: {
            'Content-Type': 'text/html',
          },
        });
      }
      
      return new Response('Not Found', { status: 404 });
    }
    
    // Determine content type
    const contentType = getContentType(path);
    
    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': path.includes('index.html') 
          ? 'no-cache' 
          : 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error(`Error serving file ${filePath}:`, error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  
  const contentTypes: Record<string, string> = {
    'html': 'text/html',
    'js': 'application/javascript',
    'mjs': 'application/javascript',
    'ts': 'application/typescript',
    'css': 'text/css',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'eot': 'application/vnd.ms-fontobject',
    'wasm': 'application/wasm',
  };
  
  return contentTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Main request handler
 */
async function handleRequest(req: Request): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(req.url);
  const path = url.pathname;
  
  // Add CORS headers for API endpoints
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  
  let response: Response;
  
  // Health check endpoint
  if (path === '/health') {
    response = healthCheck();
  }
  // Detailed metrics endpoint
  else if (path === '/metrics') {
    response = metricsEndpoint();
  }
  // Prometheus metrics endpoint
  else if (path === '/metrics/prometheus') {
    response = prometheusMetrics();
  }
  // API status endpoint
  else if (path === '/api/status' || path === '/api') {
    response = apiStatus();
  }
  // API readiness check (for Kubernetes)
  else if (path === '/ready') {
    response = new Response(JSON.stringify({ ready: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // API liveness check (for Kubernetes)
  else if (path === '/live') {
    response = new Response(JSON.stringify({ alive: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Serve static files
  else {
    response = await serveStaticFile(path);
  }
  
  // Track request metrics
  const duration = Date.now() - startTime;
  trackRequest(path, response.status, duration);
  
  // Add CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Add performance headers
  response.headers.set('X-Response-Time', `${duration}ms`);
  
  return response;
}

// Start server
console.log(`🚀 DAO Deployer Server v${VERSION}`);
console.log(`📍 Environment: ${NODE_ENV}`);
console.log(`🔗 Starting server on ${HOST}:${PORT}...`);

serve({
  hostname: HOST,
  port: PORT,
  fetch: handleRequest,
});

console.log(`✅ Server running at http://${HOST}:${PORT}`);
console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
console.log(`📊 API status: http://${HOST}:${PORT}/api/status`);
console.log(`📈 Metrics: http://${HOST}:${PORT}/metrics`);
console.log(`📈 Prometheus: http://${HOST}:${PORT}/metrics/prometheus`);
console.log(`🔴 Liveness: http://${HOST}:${PORT}/live`);
console.log(`🟢 Readiness: http://${HOST}:${PORT}/ready`);
