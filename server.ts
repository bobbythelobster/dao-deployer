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
  
  const health = {
    status: 'healthy',
    version: VERSION,
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: uptime,
      formatted: formatUptime(uptime),
    },
    environment: NODE_ENV,
    checks: {
      server: 'ok',
      memory: process.memoryUsage(),
    },
  };
  
  return new Response(JSON.stringify(health, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
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
  
  // Health check endpoint
  if (path === '/health') {
    const response = healthCheck();
    // Add CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
  
  // API status endpoint
  if (path === '/api/status' || path === '/api') {
    const response = apiStatus();
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
  
  // Serve static files
  const response = await serveStaticFile(path);
  
  // Add CORS headers to static files too
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
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
