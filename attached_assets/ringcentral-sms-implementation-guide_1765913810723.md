# RingCentral SMS API Implementation Guide
## Employee Shift Notification System

This guide walks through building a production-ready SMS notification system using RingCentral's API for sending shift availability alerts to employees.

---

## Phase 1: RingCentral Developer Console Setup

### Step 1.1: Create a REST API Application

1. Navigate to [https://developers.ringcentral.com](https://developers.ringcentral.com)
2. Sign in with your RingCentral admin credentials
3. Go to **Console** → **Create App**
4. Configure the application:
   - **App Name:** "Shift Notification System" (or your preferred name)
   - **App Type:** REST API App
   - **Auth Type:** JWT auth flow
   - **Application scoping:** Select specific users (recommended) or all users
5. Set the required permissions/scopes:
   - `SMS` — Required for sending messages
   - `ReadMessages` — Required for checking delivery status
   - `ReadAccounts` — Useful for verifying phone number capabilities
   - `SubscriptionWebhook` — Required if using webhooks for delivery tracking

### Step 1.2: Generate JWT Credentials

1. After app creation, go to **Credentials** tab
2. Under **JWT Credentials**, click **Create JWT**
3. Select the user/extension that will send SMS messages
4. Set expiration policy:
   - **Recommended for production:** No expiration (or long expiration like 1 year)
   - The JWT itself doesn't expire; it's used to obtain short-lived access tokens
5. **Save the JWT securely** — it's only shown once
6. Note your **Client ID** and **Client Secret** from the app credentials

### Step 1.3: Verify Extension SMS Capability

Before coding, confirm your sending extension has an SMS-enabled number:

1. Log into RingCentral Admin Portal
2. Navigate to **Phone System** → **Phone Numbers**
3. Find the number assigned to your sending extension
4. Verify SMS is enabled for that number

---

## Phase 2: Environment Configuration

### Step 2.1: Environment Variables

Create a `.env` file (never commit to version control):

```bash
# RingCentral API Configuration
RC_SERVER_URL=https://platform.ringcentral.com
RC_CLIENT_ID=your_client_id_here
RC_CLIENT_SECRET=your_client_secret_here
RC_JWT_TOKEN=your_jwt_token_here

# Sending Configuration
RC_FROM_NUMBER=+15551234567  # Your SMS-enabled extension number

# Webhook Configuration (if using)
WEBHOOK_URL=https://your-domain.com/webhooks/ringcentral
WEBHOOK_SECRET=your_webhook_verification_token

# Application Settings
SMS_RATE_LIMIT_PER_MINUTE=35  # Stay under 40 limit with buffer
MAX_RETRY_ATTEMPTS=3
```

### Step 2.2: Project Dependencies

**Node.js (package.json):**
```json
{
  "dependencies": {
    "@ringcentral/sdk": "^6.1.0",
    "dotenv": "^16.3.1",
    "express": "^4.18.2"
  }
}
```

**Python (requirements.txt):**
```
ringcentral==0.8.0
python-dotenv==1.0.0
flask==3.0.0
requests==2.31.0
```

---

## Phase 3: Core Authentication Module

### Step 3.1: Node.js Authentication Service

```javascript
// services/ringcentral-auth.js
const { SDK } = require('@ringcentral/sdk');
require('dotenv').config();

class RingCentralAuth {
    constructor() {
        this.sdk = new SDK({
            server: process.env.RC_SERVER_URL,
            clientId: process.env.RC_CLIENT_ID,
            clientSecret: process.env.RC_CLIENT_SECRET
        });
        this.platform = this.sdk.platform();
        this.isAuthenticated = false;
    }

    async authenticate() {
        try {
            // Check if we have a valid session
            const loggedIn = await this.platform.loggedIn();
            
            if (!loggedIn) {
                console.log('Authenticating with RingCentral...');
                await this.platform.login({ jwt: process.env.RC_JWT_TOKEN });
                console.log('Authentication successful');
            }
            
            this.isAuthenticated = true;
            return true;
        } catch (error) {
            console.error('Authentication failed:', error.message);
            this.isAuthenticated = false;
            throw error;
        }
    }

    async ensureAuthenticated() {
        // Re-authenticate if needed (tokens expire after 1 hour)
        if (!this.isAuthenticated || !(await this.platform.loggedIn())) {
            await this.authenticate();
        }
        return this.platform;
    }

    getPlatform() {
        return this.platform;
    }
}

// Singleton instance
const authService = new RingCentralAuth();
module.exports = authService;
```

### Step 3.2: Python Authentication Service

```python
# services/ringcentral_auth.py
import os
from ringcentral import SDK
from dotenv import load_dotenv

load_dotenv()

class RingCentralAuth:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        self.sdk = SDK(
            os.environ['RC_CLIENT_ID'],
            os.environ['RC_CLIENT_SECRET'],
            os.environ['RC_SERVER_URL']
        )
        self.platform = self.sdk.platform()
        self.is_authenticated = False
    
    def authenticate(self):
        try:
            if not self.platform.logged_in():
                print('Authenticating with RingCentral...')
                self.platform.login(jwt=os.environ['RC_JWT_TOKEN'])
                print('Authentication successful')
            
            self.is_authenticated = True
            return True
        except Exception as e:
            print(f'Authentication failed: {e}')
            self.is_authenticated = False
            raise
    
    def ensure_authenticated(self):
        if not self.is_authenticated or not self.platform.logged_in():
            self.authenticate()
        return self.platform
    
    def get_platform(self):
        return self.platform

# Singleton instance
auth_service = RingCentralAuth()
```

---

## Phase 4: SMS Sending Service

### Step 4.1: Node.js SMS Service with Rate Limiting

```javascript
// services/sms-service.js
const authService = require('./ringcentral-auth');
require('dotenv').config();

class SMSService {
    constructor() {
        this.fromNumber = process.env.RC_FROM_NUMBER;
        this.rateLimit = parseInt(process.env.SMS_RATE_LIMIT_PER_MINUTE) || 35;
        this.messageQueue = [];
        this.sentCount = 0;
        this.windowStart = Date.now();
    }

    // Check and reset rate limit window
    checkRateLimit() {
        const now = Date.now();
        if (now - this.windowStart >= 60000) {
            this.sentCount = 0;
            this.windowStart = now;
        }
        return this.sentCount < this.rateLimit;
    }

    // Calculate delay needed before next send
    getDelayMs() {
        if (this.checkRateLimit()) return 0;
        const elapsed = Date.now() - this.windowStart;
        return Math.max(0, 60000 - elapsed + 100); // Add 100ms buffer
    }

    // Send single SMS
    async sendSMS(toNumber, message, metadata = {}) {
        const platform = await authService.ensureAuthenticated();
        
        // Wait if rate limited
        const delay = this.getDelayMs();
        if (delay > 0) {
            console.log(`Rate limit reached, waiting ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            this.sentCount = 0;
            this.windowStart = Date.now();
        }

        try {
            const response = await platform.post(
                '/restapi/v1.0/account/~/extension/~/sms',
                {
                    from: { phoneNumber: this.fromNumber },
                    to: [{ phoneNumber: this.formatPhoneNumber(toNumber) }],
                    text: message
                }
            );

            this.sentCount++;
            const result = await response.json();
            
            return {
                success: true,
                messageId: result.id,
                status: result.messageStatus,
                to: toNumber,
                metadata
            };
        } catch (error) {
            return this.handleSendError(error, toNumber, metadata);
        }
    }

    // Send to multiple recipients (batch)
    async sendBatch(notifications) {
        const results = [];
        
        for (const notification of notifications) {
            const result = await this.sendSMS(
                notification.phoneNumber,
                notification.message,
                notification.metadata || {}
            );
            results.push(result);
            
            // Small delay between messages for stability
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        return results;
    }

    // Format phone number to E.164
    formatPhoneNumber(number) {
        // Remove all non-digits
        const digits = number.replace(/\D/g, '');
        
        // Add +1 for US numbers if not present
        if (digits.length === 10) {
            return `+1${digits}`;
        } else if (digits.length === 11 && digits.startsWith('1')) {
            return `+${digits}`;
        }
        
        // Return with + if not already present
        return number.startsWith('+') ? number : `+${digits}`;
    }

    // Handle API errors
    handleSendError(error, toNumber, metadata) {
        const errorResponse = {
            success: false,
            to: toNumber,
            metadata,
            error: {
                message: error.message,
                code: null,
                retryable: false
            }
        };

        // Parse RingCentral error response
        if (error.response) {
            try {
                const errorData = error.response.json();
                errorResponse.error.code = errorData.errorCode;
                errorResponse.error.message = errorData.message;
                
                // Determine if retryable
                const retryableCodes = ['CMN-301', 'CMN-302', 'SMS-CAR-104'];
                errorResponse.error.retryable = retryableCodes.includes(errorData.errorCode);
            } catch (e) {
                // Keep original error message
            }
        }

        // Handle rate limit (429)
        if (error.message?.includes('429')) {
            errorResponse.error.retryable = true;
            errorResponse.error.code = 'RATE_LIMITED';
        }

        console.error(`SMS send failed to ${toNumber}:`, errorResponse.error);
        return errorResponse;
    }
}

