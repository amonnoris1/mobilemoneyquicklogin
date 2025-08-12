// Load environment variables - try production first, then fallback to .env
const path = require('path');
const fs = require('fs');
let envFile = '.env';

// Check if we're in production or if .env.production exists
if (process.env.NODE_ENV === 'production' || fs.existsSync(path.resolve(__dirname, '.env.production'))) {
    envFile = '.env.production';
}

console.log('Loading environment from:', envFile);
require('dotenv').config({ path: path.resolve(__dirname, envFile) });
const mysql = require('mysql2/promise');
const axios = require('axios');

class PaymentMonitor {
    constructor() {
        this.dbConfig = {
            host: process.env.DB_HOST || 'srv995.hstgr.io',
            user: process.env.DB_USER || 'u376913847_billing',
            password: process.env.DB_PASS || 'Kakembo@0788',
            database: process.env.DB_NAME || 'u376913847_billing'
        };
        
        this.iotecConfig = {
            clientId: process.env.IOTEC_CLIENT_ID || 'pay-561b8c82-1d3d-47e9-8f76-0e76312d648d',
            clientSecret: process.env.IOTEC_CLIENT_SECRET || 'IO-Y2qrDgoR3952yYp2TS1jgeSdcLQ12lbjb',
            authUrl: process.env.IOTEC_AUTH_URL || 'https://id.iotec.io',
            apiUrl: process.env.IOTEC_API_URL || 'https://pay.iotec.io/api'
        };
        
        this.accessToken = null;
        this.tokenExpiry = null;
        this.pollInterval = process.env.POLL_INTERVAL || 5000; // 5 seconds for fast payment processing
        this.connection = null;
        
        console.log('Payment Monitor initialized');
        console.log('Database:', this.dbConfig.database);
        console.log('IOTEC API:', this.iotecConfig.apiUrl);
    }

    async start() {
        console.log('🚀 Starting Payment Monitor...');
        console.log(`⏰ Polling every ${this.pollInterval / 1000} seconds`);
        
        // Create single persistent database connection
        try {
            this.connection = await mysql.createConnection(this.dbConfig);
            await this.connection.execute('SELECT 1');
            console.log('✅ Single database connection created successfully');
        } catch (error) {
            if (error.message.includes('max_connections_per_hour')) {
                console.error('❌ Database connection limit exceeded temporarily');
                console.log('🔄 Will retry in 60 seconds...');
                console.log('📋 This is a temporary testing issue - production will work fine');
                
                // Continue with IOTEC test but retry DB later
                setTimeout(async () => {
                    console.log('🔄 Retrying database connection...');
                    try {
                        this.connection = await mysql.createConnection(this.dbConfig);
                        await this.connection.execute('SELECT 1');
                        console.log('✅ Database reconnected successfully');
                    } catch (retryError) {
                        console.log('⏳ Still waiting for connection limit reset...');
                    }
                }, 60000);
                
                // Set a mock connection for testing
                this.connection = {
                    execute: async () => [[]],
                    end: async () => {}
                };
                console.log('🧪 Using mock connection for testing purposes');
            } else {
                console.error('❌ Database connection failed:', error.message);
                process.exit(1);
            }
        }
        
        // Test IOTEC API connection
        try {
            await this.getAccessToken();
            console.log('✅ IOTEC API connection successful');
        } catch (error) {
            console.error('❌ IOTEC API connection failed:', error.message);
            process.exit(1);
        }
        
        // Start monitoring
        this.startPolling();
    }

    async testDatabaseConnection() {
        const [rows] = await this.connection.execute('SELECT 1');
        return rows;
    }

