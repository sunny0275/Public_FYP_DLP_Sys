#!/bin/bash
# =============================================================================
# Blockchain Monitor & Auto-Start Script
# Ensures local Hardhat/Anvil blockchain node is running before backend starts
# Implements: 30s health check → auto-restart → 5min fail-safe shutdown
# =============================================================================

BLOCKCHAIN_RPC_URL="${1:-http://localhost:8545}"
BLOCKCHAIN_CHECK_INTERVAL=30        # Check every 30 seconds
BLOCKCHAIN_START_TIMEOUT=60         # Wait up to 60s for Hardhat to start
MAX_CONSECUTIVE_FAILURES=10         # Stop system after 10 failures (5 minutes)
FAILURE_COUNT=0                     # Track consecutive failures

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if blockchain RPC is responsive
check_blockchain() {
    curl -s -X POST \
        -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
        "$BLOCKCHAIN_RPC_URL" 2>/dev/null | grep -q "result"
}

# Start blockchain node
start_blockchain() {
    log_info "Starting local Hardhat blockchain node..."
    # Start in background, output to log file
    npx hardhat node --hostname 0.0.0.0 > blockchain.log 2>&1 &
    BLOCKCHAIN_PID=$!

    log_info "Hardhat started with PID: $BLOCKCHAIN_PID"
    echo $BLOCKCHAIN_PID > .blockchain.pid

    # Wait for it to be ready
    log_info "Waiting for blockchain to be ready..."
    local count=0
    while [ $count -lt $BLOCKCHAIN_START_TIMEOUT ]; do
        if check_blockchain; then
            log_info "Blockchain is ready!"
            return 0
        fi
        sleep 2
        count=$((count + 2))
        echo -n "."
    done

    log_error "Blockchain failed to start within $BLOCKCHAIN_START_TIMEOUT seconds"
    return 1
}

# Stop blockchain node
stop_blockchain() {
    log_info "Stopping blockchain node..."

    if [ -f .blockchain.pid ]; then
        PID=$(cat .blockchain.pid)
        if kill -0 $PID 2>/dev/null; then
            log_info "Stopping blockchain (PID: $PID)"
            kill $PID 2>/dev/null
            sleep 1
        fi
        rm -f .blockchain.pid
    fi

    # Also kill by process name (hardhat)
    pkill -f "hardhat" 2>/dev/null || true

    log_info "Blockchain node stopped"
}

# Monitor blockchain health with auto-recovery and 5-minute fail-safe
monitor_blockchain() {
    log_info "Starting blockchain health monitor..."
    log_info "Check interval: ${BLOCKCHAIN_CHECK_INTERVAL} seconds"
    log_info "Max consecutive failures: ${MAX_CONSECUTIVE_FAILURES} (will stop system after 5 minutes)"
    log_info "Press Ctrl+C to stop monitoring"
    echo ""

    FAILURE_COUNT=0

    while true; do
        if ! check_blockchain; then
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
            ELAPSED_MINUTES=$(awk "BEGIN {printf \"%.1f\", $FAILURE_COUNT * $BLOCKCHAIN_CHECK_INTERVAL / 60}")
            log_warn "Blockchain is not responsive! (Failure $FAILURE_COUNT / $MAX_CONSECUTIVE_FAILURES, elapsed: ${ELAPSED_MINUTES}min)"

            # Check if we've exceeded the maximum consecutive failures (5 minutes of outages)
            if [ $FAILURE_COUNT -ge $MAX_CONSECUTIVE_FAILURES ]; then
                log_error "CRITICAL: Blockchain node has been unavailable for ${ELAPSED_MINUTES} minutes ($FAILURE_COUNT restart attempts)."
                log_error "CRITICAL: Stopping system to prevent data integrity issues."
                log_error "CRITICAL: Manual intervention required. Please check:"
                log_error "  - blockchain.log for errors"
                log_error "  - Port 8545 is not blocked"
                log_error "  - Sufficient system resources (CPU/memory/disk)"
                log_error "  - Node.js/npm are properly installed"

                # Stop blockchain process cleanly
                stop_blockchain

                echo ""
                echo -e "${RED}[SYSTEM] Exiting with code 1 - blockchain health check failed${NC}"
                exit 1
            fi

            log_warn "Attempting to restart blockchain..."

            # Kill existing process if any
            if [ -f .blockchain.pid ]; then
                OLD_PID=$(cat .blockchain.pid)
                if kill -0 $OLD_PID 2>/dev/null; then
                    log_info "Killing old blockchain process (PID: $OLD_PID)"
                    kill $OLD_PID 2>/dev/null
                    sleep 2
                fi
                rm .blockchain.pid
            fi

            # Try to start blockchain
            if start_blockchain; then
                FAILURE_COUNT=0
                log_info "Blockchain is now healthy!"
            else
                log_warn "Restart failed, will retry in next cycle..."
            fi
        else
            if [ $FAILURE_COUNT -gt 0 ]; then
                log_info "Blockchain is now healthy! (Reset failure counter)"
                FAILURE_COUNT=0
            fi
        fi

        sleep $BLOCKCHAIN_CHECK_INTERVAL
    done
}

# Main
case "${1:-monitor}" in
    start)
        if check_blockchain; then
            log_info "Blockchain is already running at $BLOCKCHAIN_RPC_URL"
        else
            start_blockchain
        fi
        ;;
    monitor)
        monitor_blockchain
        ;;
    check)
        if check_blockchain; then
            log_info "Blockchain is healthy at $BLOCKCHAIN_RPC_URL"
            exit 0
        else
            log_error "Blockchain is NOT responding at $BLOCKCHAIN_RPC_URL"
            exit 1
        fi
        ;;
    stop)
        stop_blockchain
        log_info "Blockchain stopped"
        ;;
    *)
        echo "Usage: $0 {start|monitor|check|stop} [RPC_URL]"
        echo ""
        echo "Commands:"
        echo "  start   - Start blockchain if not running"
        echo "  monitor - Continuously monitor and restart blockchain if needed"
        echo "  check   - Check if blockchain is healthy"
        echo "  stop    - Stop blockchain"
        echo ""
        echo "Examples:"
        echo "  $0 start                    # Start blockchain"
        echo "  $0 monitor                  # Start monitor (runs forever)"
        echo "  $0 check                    # Check health"
        echo "  $0 monitor http://localhost:8545  # Custom RPC URL"
        exit 1
        ;;
esac