module.exports = new SMSService();
```

### Step 4.2: Python SMS Service

```python
# services/sms_service.py
import os
import re
import time
from services.ringcentral_auth import auth_service
from dotenv import load_dotenv

load_dotenv()

class SMSService:
    def __init__(self):
        self.from_number = os.environ['RC_FROM_NUMBER']
        self.rate_limit = int(os.environ.get('SMS_RATE_LIMIT_PER_MINUTE', 35))
        self.sent_count = 0
        self.window_start = time.time()
    
    def check_rate_limit(self):
        now = time.time()
        if now - self.window_start >= 60:
            self.sent_count = 0
            self.window_start = now
        return self.sent_count < self.rate_limit
    
    def wait_for_rate_limit(self):
        if self.check_rate_limit():
            return
        elapsed = time.time() - self.window_start
        delay = max(0, 60 - elapsed + 0.1)
        print(f'Rate limit reached, waiting {delay:.1f}s...')
        time.sleep(delay)
        self.sent_count = 0
        self.window_start = time.time()
    
    def format_phone_number(self, number):
        digits = re.sub(r'\D', '', number)
        if len(digits) == 10:
            return f'+1{digits}'
        elif len(digits) == 11 and digits.startswith('1'):
            return f'+{digits}'
        return number if number.startswith('+') else f'+{digits}'
    
    def send_sms(self, to_number, message, metadata=None):
        metadata = metadata or {}
        platform = auth_service.ensure_authenticated()
        
        self.wait_for_rate_limit()
        
        try:
            response = platform.post(
                '/restapi/v1.0/account/~/extension/~/sms',
                {
                    'from': {'phoneNumber': self.from_number},
                    'to': [{'phoneNumber': self.format_phone_number(to_number)}],
                    'text': message
                }
            )
            
            self.sent_count += 1
            result = response.json()
            
            return {
                'success': True,
                'message_id': result['id'],
                'status': result['messageStatus'],
                'to': to_number,
                'metadata': metadata
            }
        except Exception as e:
            return self._handle_error(e, to_number, metadata)
    
    def send_batch(self, notifications):
        results = []
        for notification in notifications:
            result = self.send_sms(
                notification['phone_number'],
                notification['message'],
                notification.get('metadata', {})
            )
            results.append(result)
            time.sleep(0.05)  # Small delay between messages
        return results
    
    def _handle_error(self, error, to_number, metadata):
        error_response = {
            'success': False,
            'to': to_number,
            'metadata': metadata,
            'error': {
                'message': str(error),
                'code': None,
                'retryable': False
            }
        }
        print(f'SMS send failed to {to_number}: {error}')
        return error_response

