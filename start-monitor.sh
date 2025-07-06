#!/bin/bash

# Payment Monitor Startup Script
echo "🚀 Starting Payment Monitor Service..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 process manager..."
    npm install -g pm2
fi

# Stop existing monitor if running
pm2 stop payment-monitor 2>/dev/null || true
pm2 delete payment-monitor 2>/dev/null || true

# Start the payment monitor with PM2
echo "▶️  Starting payment monitor..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup

echo "✅ Payment Monitor started successfully!"
echo "📊 Check status with: pm2 status"
echo "📋 View logs with: pm2 logs payment-monitor"
echo "🔄 Restart with: pm2 restart payment-monitor" 