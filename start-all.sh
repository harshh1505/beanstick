#!/bin/bash
# start-all.sh - Start all Beanstick servers concurrently

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Change to project root
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                    BEANSTICK - Starting All Servers${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Load env
if [ -f .env ]; then
  set -o allexport
  source <(grep -v '^#' .env | grep '=')
  set +o allexport
  echo -e "${GREEN}✓${NC} Loaded .env"
fi

# Track PIDs
declare -a PIDS=()

cleanup() {
  echo
  echo -e "${YELLOW}Shutting down all servers...${NC}"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  echo -e "${GREEN}✓${NC} All servers stopped"
  exit 0
}

trap cleanup SIGINT SIGTERM

echo -e "${YELLOW}Starting servers...${NC}"
echo

# 1. Next.js web app
echo -e "${BLUE}[web]${NC} Starting Next.js on port 3000..."
(cd "$ROOT_DIR/apps/web" && pnpm dev) &
PIDS+=($!)
sleep 2

# 2. Agent server
echo -e "${BLUE}[agents]${NC} Starting agent server on port 4002..."
(cd "$ROOT_DIR" && npx tsx services/agent-server/index.ts) &
PIDS+=($!)
sleep 1

# 3. Webhook receiver
echo -e "${BLUE}[webhook]${NC} Starting webhook receiver on port ${WEBHOOK_PORT:-4001}..."
(cd "$ROOT_DIR" && npx tsx scripts/run-webhook-receiver.ts) &
PIDS+=($!)

echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                    All Servers Running${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo -e "  ${BLUE}Web App:${NC}         http://localhost:3000"
echo -e "  ${BLUE}Agent Server:${NC}    http://localhost:4002"
echo -e "  ${BLUE}Webhook:${NC}         http://localhost:${WEBHOOK_PORT:-4001}"
echo
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo

wait