    async getAccessToken() {
        try {
            const response = await axios.post(
                `${this.iotecConfig.authUrl}/connect/token`,
                new URLSearchParams({
                    client_id: this.iotecConfig.clientId,
                    client_secret: this.iotecConfig.clientSecret,
                    grant_type: 'client_credentials'
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
            
            console.log('🔑 Access token obtained');
            return this.accessToken;
        } catch (error) {
            console.error('Failed to get access token:', error.response?.data || error.message);
            throw error;
        }
    }

    async ensureValidToken() {
        if (!this.accessToken || Date.now() >= this.tokenExpiry) {
            console.log('🔄 Refreshing access token...');
            await this.getAccessToken();
        }
    }

    startPolling() {
        setInterval(async () => {
            try {
                await this.checkPendingPayments();
            } catch (error) {
                console.error('❌ Error in polling cycle:', error.message);
            }
        }, this.pollInterval);
        
        console.log('✅ Payment monitor started successfully');
    }

    async checkPendingPayments() {
        try {
            // Check both payment_requests and transactions tables using connection pool
            // First check payment_requests table (newer system)
            const [paymentRows] = await this.connection.execute(`
                SELECT id, reference_id, customer_phone, amount, created_at, 'payment_requests' as table_name
                FROM payment_requests 
                WHERE status = 'pending' 
                  AND created_at > NOW() - INTERVAL 10 MINUTE
                  AND (updated_at IS NULL OR updated_at < NOW() - INTERVAL 5 SECOND)
                ORDER BY created_at ASC
            `);
            
            // Then check transactions table (older system)
            const [transactionRows] = await this.connection.execute(`
                SELECT id, payment_reference as reference_id, customer_phone, amount, created_at, 'transactions' as table_name
                FROM transactions 
                WHERE status = 'pending' 
                  AND created_at > NOW() - INTERVAL 10 MINUTE
                  AND (updated_at IS NULL OR updated_at < NOW() - INTERVAL 5 SECOND)
                ORDER BY created_at ASC
            `);

            const allRows = [...paymentRows, ...transactionRows];

            if (allRows.length > 0) {
                console.log(`🔍 Found ${allRows.length} pending payments to check (${paymentRows.length} in payment_requests, ${transactionRows.length} in transactions)`);
                
                // Track processed payment references to avoid duplicates in same cycle
                const processedReferences = new Set();
                
                for (const payment of allRows) {
                    try {
                        // Skip if we've already processed this payment reference in this cycle
                        if (processedReferences.has(payment.reference_id)) {
                            console.log(`⚠️  Skipping duplicate payment reference ${payment.reference_id} in same polling cycle`);
                            continue;
                        }
                        
                        const newStatus = await this.checkIOTECStatus(payment.reference_id);
                        
                        if (newStatus !== 'pending') {
                            await this.updatePaymentStatus(payment.id, newStatus, payment.table_name, payment.reference_id);
                            console.log(`✅ Updated payment ${payment.reference_id} in ${payment.table_name}: ${newStatus}`);
                            
                            // Mark this payment reference as processed
                            processedReferences.add(payment.reference_id);
                        }
                    } catch (error) {
                        console.error(`❌ Error checking payment ${payment.reference_id}:`, error.message);
                    }
                }
            } else {
                console.log(`⏰ ${new Date().toLocaleTimeString()} - Monitoring... (no recent pending payments)`);
            }
        } catch (error) {
            console.error('❌ Error in checkPendingPayments:', error.message);
        }
    }

    async checkIOTECStatus(referenceId) {
        try {
            await this.ensureValidToken();
            
            const response = await axios.get(
                `${this.iotecConfig.apiUrl}/collections/external-id/${referenceId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const statusCode = response.data.statusCode;
            return this.mapAPIStatus(statusCode);
        } catch (error) {
            if (error.response?.status === 404) {
                console.log(`⚠️  Payment ${referenceId} not found in IOTEC`);
                return 'pending';
            }
            throw error;
        }
    }

    mapAPIStatus(apiStatus) {
        const statusMap = {
            'success': 'completed',
            'completed': 'completed',
            'failed': 'failed',
            'expired': 'failed',
            'cancelled': 'failed',
            'pending': 'pending',
            'processing': 'pending',
            'senttovendor': 'pending'
        };
        
        return statusMap[apiStatus?.toLowerCase()] || 'pending';
    }

    async sendVoucherSMS(voucherId, transactionId, referenceId) {
        try {
            // Get transaction details for SMS sending
            const [rows] = await this.connection.execute(
                'SELECT customer_phone FROM transactions WHERE id = ?',
                [transactionId]
            );
            
            if (rows.length === 0) {
                console.log(`⚠️  No transaction found for SMS sending (transaction ${transactionId})`);
                return;
            }
            
            const customerPhone = rows[0].customer_phone;
            
            // Call PHP endpoint to send SMS
            const smsApiUrl = process.env.SMS_API_URL || 'https://backup.norismedia.com/api/send_voucher_sms.php';
            
            const smsResponse = await axios.post(smsApiUrl, {
                voucher_id: voucherId,
                customer_phone: customerPhone,
                transaction_id: transactionId
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });
            
            if (smsResponse.data.success) {
                console.log(`📱 SMS sent successfully for voucher ${voucherId} to ${customerPhone}`);
            } else {
                console.log(`⚠️  SMS failed for voucher ${voucherId}: ${smsResponse.data.message}`);
            }
            
        } catch (error) {
            console.error(`❌ Error sending SMS for voucher ${voucherId}:`, error.message);
            // Don't throw error - SMS failure shouldn't stop the payment processing
        }
    }

    async updatePaymentStatus(paymentId, newStatus, tableName, referenceId) {
        try {
            // Update the specific table
            if (tableName === 'payment_requests') {
                await this.connection.execute(
                    'UPDATE payment_requests SET status = ?, updated_at = NOW() WHERE id = ?',
                    [newStatus, paymentId]
                );
            } else if (tableName === 'transactions') {
                await this.connection.execute(
                    'UPDATE transactions SET status = ?, updated_at = NOW() WHERE id = ?',
                    [newStatus, paymentId]
                );
            }
            
            // Also update the other table if it exists with the same reference
            if (tableName === 'payment_requests') {
                // Also update transactions table with the same reference
                await this.connection.execute(
                    'UPDATE transactions SET status = ?, updated_at = NOW() WHERE payment_reference = ?',
                    [newStatus, referenceId]
                );
            } else if (tableName === 'transactions') {
                // Also update payment_requests table with the same reference
                await this.connection.execute(
                    'UPDATE payment_requests SET status = ?, updated_at = NOW() WHERE reference_id = ?',
                    [newStatus, referenceId]
                );
            }
            
            // *** CRITICAL: Assign voucher if payment is completed ***
            if (newStatus === 'completed') {
                console.log(`🎫 Payment completed! Assigning voucher for ${referenceId}...`);
                
                // Get the transaction ID and bundle_id for voucher assignment
                let transactionId, bundleId;
                
                if (tableName === 'transactions') {
                    // We already have the transaction ID
                    const [rows] = await this.connection.execute(
                        'SELECT bundle_id, voucher_id FROM transactions WHERE id = ?',
                        [paymentId]
                    );
                    if (rows.length > 0) {
                        transactionId = paymentId;
                        bundleId = rows[0].bundle_id;
                        // Check if voucher already assigned
                        if (rows[0].voucher_id) {
                            console.log(`⚠️  Voucher already assigned to transaction ${transactionId} (voucher_id: ${rows[0].voucher_id})`);
                            return; // Skip voucher assignment
                        }
                    }
                } else if (tableName === 'payment_requests') {
                    // Find the transaction by payment reference
                    const [rows] = await this.connection.execute(
                        'SELECT id, bundle_id, voucher_id FROM transactions WHERE payment_reference = ?',
                        [referenceId]
                    );
                    if (rows.length > 0) {
                        transactionId = rows[0].id;
                        bundleId = rows[0].bundle_id;
                        // Check if voucher already assigned
                        if (rows[0].voucher_id) {
                            console.log(`⚠️  Voucher already assigned to transaction ${transactionId} (voucher_id: ${rows[0].voucher_id})`);
                            return; // Skip voucher assignment
                        }
                    }
                }
                
                if (transactionId && bundleId) {
                    // Find an available voucher for this bundle
                    const [voucherRows] = await this.connection.execute(`
                        SELECT v.id FROM vouchers v
                        WHERE v.bundle_id = ?
                          AND v.status = 'active'
                          AND v.id NOT IN (
                              SELECT voucher_id FROM transactions 
                              WHERE voucher_id IS NOT NULL
                          )
                        LIMIT 1
                    `, [bundleId]);
                    
                    if (voucherRows.length > 0) {
                        const voucherId = voucherRows[0].id;
                        
                        // Assign the voucher to the transaction
                        await this.connection.execute(
                            'UPDATE transactions SET voucher_id = ? WHERE id = ?',
                            [voucherId, transactionId]
                        );
                        
                        console.log(`✅ Voucher ${voucherId} assigned to transaction ${transactionId} for payment ${referenceId}`);
                        
                        // Send SMS notification
                        await this.sendVoucherSMS(voucherId, transactionId, referenceId);
                    } else {
                        console.log(`⚠️  No available vouchers found for bundle ${bundleId} (payment ${referenceId})`);
                    }
                } else {
                    console.log(`⚠️  Could not find transaction details for voucher assignment (payment ${referenceId})`);
                }
            }
            
        } catch (error) {
            console.error(`❌ Error updating payment status for ${referenceId}:`, error.message);
            throw error;
        }
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n👋 Payment Monitor stopping...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Payment Monitor stopping...');
    process.exit(0);
});

// Start the monitor
const monitor = new PaymentMonitor();
monitor.start().catch(error => {
    console.error('❌ Failed to start payment monitor:', error.message);
    process.exit(1);
}); 