sms_service = SMSService()
```

---

## Phase 5: Shift Notification Business Logic

### Step 5.1: Notification Builder

```javascript
// services/shift-notification.js
const smsService = require('./sms-service');

class ShiftNotificationService {
    constructor() {
        // Message templates
        this.templates = {
            openShift: (shift) => 
                `Open shift: ${shift.date} ${shift.startTime}-${shift.endTime} at ${shift.location}. ` +
                `Reply YES to accept or STOP to opt-out.`,
            
            shiftConfirmed: (shift, employeeName) =>
                `Hi ${employeeName}, your shift on ${shift.date} ${shift.startTime}-${shift.endTime} ` +
                `at ${shift.location} is confirmed.`,
            
            shiftReminder: (shift, employeeName) =>
                `Reminder: ${employeeName}, you have a shift tomorrow ${shift.date} ` +
                `${shift.startTime}-${shift.endTime} at ${shift.location}.`,
            
            shiftCancelled: (shift) =>
                `Notice: The shift on ${shift.date} ${shift.startTime}-${shift.endTime} ` +
                `at ${shift.location} has been cancelled.`
        };
    }

    // Build notification message from template
    buildMessage(templateName, data) {
        const template = this.templates[templateName];
        if (!template) {
            throw new Error(`Unknown template: ${templateName}`);
        }
        
        const message = template(data.shift, data.employeeName);
        
        // Validate message length (160 chars = 1 SMS segment)
        if (message.length > 160) {
            console.warn(`Message exceeds 160 chars (${message.length}), will be segmented`);
        }
        
        return message;
    }

