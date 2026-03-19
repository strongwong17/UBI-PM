#!/bin/bash
# Deploy script for UBInsights PMT
# Always backs up the production database before any changes

set -e

VM="internal-tools"
ZONE="us-central1-c"
DB_NAME="ubinsights_pmt"
DB_USER="ubinsights"
BACKUP_DIR="/opt/ubinsights-pmt/backups"
BUILD_DIR="/tmp/ubi-pm-build"
APP_DIR="/opt/ubinsights-pmt"
PM2_HOME="/opt/ubinsights-pmt/.pm2"

echo "=== UBInsights PMT Deploy ==="
echo ""

# Step 1: Backup database FIRST
echo "[1/6] Backing up production database..."
gcloud compute ssh $VM --zone=$ZONE -- "
  sudo mkdir -p $BACKUP_DIR && \
  sudo -u postgres pg_dump $DB_NAME > /tmp/db_backup.sql && \
  sudo mv /tmp/db_backup.sql $BACKUP_DIR/${DB_NAME}_\$(date +%Y%m%d_%H%M%S).sql && \
  sudo chown ubinsights:ubinsights $BACKUP_DIR/*.sql && \
  echo 'Backup saved:' && ls -lh $BACKUP_DIR/*.sql | tail -1
"
echo "✓ Database backed up"
echo ""

# Step 2: Pull latest code
echo "[2/6] Pulling latest code..."
gcloud compute ssh $VM --zone=$ZONE -- "cd $BUILD_DIR && git pull origin main"
echo "✓ Code updated"
echo ""

# Step 3: Install dependencies + generate Prisma client
echo "[3/6] Installing dependencies..."
gcloud compute ssh $VM --zone=$ZONE -- "cd $BUILD_DIR && npm ci && npx prisma generate"
echo "✓ Dependencies installed"
echo ""

# Step 4: Run migrations (incremental, preserves data)
echo "[4/6] Running database migrations..."
gcloud compute ssh $VM --zone=$ZONE -- "cd $BUILD_DIR && npx prisma migrate deploy"
echo "✓ Migrations applied"
echo ""

# Step 5: Build
echo "[5/6] Building production bundle..."
gcloud compute ssh $VM --zone=$ZONE -- "cd $BUILD_DIR && npm run build"
echo "✓ Build complete"
echo ""

# Step 6: Deploy + restart
echo "[6/6] Deploying and restarting..."
gcloud compute ssh $VM --zone=$ZONE -- "
  sudo rm -rf $APP_DIR/.next/standalone $APP_DIR/server.js $APP_DIR/package.json && \
  sudo cp -r $BUILD_DIR/.next/standalone/* $APP_DIR/ && \
  sudo mkdir -p $APP_DIR/.next && \
  sudo cp -r $BUILD_DIR/.next/standalone/.next/* $APP_DIR/.next/ && \
  sudo cp -r $BUILD_DIR/.next/static $APP_DIR/.next/static && \
  sudo cp -r $BUILD_DIR/node_modules/bcryptjs $APP_DIR/node_modules/ && \
  sudo cp -r $BUILD_DIR/node_modules/@prisma/adapter-pg $APP_DIR/node_modules/@prisma/ && \
  sudo cp -r $BUILD_DIR/node_modules/@tiptap $APP_DIR/node_modules/ && \
  sudo chown -R ubinsights:ubinsights $APP_DIR && \
  sudo -u ubinsights PM2_HOME=$PM2_HOME pm2 restart ubinsights-pmt && \
  sleep 3 && \
  sudo -u ubinsights PM2_HOME=$PM2_HOME pm2 status
"
echo ""
echo "=== Deploy complete ==="
echo "Site: https://pmt.ubinsights.com"
