# Real-Time Payment Monitor for WiFi Hotspot Billing

A high-performance Node.js payment monitor that provides **5-second real-time payment processing** for WiFi hotspot billing systems. This replaces slow 60-second PHP cron jobs with instant payment verification and automatic voucher assignment.

## 🚀 Features

- ⚡ **5-second payment monitoring** (12x faster than traditional cron jobs)
- 🎫 **Automatic voucher assignment** on payment completion
- 🔄 **Single persistent database connection** (no connection limits)
- 🛡️ **Auto-restart on crashes** and **auto-start on boot**
- 📊 **Real-time IOTEC payment gateway integration**
- 💾 **Dual table support** (payment_requests and transactions)
- 🔧 **Production-ready with PM2 process management**
- 📋 **Comprehensive logging** and monitoring

## 📋 Prerequisites

### VPS Requirements:
- **Ubuntu/CentOS/Debian** Linux VPS
- **Node.js 18+** installed
- **MySQL/MariaDB** database access
- **PM2** process manager (auto-installed)
- **Root or sudo access**

### Database Requirements:
- Existing WiFi billing database with:
  - `payment_requests` table
  - `transactions` table
  - `vouchers` table
- Remote database access enabled

### API Requirements:
- **IOTEC Payment Gateway** credentials:
  - Client ID
  - Client Secret
  - Wallet ID

## 🛠️ Installation & Deployment

### Step 1: Download and Extract

```bash
# Download the project
wget https://github.com/amonnoris1/mobilemoneyquicklogin/archive/main.zip
unzip main.zip
cd mobilemoneyquicklogin-main/nodejs-payment-monitor/

# Or clone with git
git clone https://github.com/amonnoris1/mobilemoneyquicklogin.git
cd mobilemoneyquicklogin/nodejs-payment-monitor/
```

### Step 2: Configure Environment

Edit the `.env.production` file with your credentials:

```bash
nano .env.production
```

```env
# Database Configuration
DB_HOST=your-database-host
DB_USER=your-database-user
DB_PASS=your-database-password
DB_NAME=your-database-name

# IOTEC Payment Gateway Configuration
IOTEC_CLIENT_ID=your-iotec-client-id
IOTEC_CLIENT_SECRET=your-iotec-client-secret
IOTEC_WALLET_ID=your-iotec-wallet-id
IOTEC_AUTH_URL=https://id.iotec.io
IOTEC_API_URL=https://pay.iotec.io/api

# Application Configuration
PORT=3000
POLL_INTERVAL=5000
```

### Step 3: Install Dependencies

```bash
# Install Node.js dependencies
npm install
```

### Step 4: Deploy as Production Service

```bash
# Make startup script executable
chmod +x start-monitor.sh

# Run the automated setup
./start-monitor.sh
```

## 🔧 Service Management

### Check Service Status
```bash
pm2 status
pm2 logs payment-monitor
pm2 monit
```

### Control the Service
```bash
pm2 restart payment-monitor    # Restart
pm2 stop payment-monitor       # Stop
pm2 start payment-monitor      # Start
pm2 delete payment-monitor     # Remove
```

### View Real-Time Logs
```bash
pm2 logs payment-monitor --lines 50
```

## 📊 How It Works

### Payment Processing Flow:

1. **Monitor Startup** → Connects to database and IOTEC API
2. **Continuous Polling** → Checks for pending payments every 5 seconds
3. **IOTEC Verification** → Queries IOTEC API for payment status
4. **Status Update** → Updates payment status in database
5. **Voucher Assignment** → Assigns available voucher on completion
6. **User Access** → Customer receives WiFi credentials instantly

### Database Tables:

- **`payment_requests`** → New payment system table
- **`transactions`** → Legacy payment system table
- **`vouchers`** → WiFi access vouchers pool

### Speed Comparison:

| Method | Update Time | User Experience |
|--------|-------------|-----------------|
| **Old PHP Cron** | 60 seconds | Slow, frustrated users |
| **Our Node.js Monitor** | 5 seconds | Instant, happy users |
| **Competitors** | 5-15 seconds | Standard market speed |

## 🔧 Configuration Options

### Environment Variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `POLL_INTERVAL` | 5000 | Payment check interval (milliseconds) |
| `NODE_ENV` | production | Application environment |
| `PORT` | 3000 | Application port (if needed) |

### PM2 Configuration:

The service is configured with:
- **Auto-restart** on crashes
- **Memory limit** of 1GB
- **Boot startup** enabled
- **Log rotation** enabled
- **Health monitoring** enabled

## 🚨 Troubleshooting

### Common Issues:

**1. Database Connection Limit:**
```
User has exceeded the 'max_connections_per_hour' resource
```
**Solution:** The monitor uses only 1 persistent connection, this usually resolves within an hour.

**2. IOTEC API Authentication:**
```
Failed to get access token: invalid_client
```
**Solution:** Verify your IOTEC credentials in `.env.production`

**3. Service Won't Start:**
```
pm2 start ecosystem.config.js
```

**4. Permission Denied:**
```bash
chmod +x start-monitor.sh
sudo ./start-monitor.sh
```

### Log Locations:
- **Application logs:** `pm2 logs payment-monitor`
- **Error logs:** `./logs/err.log`
- **Combined logs:** `./logs/combined.log`

## 📈 Performance Monitoring

### Success Indicators:
```
✅ Single database connection created successfully
✅ IOTEC API connection successful
✅ Payment monitor started successfully
⏰ 8:12:05 PM - Monitoring... (no recent pending payments)
```

### Payment Processing:
```
🔍 Found 1 pending payments to check
🎫 Payment completed! Assigning voucher for PAY-xxxxx...
✅ Voucher 12345 assigned to transaction 67890
```

## 🔄 Migration from PHP Cron

### Before Deployment:
1. **Backup your database**
2. **Test with small payments first**
3. **Keep PHP cron as backup initially**

### After Successful Testing:
1. **Disable PHP cron job**
2. **Monitor Node.js service for 24 hours**
3. **Remove PHP cron completely**

## 🛡️ Security & Reliability

- **Environment variables** for sensitive data
- **Single connection** prevents database overload
- **Auto-restart** on failures
- **Boot persistence** survives server restarts
- **Error handling** with graceful recovery
- **Connection timeout** protection

## 💡 Advanced Usage

### Custom Polling Interval:
```bash
# Set to 10 seconds for less frequent checking
export POLL_INTERVAL=10000
pm2 restart payment-monitor
```

### Manual Service Setup:
```bash
# If automatic script fails
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 📞 Support

For issues and support:
1. Check the **troubleshooting section** above
2. Review **PM2 logs** for specific errors
3. Verify **database connectivity** and **IOTEC credentials**
4. Test **manual Node.js execution** first

## 📄 License

This project is proprietary software for WiFi hotspot billing systems.

---

**🚀 Enjoy lightning-fast 5-second payment processing with automatic voucher assignment!** 