    // Notify single employee about open shift
    async notifyOpenShift(employee, shift) {
        // Check opt-out status first
        if (employee.smsOptedOut) {
            console.log(`Skipping ${employee.name} - opted out of SMS`);
            return { skipped: true, reason: 'opted_out' };
        }

        const message = this.buildMessage('openShift', { shift });
        
        return await smsService.sendSMS(
            employee.phoneNumber,
            message,
            {
                type: 'open_shift',
                employeeId: employee.id,
                shiftId: shift.id
            }
        );
    }

    // Notify multiple employees about open shift
    async broadcastOpenShift(employees, shift) {
        const eligibleEmployees = employees.filter(e => !e.smsOptedOut);
        const skipped = employees.length - eligibleEmployees.length;
        
        if (skipped > 0) {
            console.log(`Skipping ${skipped} opted-out employees`);
        }

        const notifications = eligibleEmployees.map(employee => ({
            phoneNumber: employee.phoneNumber,
            message: this.buildMessage('openShift', { shift }),
            metadata: {
                type: 'open_shift',
                employeeId: employee.id,
                shiftId: shift.id
            }
        }));

        const results = await smsService.sendBatch(notifications);
        
        return {
            total: employees.length,
            sent: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            skipped,
            results
        };
    }

    // Send shift confirmation
    async sendConfirmation(employee, shift) {
        if (employee.smsOptedOut) {
            return { skipped: true, reason: 'opted_out' };
        }

        const message = this.buildMessage('shiftConfirmed', {
            shift,
            employeeName: employee.firstName
        });

        return await smsService.sendSMS(
            employee.phoneNumber,
            message,
            {
                type: 'shift_confirmed',
                employeeId: employee.id,
                shiftId: shift.id
            }
        );
    }

    // Send shift reminder (typically day before)
    async sendReminder(employee, shift) {
        if (employee.smsOptedOut) {
            return { skipped: true, reason: 'opted_out' };
        }

        const message = this.buildMessage('shiftReminder', {
            shift,
            employeeName: employee.firstName
        });

        return await smsService.sendSMS(
            employee.phoneNumber,
            message,
            {
                type: 'shift_reminder',
                employeeId: employee.id,
                shiftId: shift.id
            }
        );
    }
}

module.exports = new ShiftNotificationService();
```

---

## Phase 6: Opt-Out Management

### Step 6.1: Opt-Out Service

```javascript
// services/opt-out-service.js
const authService = require('./ringcentral-auth');

class OptOutService {
    // Check if a number has opted out
    async checkOptOutStatus(phoneNumber) {
        const platform = await authService.ensureAuthenticated();
        
        try {
            const response = await platform.get(
                '/restapi/v1.0/account/~/a2p-sms/opt-outs',
                { to: phoneNumber }
            );
            
            const data = await response.json();
            const optedOut = data.records && data.records.length > 0;
            
            return {
                phoneNumber,
                optedOut,
                optOutDate: optedOut ? data.records[0].optOutDate : null
            };
        } catch (error) {
            console.error('Error checking opt-out status:', error.message);
            // Fail safe - assume not opted out but log for investigation
            return { phoneNumber, optedOut: false, error: error.message };
        }
    }

