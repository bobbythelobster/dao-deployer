# Multi-stage build for DAO Deployer
# Production-ready container with Bun runtime

# Stage 1: Dependencies
FROM oven/bun:1-alpine AS dependencies
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install all dependencies (needed for build)
RUN bun install --frozen-lockfile

# Stage 2: Build
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Stage 3: Production
FROM oven/bun:1-alpine AS production
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bunjs -u 1001

# Copy built application
COPY --from=builder --chown=bunjs:nodejs /app/dist ./dist
COPY --from=builder --chown=bunjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=bunjs:nodejs /app/package.json ./

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Switch to non-root user
USER bunjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD bun -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" || exit 1

# Start the application
CMD ["bun", "run", "dist/server.js"]

# Stage 4: Development
FROM oven/bun:1-alpine AS development
WORKDIR /app

# Install git for development
RUN apk add --no-cache git

# Copy package files
COPY package.json bun.lock ./

# Install all dependencies (including dev)
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Set environment
ENV NODE_ENV=development
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Expose port
EXPOSE 3000

# Start development server
CMD ["bun", "run", "dev"]
