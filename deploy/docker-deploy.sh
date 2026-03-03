#!/usr/bin/env bash
# =============================================================================
# UBInsights PMT — Docker deploy via SSH (GCP VM + Cloudflare Tunnel)
# Usage: bash deploy/docker-deploy.sh USER@VM_IP
# Example: bash deploy/docker-deploy.sh ubi@10.128.0.2
# =============================================================================
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash deploy/docker-deploy.sh USER@VM_IP"
  exit 1
fi

SSH_TARGET="$1"
APP_DIR="/opt/ubinsights-pmt"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo " UBInsights PMT — Docker Deploy"
echo "=========================================="
echo " Target: ${SSH_TARGET}"
echo ""

# --- 1. Create app directory on server ---
echo "[1/5] Setting up directories..."
ssh "${SSH_TARGET}" "sudo mkdir -p ${APP_DIR} && sudo chown \$(whoami):\$(whoami) ${APP_DIR}"

# --- 2. Sync project files ---
echo "[2/5] Syncing files to server..."
rsync -az --delete \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='prisma/dev.db' \
  --exclude='uploads/*' \
  --exclude='.env' \
  --exclude='.DS_Store' \
  "${PROJECT_DIR}/" \
  "${SSH_TARGET}:${APP_DIR}/"

echo "  Files synced"

# --- 3. Check for .env file ---
echo "[3/5] Checking environment..."
ssh "${SSH_TARGET}" "
  if [ ! -f ${APP_DIR}/.env ]; then
    echo 'DB_PASSWORD=$(openssl rand -base64 24)' > ${APP_DIR}/.env
    echo 'AUTH_SECRET=$(openssl rand -base64 32)' >> ${APP_DIR}/.env
    echo '  .env created with random secrets'
    echo '  IMPORTANT: Review ${APP_DIR}/.env on the server'
  else
    echo '  .env already exists'
  fi
"

# --- 4. Build and start containers ---
echo "[4/5] Building and starting containers..."
ssh "${SSH_TARGET}" "cd ${APP_DIR} && docker compose -f docker-compose.prod.yml up -d --build"

# --- 5. Run database migrations + seed ---
echo "[5/5] Running database migrations..."
ssh "${SSH_TARGET}" "cd ${APP_DIR} && docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy 2>/dev/null || echo '  Waiting for app to start...' && sleep 5 && docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy"

echo ""
echo "=========================================="
echo " Deploy complete!"
echo "=========================================="
echo ""
echo " App running on port 3001 (internal)"
echo ""
echo " Next steps:"
echo "   1. Add pm.ubinsights.com to Cloudflare Tunnel config:"
echo "      sudo nano /etc/cloudflared/config.yml"
echo ""
echo "   2. Add this entry before the catch-all:"
echo "      - hostname: pm.ubinsights.com"
echo "        service: http://localhost:3001"
echo ""
echo "   3. Restart cloudflared:"
echo "      sudo systemctl restart cloudflared"
echo ""
echo "   4. Seed the database (first deploy only):"
echo "      cd ${APP_DIR} && docker compose -f docker-compose.prod.yml exec app npx tsx prisma/seed.ts"
echo ""