    // Bulk check opt-out status for multiple numbers
    async checkBulkOptOutStatus(phoneNumbers) {
        const results = [];
        
        for (const number of phoneNumbers) {
            const status = await this.checkOptOutStatus(number);
            results.push(status);
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return results;
    }

    // Sync opt-out status with your database
    async syncOptOutsToDatabase(employeeRepository) {
        const platform = await authService.ensureAuthenticated();
        
        try {
            // Get all opt-outs from RingCentral
            const response = await platform.get('/restapi/v1.0/account/~/a2p-sms/opt-outs');
            const data = await response.json();
            
            const optedOutNumbers = data.records.map(r => r.to);
            
            // Update your database
            for (const number of optedOutNumbers) {
                await employeeRepository.updateOptOutStatus(number, true);
            }
            
            console.log(`Synced ${optedOutNumbers.length} opt-outs to database`);
            return optedOutNumbers;
        } catch (error) {
            console.error('Error syncing opt-outs:', error.message);
            throw error;
        }
    }
}

module.exports = new OptOutService();
```

---

## Phase 7: Webhook Handler for Delivery Tracking

### Step 7.1: Webhook Setup and Handler

```javascript
// webhooks/ringcentral-webhook.js
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Webhook verification and message handling
router.post('/ringcentral', express.json(), async (req, res) => {
    const body = req.body;
    
    // Handle webhook validation request
    if (body.validationToken) {
        console.log('Webhook validation request received');
        res.setHeader('Validation-Token', body.validationToken);
        return res.status(200).send();
    }

    // Verify webhook signature (optional but recommended)
    const signature = req.headers['x-rc-signature'];
    if (signature && !verifySignature(req.body, signature)) {
        console.error('Invalid webhook signature');
        return res.status(401).send('Invalid signature');
    }

    // Process the webhook event
    try {
        await processWebhookEvent(body);
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Processing error');
    }
});

async function processWebhookEvent(event) {
    // Check if this is an SMS event
    if (!event.body || event.body.type !== 'SMS') {
        return;
    }

    const message = event.body;
    
    // Handle different message directions
    if (message.direction === 'Outbound') {
        await handleOutboundStatusUpdate(message);
    } else if (message.direction === 'Inbound') {
        await handleInboundMessage(message);
    }
}

async function handleOutboundStatusUpdate(message) {
    const { id, messageStatus, to } = message;
    
    console.log(`Delivery status update - ID: ${id}, Status: ${messageStatus}`);
    
    // Update your database with delivery status
    // Example statuses: Queued, Sent, Delivered, DeliveryFailed
    
    switch (messageStatus) {
        case 'Delivered':
            // Update notification record as delivered
            console.log(`Message ${id} delivered successfully`);
            break;
            
        case 'DeliveryFailed':
            // Log failure, potentially retry or alert
            console.error(`Message ${id} delivery failed`);
            // Check error code for specific handling
            break;
            
        case 'Sent':
            // Message sent to carrier, awaiting delivery confirmation
            console.log(`Message ${id} sent to carrier`);
            break;
    }
}

async function handleInboundMessage(message) {
    const { from, text } = message;
    const fromNumber = from.phoneNumber;
    const messageText = text?.toLowerCase().trim();
    
    console.log(`Inbound SMS from ${fromNumber}: ${text}`);
    
    // Handle STOP (opt-out) - RingCentral handles this automatically
    // but you may want to update your database
    if (messageText === 'stop') {
        console.log(`Opt-out received from ${fromNumber}`);
        // Update employee record in your database
        return;
    }
    
    // Handle YES (shift acceptance)
    if (messageText === 'yes') {
        console.log(`Shift acceptance from ${fromNumber}`);
        // Trigger shift acceptance workflow
        // await shiftService.acceptShiftByPhone(fromNumber);
        return;
    }
    
    // Handle other responses as needed
}

function verifySignature(body, signature) {
    // Implement signature verification if using webhook secrets
    // This is optional but adds security
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) return true; // Skip if no secret configured
    
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(body));
    const expectedSignature = hmac.digest('hex');
    
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}

module.exports = router;
```

### Step 7.2: Webhook Subscription Setup

```javascript
// setup/create-webhook-subscription.js
const authService = require('../services/ringcentral-auth');

