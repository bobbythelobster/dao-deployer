#!/bin/bash

# DAO Deployer - Test Runner Script
# Usage: ./scripts/test.sh [test-type] [options]
# Test types: unit, integration, contracts, e2e, smoke, coverage, all (default)
# Options: --watch, --verbose, --ci

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
TEST_TYPE="${1:-all}"
WATCH=false
VERBOSE=false
CI=false

# Parse arguments
shift || true
while [[ $# -gt 0 ]]; do
    case $1 in
        --watch)
            WATCH=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --ci)
            CI=true
            shift
            ;;
        --help)
            echo "Usage: ./scripts/test.sh [test-type] [options]"
            echo ""
            echo "Test Types:"
            echo "  unit        - Run unit tests only"
            echo "  integration - Run integration tests only"
            echo "  contracts   - Run smart contract tests only"
            echo "  e2e         - Run end-to-end tests"
            echo "  smoke       - Run smoke tests"
            echo "  coverage    - Run all tests with coverage report"
            echo "  all         - Run all tests (default)"
            echo ""
            echo "Options:"
            echo "  --watch     - Run tests in watch mode"
            echo "  --verbose   - Enable verbose output"
            echo "  --ci        - CI mode (no watch, exit on failure)"
            echo "  --help      - Show this help message"
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
    
    # Check if foundry is installed (for contract tests)
    if [[ "$TEST_TYPE" == "contracts" || "$TEST_TYPE" == "all" ]]; then
        if ! command -v forge &> /dev/null; then
            log_warning "Foundry is not installed. Contract tests will be skipped."
            log_info "Install Foundry: https://book.getfoundry.sh/getting-started/installation"
        fi
    fi
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies if node_modules doesn't exist
    if [[ ! -d "node_modules" ]]; then
        log_info "Installing dependencies..."
        bun install
    fi
    
    log_success "Prerequisites check passed"
}

# Run unit tests
run_unit_tests() {
    log_info "Running unit tests..."
    
    local args=""
    if [[ "$WATCH" == true ]]; then
        args="--watch"
    fi
    if [[ "$VERBOSE" == true ]]; then
        args="$args --verbose"
    fi
    
    cd "$PROJECT_ROOT"
    
    # Run utils tests
    bun test tests/utils/ $args || return 1
    
    # Run store tests
    bun test tests/components/stores/ $args || return 1
    
    log_success "Unit tests passed"
}

# Run integration tests
run_integration_tests() {
    log_info "Running integration tests..."
    
    local args=""
    if [[ "$WATCH" == true ]]; then
        args="--watch"
    fi
    if [[ "$VERBOSE" == true ]]; then
        args="$args --verbose"
    fi
    
    cd "$PROJECT_ROOT"
    bun test tests/integration/ $args || return 1
    
    log_success "Integration tests passed"
}

# Run contract tests
run_contract_tests() {
    log_info "Running smart contract tests..."
    
    if ! command -v forge &> /dev/null; then
        log_warning "Foundry not installed, skipping contract tests"
        return 0
    fi
    
    cd "$PROJECT_ROOT"
    
    # Check if contracts directory exists
    if [[ ! -d "contracts" ]]; then
        log_warning "Contracts directory not found, skipping contract tests"
        return 0
    fi
    
    # Run contract tests using Bun test runner
    bun test tests/contracts/ || return 1
    
    log_success "Contract tests passed"
}

# Run E2E tests
run_e2e_tests() {
    log_info "Running end-to-end tests..."
    
    cd "$PROJECT_ROOT"
    
    # Check if Playwright is installed
    if [[ ! -f "playwright.config.ts" ]] && [[ ! -f "playwright.config.js" ]]; then
        log_warning "Playwright config not found, skipping E2E tests"
        return 0
    fi
    
    # Install Playwright browsers if needed
    if [[ ! -d "$HOME/.cache/ms-playwright" ]]; then
        log_info "Installing Playwright browsers..."
        bunx playwright install
    fi
    
    # Run E2E tests
    bunx playwright test || return 1
    
    log_success "E2E tests passed"
}

# Run smoke tests
run_smoke_tests() {
    log_info "Running smoke tests..."
    
    cd "$PROJECT_ROOT"
    
    # Build the application first
    log_info "Building application for smoke tests..."
    bun run build
    
    # Start the application in the background
    log_info "Starting application..."
    bun run dist/index.js &
    local app_pid=$!
    
    # Wait for application to start
    sleep 3
    
    # Run smoke tests
    local failed=false
    
    # Test health endpoint
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        log_success "Health check passed"
    else
        log_error "Health check failed"
        failed=true
    fi
    
    # Kill the application
    kill $app_pid 2>/dev/null || true
    wait $app_pid 2>/dev/null || true
    
    if [[ "$failed" == true ]]; then
        return 1
    fi
    
    log_success "Smoke tests passed"
}

# Run tests with coverage
run_coverage() {
    log_info "Running all tests with coverage..."
    
    cd "$PROJECT_ROOT"
    
    # Clean previous coverage
    rm -rf coverage/
    
    # Run tests with coverage
    bun test --coverage || return 1
    
    log_success "Coverage report generated in coverage/"
    
    # Display coverage summary
    if [[ -f "coverage/lcov-report/index.html" ]]; then
        log_info "View coverage report: coverage/lcov-report/index.html"
    fi
}

# Run all tests
run_all_tests() {
    log_info "Running all tests..."
    
    local failed=false
    
    if ! run_unit_tests; then
        log_error "Unit tests failed"
        failed=true
    fi
    
    if ! run_integration_tests; then
        log_error "Integration tests failed"
        failed=true
    fi
    
    if ! run_contract_tests; then
        log_error "Contract tests failed"
        failed=true
    fi
    
    if ! run_e2e_tests; then
        log_error "E2E tests failed"
        failed=true
    fi
    
    if [[ "$failed" == true ]]; then
        return 1
    fi
    
    log_success "All tests passed!"
}

# Main execution
main() {
    log_info "DAO Deployer - Test Runner"
    log_info "Test Type: $TEST_TYPE"
    
    check_prerequisites
    
    case $TEST_TYPE in
        unit)
            run_unit_tests
            ;;
        integration)
            run_integration_tests
            ;;
        contracts)
            run_contract_tests
            ;;
        e2e)
            run_e2e_tests
            ;;
        smoke)
            run_smoke_tests
            ;;
        coverage)
            run_coverage
            ;;
        all)
            run_all_tests
            ;;
        *)
            log_error "Unknown test type: $TEST_TYPE"
            log_info "Valid test types: unit, integration, contracts, e2e, smoke, coverage, all"
            exit 1
            ;;
    esac
    
    log_success "Test execution completed!"
}

# Run main function
main
