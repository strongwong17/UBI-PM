#!/usr/bin/env bash
# =============================================================================
# UBInsights PMT — Deploy script (run from local machine)
# Usage: bash deploy/deploy.sh USER@VM_IP [DOMAIN]
# Example: bash deploy/deploy.sh ubi@34.56.78.90 ubinsights.example.com
# =============================================================================
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash deploy/deploy.sh USER@VM_IP [DOMAIN]"
  echo "Example: bash deploy/deploy.sh ubi@34.56.78.90 ubinsights.example.com"
  exit 1
fi

SSH_TARGET="$1"
DOMAIN="${2:-}"
APP_DIR="/opt/ubinsights-pmt"
APP_USER="ubinsights"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo " UBInsights PMT — Deploy"
echo "=========================================="
echo " Target: ${SSH_TARGET}"
echo " App dir: ${APP_DIR}"
echo ""

# --- 1. Build locally ---
echo "[1/5] Building locally..."
cd "$PROJECT_DIR"
npm run build

if [[ ! -d ".next/standalone" ]]; then
  echo "Error: .next/standalone not found. Make sure output: 'standalone' is in next.config.ts"
  exit 1
fi

# --- 2. Sync files to server ---
echo "[2/5] Syncing files to server..."

# Sync standalone build
rsync -az --delete \
  .next/standalone/ \
  "${SSH_TARGET}:${APP_DIR}/"

# Sync static assets (standalone doesn't include these)
rsync -az --delete \
  .next/static/ \
  "${SSH_TARGET}:${APP_DIR}/.next/static/"

# Sync public directory if it exists
if [[ -d "public" ]]; then
  rsync -az --delete \
    public/ \
    "${SSH_TARGET}:${APP_DIR}/public/"
fi

# Sync Prisma schema + migrations (needed for prisma migrate deploy)
rsync -az \
  prisma/ \
  "${SSH_TARGET}:${APP_DIR}/prisma/"

# Sync prisma config file
rsync -az \
  prisma.config.ts \
  "${SSH_TARGET}:${APP_DIR}/prisma.config.ts"

# Sync PM2 config
rsync -az \
  deploy/ecosystem.config.cjs \
  "${SSH_TARGET}:${APP_DIR}/ecosystem.config.cjs"

# Sync package.json (needed for prisma commands)
rsync -az \
  package.json \
  "${SSH_TARGET}:${APP_DIR}/package.json"

echo "  Files synced"

# --- 3. Set ownership ---
echo "[3/5] Setting permissions..."
ssh "${SSH_TARGET}" "sudo chown -R ${APP_USER}:${APP_USER} ${APP_DIR}"

# --- 4. Run migrations ---
echo "[4/5] Running database migrations..."
ssh "${SSH_TARGET}" "cd ${APP_DIR} && sudo -u ${APP_USER} npx prisma migrate deploy"

# --- 5. Restart app via PM2 ---
echo "[5/5] Restarting application..."
ssh "${SSH_TARGET}" "cd ${APP_DIR} && sudo -u ${APP_USER} pm2 startOrRestart ecosystem.config.cjs && sudo -u ${APP_USER} pm2 save"

# --- 6. Copy Nginx config if domain provided and first deploy ---
if [[ -n "$DOMAIN" ]]; then
  echo ""
  echo "Setting up Nginx for ${DOMAIN}..."

  # Generate nginx config with actual domain
  sed "s/YOUR_DOMAIN/${DOMAIN}/g" "${SCRIPT_DIR}/nginx.conf" | \
    ssh "${SSH_TARGET}" "sudo tee /etc/nginx/sites-available/ubinsights-pmt > /dev/null"

  ssh "${SSH_TARGET}" "sudo ln -sf /etc/nginx/sites-available/ubinsights-pmt /etc/nginx/sites-enabled/ubinsights-pmt"
  ssh "${SSH_TARGET}" "sudo rm -f /etc/nginx/sites-enabled/default"
  ssh "${SSH_TARGET}" "sudo nginx -t && sudo systemctl reload nginx"
  echo "  Nginx configured for ${DOMAIN}"
fi

echo ""
echo "=========================================="
echo " Deploy complete!"
echo "=========================================="
if [[ -n "$DOMAIN" ]]; then
  echo " App should be available at: http://${DOMAIN}"
  echo ""
  echo " To enable HTTPS, SSH into the server and run:"
  echo "   sudo certbot --nginx -d ${DOMAIN}"
fi
echo ""
