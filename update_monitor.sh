#!/bin/bash

# Update Monitor with SMS Functionality
echo "🔄 Updating Payment Monitor with SMS functionality..."

# Stop the current monitor
echo "⏹️  Stopping current payment monitor..."
pm2 stop payment-monitor

# Backup current monitor.js
echo "💾 Backing up current monitor.js..."
cp monitor.js monitor.js.backup

# Update the monitor.js with SMS functionality
echo "📝 Updating monitor.js with SMS functionality..."

# The user should replace the monitor.js file with the updated version
echo "ℹ️  Please replace monitor.js with the updated version from GitHub"

# Add SMS_API_URL to production environment if not exists
if ! grep -q "SMS_API_URL" .env.production; then
    echo "🔧 Adding SMS configuration to .env.production..."
    echo "" >> .env.production
    echo "# SMS Configuration" >> .env.production
    echo "SMS_API_URL=https://billing.norismedia.com/api/send_voucher_sms.php" >> .env.production
fi

# Restart the monitor
echo "🚀 Starting updated payment monitor..."
pm2 start ecosystem.config.js

# Show status
echo "✅ Monitor updated! Checking status..."
pm2 status

echo ""
echo "🎉 Payment Monitor Updated Successfully!"
echo "📱 SMS notifications are now enabled"
echo "⚡ Users will receive SMS when vouchers are assigned"
echo ""
echo "Monitor logs:"
pm2 logs payment-monitor --lines 10

echo ""
echo "🔍 To verify SMS functionality:"
echo "1. Make a test payment"
echo "2. Check logs: pm2 logs payment-monitor"
echo "3. Look for: '📱 SMS sent successfully' messages" 