async function createWebhookSubscription() {
    const platform = await authService.ensureAuthenticated();
    
    try {
        const response = await platform.post('/restapi/v1.0/subscription', {
            eventFilters: [
                '/restapi/v1.0/account/~/extension/~/message-store/instant?type=SMS'
            ],
            deliveryMode: {
                transportType: 'WebHook',
                address: process.env.WEBHOOK_URL,
                // Expiration in seconds (max 630720000 = 20 years)
                expiresIn: 630720000
            }
        });
        
        const subscription = await response.json();
        console.log('Webhook subscription created:', subscription.id);
        console.log('Expires:', subscription.expirationTime);
        
        return subscription;
    } catch (error) {
        console.error('Failed to create webhook subscription:', error.message);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    createWebhookSubscription()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = createWebhookSubscription;
```

---

## Phase 8: Express Application Integration

### Step 8.1: Main Application Entry Point

```javascript
// app.js
const express = require('express');
const authService = require('./services/ringcentral-auth');
const shiftNotificationService = require('./services/shift-notification');
const webhookRouter = require('./webhooks/ringcentral-webhook');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Webhook routes
app.use('/webhooks', webhookRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes for your application

// Send open shift notification to all eligible employees
app.post('/api/shifts/:shiftId/notify', async (req, res) => {
    try {
        const { shiftId } = req.params;
        const { employees, shift } = req.body;
        
        // Validate input
        if (!employees || !Array.isArray(employees)) {
            return res.status(400).json({ error: 'employees array required' });
        }
        if (!shift) {
            return res.status(400).json({ error: 'shift object required' });
        }
        
        // Send notifications
        const result = await shiftNotificationService.broadcastOpenShift(
            employees,
            { ...shift, id: shiftId }
        );
        
        res.json({
            success: true,
            summary: {
                total: result.total,
                sent: result.sent,
                failed: result.failed,
                skipped: result.skipped
            }
        });
    } catch (error) {
        console.error('Notification error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send single notification
app.post('/api/notify/employee', async (req, res) => {
    try {
        const { employee, shift, type } = req.body;
        
        let result;
        switch (type) {
            case 'open_shift':
                result = await shiftNotificationService.notifyOpenShift(employee, shift);
                break;
            case 'confirmation':
                result = await shiftNotificationService.sendConfirmation(employee, shift);
                break;
            case 'reminder':
                result = await shiftNotificationService.sendReminder(employee, shift);
                break;
            default:
                return res.status(400).json({ error: 'Invalid notification type' });
        }
        
        res.json(result);
    } catch (error) {
        console.error('Notification error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Initialize and start server
async function startServer() {
    try {
        // Authenticate with RingCentral on startup
        await authService.authenticate();
        console.log('RingCentral authentication initialized');
        
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
```

---

## Phase 9: n8n Integration Approach

For integration with n8n workflows, use HTTP Request nodes since there's no native RingCentral node.

### Step 9.1: n8n Token Management Workflow

Create a separate workflow that maintains a valid access token:

**Workflow: "RingCentral Token Refresh"**

1. **Schedule Trigger** — Run every 50 minutes
2. **HTTP Request Node** — POST to token endpoint:
   - URL: `https://platform.ringcentral.com/restapi/oauth/token`
   - Authentication: Basic Auth (Client ID : Client Secret)
   - Body (form-urlencoded):
     ```
     grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
     assertion={{$env.RC_JWT_TOKEN}}
     ```
3. **Set Node** — Store the access token
4. **Code Node** — Save token to a database or n8n static data

### Step 9.2: n8n SMS Sending Workflow

**Workflow: "Send Shift Notification"**

1. **Webhook Trigger** — Receive shift notification request
2. **HTTP Request Node** — Get stored access token (or call token workflow)
3. **HTTP Request Node** — Send SMS:
   - Method: POST
   - URL: `https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/sms`
   - Headers: 
     - `Authorization: Bearer {{accessToken}}`
     - `Content-Type: application/json`
   - Body:
     ```json
     {
       "from": { "phoneNumber": "+15551234567" },
       "to": [{ "phoneNumber": "{{$json.employeePhone}}" }],
       "text": "{{$json.message}}"
     }
     ```
4. **IF Node** — Check response status
5. **Error handling nodes** — Log failures, retry logic

---

## Phase 10: Testing Strategy

### Step 10.1: Unit Tests

```javascript
// tests/sms-service.test.js
const SMSService = require('../services/sms-service');

describe('SMSService', () => {
    describe('formatPhoneNumber', () => {
        test('formats 10-digit number correctly', () => {
            expect(SMSService.formatPhoneNumber('5551234567'))
                .toBe('+15551234567');
        });
        
        test('formats number with dashes', () => {
            expect(SMSService.formatPhoneNumber('555-123-4567'))
                .toBe('+15551234567');
        });
        
        test('preserves already formatted number', () => {
            expect(SMSService.formatPhoneNumber('+15551234567'))
                .toBe('+15551234567');
        });
    });
    
    describe('checkRateLimit', () => {
        test('allows messages under limit', () => {
            SMSService.sentCount = 0;
            expect(SMSService.checkRateLimit()).toBe(true);
        });
        
        test('blocks messages at limit', () => {
            SMSService.sentCount = 35;
            SMSService.windowStart = Date.now();
            expect(SMSService.checkRateLimit()).toBe(false);
        });
    });
});
```

### Step 10.2: Integration Test Script

```javascript
// tests/integration/send-test-sms.js
require('dotenv').config();
const smsService = require('../../services/sms-service');
const authService = require('../../services/ringcentral-auth');

async function runIntegrationTest() {
    const testNumber = process.env.TEST_PHONE_NUMBER;
    
    if (!testNumber) {
        console.error('Set TEST_PHONE_NUMBER environment variable');
        process.exit(1);
    }
    
    console.log('Starting integration test...');
    
    // Test authentication
    console.log('1. Testing authentication...');
    await authService.authenticate();
    console.log('   ✓ Authentication successful');
    
    // Test sending SMS
    console.log('2. Sending test SMS...');
    const result = await smsService.sendSMS(
        testNumber,
        'Test message from Shift Notification System. Reply STOP to opt-out.',
        { test: true }
    );
    
    if (result.success) {
        console.log('   ✓ SMS sent successfully');
        console.log(`   Message ID: ${result.messageId}`);
        console.log(`   Status: ${result.status}`);
    } else {
        console.log('   ✗ SMS failed');
        console.log(`   Error: ${result.error.message}`);
    }
    
    console.log('\nIntegration test complete');
}

runIntegrationTest().catch(console.error);
```

---

## Phase 11: Production Checklist

### Pre-Launch Verification

- [ ] A2P 10DLC registration confirmed active
- [ ] JWT credentials created and tested
- [ ] Webhook endpoint deployed and accessible (HTTPS required)
- [ ] Webhook subscription created
- [ ] Opt-out handling tested (send STOP, verify blocking)
- [ ] Rate limiting tested under load
- [ ] Error handling verified for common failures
- [ ] Employee consent collection process in place
- [ ] Alternative notification channel for opted-out employees
- [ ] Monitoring and alerting configured
- [ ] Message templates reviewed for compliance

### Monitoring Recommendations

1. **Track delivery rates** — Alert if delivery rate drops below 95%
2. **Monitor opt-out rate** — Sudden increases may indicate message issues
3. **Log all API errors** — Especially 429 (rate limit) and carrier errors
4. **Set up daily report** — Messages sent, delivered, failed, opt-outs

### Cost Monitoring

At ~1,000 messages/day × $0.0085/segment:
- Daily: ~$8.50
- Monthly: ~$255 + $12 TCR fee = ~$267
- Set billing alerts at $300/month to catch anomalies

---

## Quick Reference: Common Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| SMS-RC-413 | Recipient opted out | Skip this recipient, use alternative channel |
| SMS-CAR-411 | Invalid/landline number | Remove from SMS list, verify number |
| SMS-CAR-430 | Carrier spam filter | Review message content, check sender reputation |
| SMS-CAR-450 | Daily 10DLC limit exceeded | Spread messages over more time |
| CMN-301 | Request rate exceeded | Implement backoff, slow down |
| CMN-102 | Invalid resource | Check phone number format, extension access |

---

## Support Resources

- **RingCentral Developer Portal:** https://developers.ringcentral.com
- **API Reference:** https://developers.ringcentral.com/api-reference
- **Community Forum:** https://community.ringcentral.com
- **SMS Best Practices:** https://developers.ringcentral.com/guide/messaging/sms/best-practices
