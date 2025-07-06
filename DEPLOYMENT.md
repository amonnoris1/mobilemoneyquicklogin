# VPS Deployment Guide

This guide provides step-by-step instructions for deploying the WiFi Hotspot Payment Monitor on a VPS (Virtual Private Server).

## 📋 Prerequisites

### Server Requirements
- **Operating System**: Ubuntu 18.04+ / CentOS 7+ / Debian 9+
- **RAM**: Minimum 512MB (1GB recommended)
- **CPU**: 1 core minimum
- **Storage**: 1GB available space
- **Network**: Stable internet connection

### Software Requirements
- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher
- **PM2**: Process manager (auto-installed)
- **MySQL/MariaDB**: Database access (can be remote)

### Access Requirements
- **SSH access** to your VPS
- **Root or sudo privileges**
- **Database credentials** (can be remote database)
- **IOTEC payment gateway credentials**

## 🚀 Step-by-Step Deployment

### Step 1: Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget unzip git build-essential

# Install Node.js (using NodeSource repository)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x or higher
npm --version   # Should show 8.x.x or higher
```

### Step 2: Download and Extract

```bash
# Create application directory
sudo mkdir -p /opt/payment-monitor
cd /opt/payment-monitor

# Download from GitHub
sudo wget https://github.com/amonnoris1/mobilemoneyquicklogin/archive/main.zip
sudo unzip main.zip
sudo mv mobilemoneyquicklogin-main/nodejs-payment-monitor/* .
sudo rm -rf mobilemoneyquicklogin-main main.zip

# Set proper permissions
sudo chown -R $USER:$USER /opt/payment-monitor
chmod +x start-monitor.sh
```

### Step 3: Configure Environment

```bash
# Copy template and edit configuration
cp env.template .env.production
nano .env.production
```

**Fill in your actual credentials:**
```env
# Database Configuration
DB_HOST=your-database-host
DB_USER=your-database-user
DB_PASS=your-database-password
DB_NAME=your-database-name

# IOTEC Configuration
IOTEC_CLIENT_ID=your-iotec-client-id
IOTEC_CLIENT_SECRET=your-iotec-client-secret
IOTEC_WALLET_ID=your-iotec-wallet-id
IOTEC_AUTH_URL=https://id.iotec.io
IOTEC_API_URL=https://pay.iotec.io/api

# Application Configuration
NODE_ENV=production
PORT=3000
POLL_INTERVAL=5000
```

### Step 4: Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install PM2 globally
sudo npm install -g pm2
```

### Step 5: Test Database Connection

```bash
# Create a quick test script
cat > test-db.js << 'EOF'
require('dotenv').config({ path: '.env.production' });
const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });
    
    console.log('✅ Database connection successful');
    
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM payment_requests');
    console.log(`📊 Found ${rows[0].count} payment requests in database`);
    
    await connection.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

testConnection();
EOF

# Run database test
node test-db.js

# Remove test file
rm test-db.js
```

### Step 6: Deploy Service

```bash
# Run automated deployment
./start-monitor.sh
```

**The script will:**
- Install PM2 if not already installed
- Start the payment monitor service
- Configure auto-restart on crashes
- Set up boot persistence
- Show service status

### Step 7: Verify Deployment

```bash
# Check service status
pm2 status

# View real-time logs
pm2 logs payment-monitor

# Check system startup configuration
pm2 startup
```

**Expected output:**
```
┌─────────────────────┬────┬─────────┬──────┬───────┬────────┬─────────┬────────┬─────┬───────────┬──────────┬──────────┐
│ App name            │ id │ version │ mode │ pid   │ status │ restart │ uptime │ cpu │ mem       │ user     │ watching │
├─────────────────────┼────┼─────────┼──────┼───────┼────────┼─────────┼────────┼─────┼───────────┼──────────┼──────────┤
│ payment-monitor     │ 0  │ 1.0.0   │ fork │ 12345 │ online │ 0       │ 5s     │ 0%  │ 45.2 MB   │ root     │ disabled │
└─────────────────────┴────┴─────────┴──────┴───────┴────────┴─────────┴────────┴─────┴───────────┴──────────┴──────────┘
```

## 🔧 Advanced Configuration

### Custom Port Configuration

If you need to run on a different port:
```bash
# Edit environment file
nano .env.production

# Change PORT value
PORT=3001

# Restart service
pm2 restart payment-monitor
```

### Firewall Configuration

```bash
# Allow Node.js port (if needed)
sudo ufw allow 3000/tcp

# Allow SSH (important!)
sudo ufw allow ssh

# Enable firewall
sudo ufw enable
```

### SSL/HTTPS Setup (Optional)

If you need HTTPS access:
```bash
# Install Nginx
sudo apt install -y nginx

# Configure reverse proxy
sudo nano /etc/nginx/sites-available/payment-monitor
```

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/payment-monitor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 📊 Monitoring and Maintenance

### View Service Status
```bash
pm2 status
pm2 info payment-monitor
pm2 monit
```

### Check Logs
```bash
# Real-time logs
pm2 logs payment-monitor --lines 50

# Error logs only
pm2 logs payment-monitor --err

# Save logs to file
pm2 logs payment-monitor > payment-monitor.log
```

### Performance Monitoring
```bash
# System resources
htop
df -h
free -h

# Network connections
netstat -tulpn | grep :3000
```

### Database Health Check
```bash
# Create monitoring script
cat > check-health.js << 'EOF'
require('dotenv').config({ path: '.env.production' });
const mysql = require('mysql2/promise');

async function healthCheck() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });
    
    const [pending] = await connection.execute(
      'SELECT COUNT(*) as count FROM payment_requests WHERE status = "pending"'
    );
    
    const [recent] = await connection.execute(
      'SELECT COUNT(*) as count FROM payment_requests WHERE updated_at > NOW() - INTERVAL 1 HOUR'
    );
    
    console.log(`🔍 Pending payments: ${pending[0].count}`);
    console.log(`📊 Recent updates: ${recent[0].count}`);
    
    await connection.end();
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
}

healthCheck();
EOF

# Run health check
node check-health.js
```

## 🚨 Troubleshooting

### Common Issues and Solutions

**1. Service Won't Start**
```bash
# Check logs for errors
pm2 logs payment-monitor --err

# Verify configuration
node -e "console.log(require('dotenv').config({ path: '.env.production' }))"

# Try manual start
node monitor.js
```

**2. Database Connection Issues**
```bash
# Test connection manually
mysql -h YOUR_HOST -u YOUR_USER -p YOUR_DATABASE

# Check firewall
sudo ufw status

# Verify credentials
cat .env.production
```

**3. PM2 Service Issues**
```bash
# Reset PM2
pm2 kill
pm2 start ecosystem.config.js

# Reconfigure startup
pm2 startup
pm2 save
```

**4. High Memory Usage**
```bash
# Check memory usage
pm2 monit

# Restart if needed
pm2 restart payment-monitor

# Check for memory leaks
pm2 logs payment-monitor | grep -i memory
```

### Emergency Rollback

If you need to rollback to the old PHP cron system:
```bash
# Stop Node.js service
pm2 stop payment-monitor
pm2 delete payment-monitor

# Re-enable PHP cron
crontab -e
# Add: */1 * * * * /usr/bin/php /path/to/cron/check_pending_payments.php
```

## 🔄 Updates and Maintenance

### Updating the Service
```bash
# Backup current installation
sudo cp -r /opt/payment-monitor /opt/payment-monitor.backup

# Download new version
cd /opt/payment-monitor
sudo wget https://github.com/amonnoris1/mobilemoneyquicklogin/archive/main.zip
sudo unzip main.zip
sudo cp -r mobilemoneyquicklogin-main/nodejs-payment-monitor/* .

# Restart service
pm2 restart payment-monitor
```

### Regular Maintenance
```bash
# Weekly log cleanup
pm2 flush

# Monthly system updates
sudo apt update && sudo apt upgrade -y

# Check disk space
df -h
```

## 📞 Support

If you encounter issues:
1. Check the **troubleshooting section** above
2. Review **PM2 logs** for specific errors
3. Verify **database connectivity** and **IOTEC credentials**
4. Create an issue on GitHub with:
   - VPS specifications
   - Error logs
   - Configuration (without sensitive data)
   - Steps to reproduce

---

**🚀 Your payment monitor is now running 24/7 with lightning-fast 5-second processing!** 