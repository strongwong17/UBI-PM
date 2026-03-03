#!/usr/bin/env bash
# =============================================================================
# UBInsights PMT — One-time server setup for GCP e2-micro (Debian/Ubuntu)
# Run: sudo bash setup.sh
# =============================================================================
set -euo pipefail

APP_DIR="/opt/ubinsights-pmt"
APP_USER="ubinsights"

echo "=========================================="
echo " UBInsights PMT — Server Setup"
echo "=========================================="

# --- 0. Must be root ---
if [[ $EUID -ne 0 ]]; then
  echo "Error: This script must be run as root (sudo bash setup.sh)"
  exit 1
fi

# --- 1. System updates ---
echo "[1/9] Updating system packages..."
apt-get update -y
apt-get upgrade -y

# --- 2. Swap file (1 GB) — essential for 1 GB RAM ---
echo "[2/9] Setting up swap..."
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  Swap file created (1 GB)"
else
  echo "  Swap already exists, skipping"
fi

# --- 3. Node.js 22 LTS ---
echo "[3/9] Installing Node.js 22 LTS..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
else
  echo "  Node.js already installed: $(node --version)"
fi

# --- 4. PostgreSQL 15 ---
echo "[4/9] Installing PostgreSQL..."
if ! command -v psql &>/dev/null; then
  apt-get install -y postgresql postgresql-contrib
fi
systemctl enable postgresql
systemctl start postgresql

# Create database and app user (idempotent)
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${APP_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${APP_USER} WITH PASSWORD 'CHANGEME';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='ubinsights_pmt'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ubinsights_pmt OWNER ${APP_USER};"
echo "  PostgreSQL ready (user: ${APP_USER}, db: ubinsights_pmt)"
echo "  IMPORTANT: Change the password with:"
echo "    sudo -u postgres psql -c \"ALTER USER ${APP_USER} PASSWORD 'your-secure-password';\""

# Tune for low memory
PG_CONF=$(sudo -u postgres psql -t -c "SHOW config_file;" | xargs)
if ! grep -q "# UBInsights tuning" "$PG_CONF" 2>/dev/null; then
  cat >> "$PG_CONF" <<PGEOF

# UBInsights tuning for e2-micro (1 GB RAM)
shared_buffers = 128MB
work_mem = 4MB
maintenance_work_mem = 64MB
effective_cache_size = 256MB
max_connections = 20
PGEOF
  systemctl restart postgresql
  echo "  PostgreSQL tuned for low memory"
fi

# --- 5. Nginx ---
echo "[5/9] Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx

# --- 6. Certbot ---
echo "[6/9] Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx

# --- 7. PM2 ---
echo "[7/9] Installing PM2..."
npm install -g pm2

# --- 8. App user + directory ---
echo "[8/9] Creating app user and directory..."
id -u ${APP_USER} &>/dev/null || useradd --system --shell /usr/sbin/nologin ${APP_USER}
mkdir -p ${APP_DIR}/uploads ${APP_DIR}/logs
chown -R ${APP_USER}:${APP_USER} ${APP_DIR}

# PM2 startup hook for the app user
pm2 startup systemd -u ${APP_USER} --hp ${APP_DIR} || true

# --- 9. Firewall ---
echo "[9/9] Configuring firewall..."
if command -v ufw &>/dev/null; then
  ufw allow OpenSSH
  ufw allow 'Nginx Full'
  ufw --force enable
  echo "  UFW configured"
else
  echo "  UFW not found — GCP firewall rules should handle port 80/443"
fi

echo ""
echo "=========================================="
echo " Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Set PostgreSQL password:"
echo "     sudo -u postgres psql -c \"ALTER USER ${APP_USER} PASSWORD 'your-secure-password';\""
echo ""
echo "  2. Copy .env.production to ${APP_DIR}/.env and fill in values"
echo ""
echo "  3. Point your domain DNS to this server's external IP"
echo ""
echo "  4. Run deploy.sh from your local machine:"
echo "     bash deploy/deploy.sh USER@VM_IP yourdomain.com"
echo ""
echo "  5. Set up SSL:"
echo "     sudo certbot --nginx -d yourdomain.com"
echo ""
