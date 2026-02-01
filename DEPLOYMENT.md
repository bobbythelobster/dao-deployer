# DAO Deployer - Deployment Guide

This guide covers all deployment options for the DAO Deployer application.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Local Development](#local-development)
3. [Docker Deployment](#docker-deployment)
4. [Render.com Deployment](#rendercom-deployment)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Environment Variables](#environment-variables)
7. [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.0.0 or later)
- [Docker](https://docker.com) (optional, for containerized deployment)
- [Git](https://git-scm.com)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/dao-deployer.git
cd dao-deployer

# Install dependencies
bun install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## Local Development

### Option 1: Direct Bun

```bash
# Start development server
bun run dev

# Run tests
bun test

# Build for production
bun run build

# Start production server
bun start
```

### Option 2: Using Scripts

```bash
# Run all tests
./scripts/test.sh all

# Run specific test types
./scripts/test.sh unit
./scripts/test.sh integration
./scripts/test.sh contracts

# Deploy locally
./scripts/deploy.sh local
```

## Docker Deployment

### Local Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Docker Compose Profiles

```bash
# Full stack with IPFS
docker-compose --profile full up -d

# With local blockchain (Anvil)
docker-compose --profile blockchain up -d

# With Redis cache
docker-compose --profile cache up -d

# Production build
docker-compose --profile production up -d
```

### Manual Docker

```bash
# Build image
docker build -t dao-deployer .

# Run container
docker run -p 3000:3000 --env-file .env dao-deployer

# Run with volume (development)
docker run -p 3000:3000 -v $(pwd):/app dao-deployer
```

## Render.com Deployment

### Automatic Deployment (Recommended)

1. **Connect GitHub Repository**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure Service**
   - Name: `dao-deployer`
   - Runtime: `Docker`
   - Branch: `main`
   - Root Directory: `./`
   - Docker Command: (leave empty, uses Dockerfile)

3. **Set Environment Variables**
   - Add all variables from `.env.example`
   - Mark sensitive values as "Secret"

4. **Deploy**
   - Click "Create Web Service"
   - Render will automatically build and deploy

### Using Blueprint (render.yaml)

```bash
# Deploy using Render Blueprint
# This uses the render.yaml file in the repository
```

Go to Render Dashboard → Blueprints → New Blueprint Instance → Connect repository

### Manual Deployment via Script

```bash
# Set environment variables
export RENDER_API_KEY=your_api_key
export RENDER_STAGING_SERVICE_ID=your_staging_service_id
export RENDER_PRODUCTION_SERVICE_ID=your_production_service_id

# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production
./scripts/deploy.sh production
```

## CI/CD Pipeline

### GitHub Actions

The repository includes two workflows:

1. **CI** (`.github/workflows/ci.yml`)
   - Runs on every push and PR
   - Lints code
   - Runs all tests
   - Builds application
   - Performs security audit

2. **Deploy** (`.github/workflows/deploy.yml`)
   - Runs on pushes to `main` branch
   - Deploys to staging automatically
   - Deploys to production on version tags
   - Creates GitHub releases

### Required Secrets

Add these secrets in GitHub repository settings:

- `RENDER_API_KEY` - Your Render API key
- `RENDER_STAGING_SERVICE_ID` - Staging service ID
- `RENDER_PRODUCTION_SERVICE_ID` - Production service ID

### Manual Workflow Trigger

You can manually trigger deployments:

1. Go to GitHub repository → Actions
2. Select "Deploy to Production"
3. Click "Run workflow"
4. Choose environment (staging/production)

## Environment Variables

### Required Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment mode (development/production) | Yes |
| `PORT` | Server port (default: 3000) | No |
| `WALLET_CONNECT_PROJECT_ID` | WalletConnect project ID | Yes |
| `INFURA_API_KEY` or `ALCHEMY_API_KEY` | RPC provider API key | Yes |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `IPFS_API_URL` | IPFS node URL | - |
| `PINATA_API_KEY` | Pinata API key | - |
| `SENTRY_DSN` | Sentry error tracking | - |
| `LOG_LEVEL` | Logging level | info |

### Render-Specific Variables

| Variable | Description |
|----------|-------------|
| `RENDER_API_KEY` | Render API key for deployments |
| `RENDER_STAGING_SERVICE_ID` | Staging service ID |
| `RENDER_PRODUCTION_SERVICE_ID` | Production service ID |

## Health Checks

The application provides health check endpoints:

- `GET /health` - Basic health check
- `GET /api/status` - Detailed status information

### Example Health Response

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": {
    "seconds": 3600,
    "formatted": "1h 0m 0s"
  },
  "environment": "production",
  "checks": {
    "server": "ok",
    "memory": {
      "rss": 50331648,
      "heapTotal": 20971520,
      "heapUsed": 10485760,
      "external": 5242880
    }
  }
}
```

## Troubleshooting

### Build Failures

```bash
# Clean and rebuild
rm -rf dist node_modules bun.lock
bun install
bun run build
```

### Docker Issues

```bash
# Clean Docker cache
docker-compose down -v
docker system prune -a

# Rebuild from scratch
docker-compose up --build --force-recreate
```

### Test Failures

```bash
# Run tests with verbose output
./scripts/test.sh all --verbose

# Run specific test file
bun test tests/utils/viem.test.ts
```

### Deployment Failures

1. Check environment variables are set correctly
2. Verify Render API key and service IDs
3. Check GitHub Actions logs for errors
4. Ensure `main` branch is up to date

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 bun run dev
```

## Production Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Secrets marked as secret in Render
- [ ] Health checks enabled
- [ ] Monitoring configured (Sentry)
- [ ] Domain configured (if using custom domain)
- [ ] SSL/TLS enabled (automatic on Render)
- [ ] Database backups configured (if applicable)
- [ ] CDN configured for static assets (optional)

## Support

For deployment issues:

1. Check the [GitHub Issues](https://github.com/yourusername/dao-deployer/issues)
2. Review [Render Documentation](https://render.com/docs)
3. Check [Bun Documentation](https://bun.sh/docs)

## License

MIT License - see LICENSE file for details.
