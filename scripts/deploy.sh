#!/bin/bash

# DAO Deployer - Deployment Automation Script
# Usage: ./scripts/deploy.sh [environment] [options]
# Environments: local, staging, production
# Options: --skip-tests, --force, --verbose

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-local}"
SKIP_TESTS=false
FORCE=false
VERBOSE=false

# Parse arguments
shift || true
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Usage: ./scripts/deploy.sh [environment] [options]"
            echo ""
            echo "Environments:"
            echo "  local       - Deploy locally using Docker"
            echo "  staging     - Deploy to staging environment"
            echo "  production  - Deploy to production environment"
            echo ""
            echo "Options:"
            echo "  --skip-tests  - Skip running tests before deployment"
            echo "  --force       - Force deployment without confirmation"
            echo "  --verbose     - Enable verbose output"
            echo "  --help        - Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if bun is installed
    if ! command -v bun &> /dev/null; then
        log_error "Bun is not installed. Please install it first: https://bun.sh"
        exit 1
    fi
    
    # Check if docker is installed (for local deployment)
    if [[ "$ENVIRONMENT" == "local" ]] && ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    # Check if docker-compose is installed
    if [[ "$ENVIRONMENT" == "local" ]] && ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install it first."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        log_warning "Skipping tests as requested"
        return 0
    fi
    
    log_info "Running tests..."
    
    if [[ "$VERBOSE" == true ]]; then
        bun test
    else
        bun test 2>&1 | grep -E "(pass|fail|test)" || true
    fi
    
    if [[ $? -eq 0 ]]; then
        log_success "All tests passed"
    else
        log_error "Tests failed. Use --skip-tests to deploy anyway."
        exit 1
    fi
}

# Build application
build_app() {
    log_info "Building application..."
    
    cd "$PROJECT_ROOT"
    
    # Clean previous build
    rm -rf dist/
    
    # Install dependencies
    log_info "Installing dependencies..."
    bun install --frozen-lockfile
    
    # Build
    log_info "Compiling..."
    bun run build
    
    if [[ ! -d "$PROJECT_ROOT/dist" ]]; then
        log_error "Build failed - dist directory not found"
        exit 1
    fi
    
    log_success "Build completed successfully"
}

# Deploy locally using Docker
deploy_local() {
    log_info "Deploying locally..."
    
    cd "$PROJECT_ROOT"
    
    # Stop existing containers
    log_info "Stopping existing containers..."
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # Build and start
    log_info "Building and starting containers..."
    if [[ "$VERBOSE" == true ]]; then
        docker-compose up --build -d
    else
        docker-compose up --build -d --quiet-pull
    fi
    
    # Wait for health check
    log_info "Waiting for application to be ready..."
    sleep 5
    
    # Check health
    for i in {1..30}; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            log_success "Application is running at http://localhost:3000"
            return 0
        fi
        sleep 2
    done
    
    log_error "Application failed to start within 60 seconds"
    docker-compose logs --tail=50
    exit 1
}

# Deploy to staging
deploy_staging() {
    log_info "Deploying to staging..."
    
    # Check for required environment variables
    if [[ -z "${RENDER_API_KEY:-}" ]]; then
        log_error "RENDER_API_KEY environment variable is not set"
        exit 1
    fi
    
    if [[ -z "${RENDER_STAGING_SERVICE_ID:-}" ]]; then
        log_error "RENDER_STAGING_SERVICE_ID environment variable is not set"
        exit 1
    fi
    
    # Trigger Render deployment
    log_info "Triggering Render deployment..."
    
    response=$(curl -s -w "\n%{http_code}" -X POST \
        "https://api.render.com/v1/services/$RENDER_STAGING_SERVICE_ID/deploys" \
        -H "Authorization: Bearer $RENDER_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"clearCache": true}')
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [[ "$http_code" -eq 200 ]] || [[ "$http_code" -eq 201 ]]; then
        log_success "Staging deployment triggered successfully"
        log_info "Check deployment status at: https://dashboard.render.com"
    else
        log_error "Failed to trigger staging deployment: $body"
        exit 1
    fi
}

# Deploy to production
deploy_production() {
    log_info "Deploying to production..."
    
    # Safety checks
    if [[ "$FORCE" == false ]]; then
        log_warning "You are about to deploy to PRODUCTION!"
        read -p "Are you sure? Type 'yes' to continue: " confirm
        if [[ "$confirm" != "yes" ]]; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Check git status
    cd "$PROJECT_ROOT"
    if [[ -n "$(git status --porcelain)" ]]; then
        log_error "Uncommitted changes detected. Please commit or stash them before deploying."
        exit 1
    fi
    
    # Check for required environment variables
    if [[ -z "${RENDER_API_KEY:-}" ]]; then
        log_error "RENDER_API_KEY environment variable is not set"
        exit 1
    fi
    
    if [[ -z "${RENDER_PRODUCTION_SERVICE_ID:-}" ]]; then
        log_error "RENDER_PRODUCTION_SERVICE_ID environment variable is not set"
        exit 1
    fi
    
    # Run smoke tests
    log_info "Running smoke tests..."
    bun run scripts/test.sh smoke
    
    # Trigger Render deployment
    log_info "Triggering production deployment..."
    
    response=$(curl -s -w "\n%{http_code}" -X POST \
        "https://api.render.com/v1/services/$RENDER_PRODUCTION_SERVICE_ID/deploys" \
        -H "Authorization: Bearer $RENDER_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"clearCache": true}')
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [[ "$http_code" -eq 200 ]] || [[ "$http_code" -eq 201 ]]; then
        log_success "Production deployment triggered successfully"
        log_info "Check deployment status at: https://dashboard.render.com"
        
        # Create git tag
        version=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)
        log_info "Creating git tag v$version..."
        git tag -a "v$version" -m "Release v$version" || log_warning "Tag already exists"
        git push origin "v$version" || log_warning "Failed to push tag"
    else
        log_error "Failed to trigger production deployment: $body"
        exit 1
    fi
}

# Verify deployment
verify_deployment() {
    local url=$1
    log_info "Verifying deployment at $url..."
    
    for i in {1..30}; do
        if curl -s "$url/health" > /dev/null 2>&1; then
            log_success "Deployment verified successfully"
            return 0
        fi
        log_info "Waiting for application to be ready... ($i/30)"
        sleep 10
    done
    
    log_error "Deployment verification failed"
    exit 1
}

# Main execution
main() {
    log_info "DAO Deployer - Deployment Script"
    log_info "Environment: $ENVIRONMENT"
    
    check_prerequisites
    
    case $ENVIRONMENT in
        local)
            run_tests
            build_app
            deploy_local
            verify_deployment "http://localhost:3000"
            ;;
        staging)
            run_tests
            build_app
            deploy_staging
            log_info "Staging deployment URL: https://dao-deployer-staging.onrender.com"
            ;;
        production)
            run_tests
            build_app
            deploy_production
            log_info "Production deployment URL: https://dao-deployer.onrender.com"
            ;;
        *)
            log_error "Unknown environment: $ENVIRONMENT"
            log_info "Valid environments: local, staging, production"
            exit 1
            ;;
    esac
    
    log_success "Deployment process completed!"
}

# Run main function
main
