# Twilio SMS Implementation Plan for ShiftConnect

## Executive Summary

This document outlines a comprehensive plan to implement Twilio SMS messaging as a fully-managed feature within ShiftConnect. The application already has foundational SMS infrastructure in place, including database schema, UI components, and opt-in management. This plan builds upon that foundation to create a complete, production-ready SMS notification system.

---

## Current State Analysis

### Existing Infrastructure

| Component | Status | Location |
|-----------|--------|----------|
| Messages table with `twilioSid` | ✅ Implemented | `shared/schema.ts` |
| Employee `smsOptIn` field | ✅ Implemented | `shared/schema.ts` |
| Area `smsEnabled` field | ✅ Implemented | `shared/schema.ts` |
| SMS Compose UI | ✅ Implemented | `client/src/components/SMSCompose.tsx` |
| Recipient targeting logic | ✅ Implemented | `server/routes.ts` (POST /api/shifts) |
| Notification toggle in shift form | ✅ Implemented | `client/src/pages/NewShift.tsx` |
| Twilio API integration | ❌ TODO | `server/routes.ts:443-444, 480` |

### Key Findings

1. **Database Ready**: The `messages` table already stores `twilioSid` for tracking
2. **Opt-In Management**: Employee and Area level SMS preferences exist
3. **UI Components**: SMS composition interface is built
4. **Recipient Logic**: Shift notification targeting (by area, availability) exists
5. **Missing**: Actual Twilio SDK integration, delivery tracking, templates, analytics

---

## Proposed Features

### Phase 1: Core Integration (Foundation)

#### 1.1 Twilio Service Module
Create a dedicated service for all Twilio operations.

```typescript
// server/services/twilio.ts
interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  messagingServiceSid?: string; // For high-volume sending
}

interface SendSMSResult {
  success: boolean;
  twilioSid?: string;
  errorCode?: string;
  errorMessage?: string;
}
```

**Features:**
- Connection pooling and rate limiting
- Automatic retry with exponential backoff
- Error classification (recoverable vs permanent)
- Phone number validation (E.164 format)

#### 1.2 Delivery Status Webhooks
Implement webhook endpoint for Twilio status callbacks.

**Statuses to track:**
- `queued` - Message accepted by Twilio
- `sent` - Message sent to carrier
- `delivered` - Confirmed delivery to device
- `undelivered` - Carrier rejection
- `failed` - Permanent failure

**Database updates:**
```sql
ALTER TABLE messages ADD COLUMN delivery_status VARCHAR(20);
ALTER TABLE messages ADD COLUMN delivery_timestamp TIMESTAMP;
ALTER TABLE messages ADD COLUMN error_code VARCHAR(10);
ALTER TABLE messages ADD COLUMN segments INTEGER DEFAULT 1;
```

#### 1.3 Organization Settings for Twilio

| Setting Key | Description | Default |
|-------------|-------------|---------|
| `twilio_account_sid` | Twilio Account SID | - |
| `twilio_auth_token` | Twilio Auth Token (encrypted) | - |
| `twilio_from_number` | Sending phone number | - |
| `twilio_messaging_service_sid` | Optional messaging service | - |
| `sms_enabled` | Master toggle for SMS | `false` |
| `sms_daily_limit` | Max messages per day | `1000` |
| `sms_rate_limit_per_minute` | Rate limiting | `60` |

---

### Phase 2: Shift Notifications (Core Use Case)

#### 2.1 New Shift Notifications
Automatically notify eligible employees when shifts are posted.

**Trigger:** New shift created with `sendNotification: true`

**Message Template:**
```
[{org_name}] New {position} shift available!
📅 {date} {start_time}-{end_time}
📍 {location}
Reply CLAIM to accept or view in app: {app_link}
```

**Recipient Selection Logic:**
1. Employees in the shift's area
2. With `smsOptIn = true`
3. Available during shift time (future: availability calendar)
4. Not already assigned to overlapping shift

#### 2.2 Shift Claimed Notifications
Notify the assigned employee and admins.

**To Employee:**
```
[{org_name}] Shift Confirmed!
You're scheduled for {position} on {date} {start_time}-{end_time} at {location}.
Questions? Reply to this message.
```

**To Admin (optional setting):**
```
[{org_name}] Shift Filled
{employee_name} claimed the {position} shift on {date}.
```

#### 2.3 Shift Reminder Notifications
Configurable reminders before shift start.

**Settings:**
- `shift_reminder_hours`: Hours before shift (default: 24)
- `shift_reminder_enabled`: Toggle (default: true)

**Message:**
```
[{org_name}] Reminder: Your shift starts in {hours} hours
{position} at {location}
{date} {start_time}-{end_time}
```

#### 2.4 Shift Cancellation Notifications
Alert affected employees when shifts are cancelled.

**Message:**
```
[{org_name}] Shift Cancelled
The {position} shift on {date} has been cancelled.
Contact your supervisor with questions.
```

---

### Phase 3: Two-Way Messaging

#### 3.1 Inbound Message Handling
Process replies from employees.

**Webhook endpoint:** `POST /api/webhooks/twilio/inbound`

**Supported Commands:**
| Command | Action |
|---------|--------|
| `CLAIM` | Claim the most recent available shift offered |
| `STOP` | Opt-out of SMS notifications |
| `START` | Opt back in to SMS notifications |
| `HELP` | Send available commands |
| `STATUS` | Get upcoming shift info |

**Free-form messages:** Route to Messages inbox for supervisor review.

#### 3.2 Conversation Threading
Link inbound/outbound messages for context.

**Database updates:**
```sql
ALTER TABLE messages ADD COLUMN thread_id VARCHAR(36);
ALTER TABLE messages ADD COLUMN in_reply_to VARCHAR(36);
ALTER TABLE messages ADD COLUMN direction VARCHAR(10); -- 'inbound' | 'outbound'
```

#### 3.3 Admin SMS Console
UI for admins to view and respond to employee messages.

**Features:**
- Threaded conversation view
- Quick reply templates
- Bulk messaging capability
- Search and filter by employee/date

---

### Phase 4: Message Templates

#### 4.1 Template Management System
Allow admins to customize message templates.

**Database Schema:**
```sql
CREATE TABLE sms_templates (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'shift_notification', 'reminder', 'custom'
  content TEXT NOT NULL,
  variables TEXT[], -- Available merge fields
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Variable Substitution:**
- `{employee_name}` - Recipient's name
- `{org_name}` - Organization name
- `{position}` - Shift position
- `{date}` - Shift date
- `{start_time}` / `{end_time}` - Shift times
- `{location}` - Shift location
- `{app_link}` - Deep link to app

#### 4.2 Default Templates
Pre-configured templates that can be customized:

1. **New Shift Available**
2. **Shift Claimed Confirmation**
3. **Shift Reminder (24h)**
4. **Shift Reminder (2h)**
5. **Shift Cancelled**
6. **Welcome Message** (on opt-in)
7. **Opt-Out Confirmation**

---

### Phase 5: Analytics & Reporting

#### 5.1 SMS Dashboard
Real-time metrics on SMS usage.

**Metrics:**
- Messages sent today/week/month
- Delivery success rate
- Average response time
- Opt-out rate
- Cost tracking (segments × rate)

#### 5.2 Delivery Reports
Detailed reporting for compliance and optimization.

**Reports:**
- Message delivery by status
- Failed message analysis
- Employee engagement (response rates)
- Peak sending times
- Cost breakdown by message type

#### 5.3 Audit Integration
All SMS activities logged to existing audit system.

**Events:**
- `sms.sent` - Message dispatched
- `sms.delivered` - Delivery confirmed
- `sms.failed` - Delivery failed
- `sms.inbound` - Reply received
- `sms.opt_out` - Employee opted out
- `sms.opt_in` - Employee opted in
- `sms.template.created` - Template created/modified

---

### Phase 6: Advanced Features

#### 6.1 Scheduled Messages
Queue messages for future delivery.

**Use Cases:**
- Schedule shift reminders
- Batch notifications during business hours
- Time-zone aware delivery

**Database:**
```sql
CREATE TABLE scheduled_messages (
  id VARCHAR(36) PRIMARY KEY,
  message_id VARCHAR(36) REFERENCES messages(id),
  scheduled_for TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'cancelled'
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 6.2 Smart Delivery Windows
Respect quiet hours for employee notifications.

**Settings:**
- `sms_quiet_hours_start`: Start of quiet period (default: 22:00)
- `sms_quiet_hours_end`: End of quiet period (default: 07:00)
- `sms_respect_timezone`: Use employee's timezone (default: true)

#### 6.3 Escalation Chains
Auto-escalate unfilled urgent shifts.

**Flow:**
1. Initial notification to primary pool
2. Wait X minutes, expand to secondary pool
3. Wait X minutes, alert supervisors
4. Final escalation to admins

**Settings:**
- `sms_escalation_enabled`: Toggle
- `sms_escalation_interval_minutes`: Wait time between rounds
- `sms_escalation_rounds`: Number of rounds before admin alert

#### 6.4 Bulk Messaging
Send announcements to groups of employees.

**Features:**
- Select by area, role, or custom filter
- Preview recipient count
- Staggered sending to avoid rate limits
- Opt-out handling

#### 6.5 Short Links & Tracking
Create trackable links for shift claims.

**Implementation:**
- Generate unique short URLs per recipient
- Track click-through rates
- Deep link to mobile app or web

---

## Organization Settings Summary

### Twilio Configuration
| Key | Type | Description |
|-----|------|-------------|
| `twilio_account_sid` | string | Twilio Account SID |
| `twilio_auth_token` | string | Auth token (encrypted) |
| `twilio_from_number` | string | Sending phone number |
| `twilio_messaging_service_sid` | string | Messaging service for high volume |

### SMS Behavior
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `sms_enabled` | boolean | false | Master SMS toggle |
| `sms_daily_limit` | number | 1000 | Daily message cap |
| `sms_rate_limit_per_minute` | number | 60 | Rate limiting |
| `sms_quiet_hours_start` | string | "22:00" | Quiet hours start |
| `sms_quiet_hours_end` | string | "07:00" | Quiet hours end |
| `sms_respect_timezone` | boolean | true | Employee timezone aware |

### Notifications
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `notify_on_new_shift` | boolean | true | Auto-notify for new shifts |
| `notify_on_shift_claimed` | boolean | true | Confirm shift claims |
| `shift_reminder_enabled` | boolean | true | Send reminders |
| `shift_reminder_hours` | number | 24 | Hours before shift |
| `notify_admin_on_claim` | boolean | false | Alert admin on claims |

### Escalation
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `sms_escalation_enabled` | boolean | false | Auto-escalate unfilled |
| `sms_escalation_interval_minutes` | number | 30 | Minutes between rounds |
| `sms_escalation_rounds` | number | 3 | Escalation attempts |

---

## Implementation Phases & Timeline

### Phase 1: Core Integration (Week 1-2)
- [ ] Install Twilio SDK (`npm install twilio`)
- [ ] Create `server/services/twilio.ts` service module
- [ ] Add Twilio settings to organization settings
- [ ] Implement settings UI in admin panel
- [ ] Create delivery webhook endpoint
- [ ] Update messages table schema
- [ ] Implement basic send functionality
- [ ] Add audit logging for SMS events

### Phase 2: Shift Notifications (Week 3-4)
- [ ] Implement new shift notification flow
- [ ] Add shift claim confirmation messages
- [ ] Create shift reminder scheduler (cron job)
- [ ] Implement cancellation notifications
- [ ] Add notification toggles to shift creation form
- [ ] Test end-to-end shift notification flow

### Phase 3: Two-Way Messaging (Week 5-6)
- [ ] Implement inbound webhook handler
- [ ] Create command parser (CLAIM, STOP, etc.)
- [ ] Add conversation threading
- [ ] Update Messages UI for threaded view
- [ ] Implement opt-in/opt-out via SMS
- [ ] Route free-form replies to inbox

### Phase 4: Message Templates (Week 7)
- [ ] Create sms_templates table
- [ ] Seed default templates
- [ ] Build template management UI
- [ ] Implement variable substitution engine
- [ ] Add template preview functionality

### Phase 5: Analytics & Reporting (Week 8)
- [ ] Create SMS dashboard component
- [ ] Implement delivery metrics queries
- [ ] Build delivery reports page
- [ ] Integrate with existing audit log
- [ ] Add cost tracking calculations

### Phase 6: Advanced Features (Week 9-10)
- [ ] Implement scheduled messages
- [ ] Add quiet hours logic
- [ ] Build escalation chain system
- [ ] Create bulk messaging UI
- [ ] Implement short link generation

---

## Technical Considerations

### Security
- **Credential Storage**: Twilio auth token must be encrypted at rest
- **Webhook Validation**: Validate Twilio webhook signatures
- **PII Protection**: Phone numbers are PII - follow data handling policies
- **Access Control**: SMS features require appropriate permissions

### Compliance
- **TCPA Compliance**: Ensure proper opt-in/opt-out handling
- **Message Content**: Include opt-out instructions in marketing messages
- **Record Keeping**: Maintain logs of consent and messages

### Performance
- **Rate Limiting**: Respect Twilio API limits (varies by account)
- **Queue Processing**: Use job queue for bulk sends (e.g., Bull, Agenda)
- **Webhook Handling**: Process callbacks asynchronously
- **Database Indexing**: Index `twilioSid`, `delivery_status`, `thread_id`

### Cost Management
- **Segment Tracking**: SMS messages over 160 chars split into segments
- **Daily Limits**: Configurable caps to prevent runaway costs
- **Cost Alerts**: Notify admins when approaching limits
- **Usage Reports**: Detailed cost breakdowns for budgeting

---

## API Endpoints

### New Endpoints Required

```
POST   /api/sms/send              - Send individual SMS
POST   /api/sms/bulk              - Send bulk SMS
GET    /api/sms/templates         - List templates
POST   /api/sms/templates         - Create template
PUT    /api/sms/templates/:id     - Update template
DELETE /api/sms/templates/:id     - Delete template
GET    /api/sms/analytics         - Get SMS metrics
GET    /api/sms/delivery-report   - Delivery report data
POST   /api/webhooks/twilio/status   - Delivery status callback
POST   /api/webhooks/twilio/inbound  - Inbound message handler
```

### Modified Endpoints

```
POST   /api/shifts     - Add SMS notification trigger
PUT    /api/shifts/:id - Add cancellation notification
POST   /api/messages   - Integrate with Twilio send
```

---

## UI Components Required

1. **Twilio Settings Panel** - Credential configuration
2. **SMS Dashboard Widget** - Quick metrics on dashboard
3. **SMS Analytics Page** - Detailed reporting
4. **Template Manager** - CRUD for templates
5. **Conversation View** - Threaded message display
6. **Bulk SMS Composer** - Multi-recipient messaging
7. **Scheduled Message Queue** - View/manage scheduled sends

---

## Testing Strategy

### Unit Tests
- Twilio service module
- Template variable substitution
- Phone number validation
- Rate limiting logic

### Integration Tests
- End-to-end shift notification flow
- Webhook processing
- Opt-in/opt-out handling
- Delivery status updates

### Mock Testing
- Use Twilio test credentials for development
- Mock webhook responses for testing
- Simulate various delivery statuses

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Cost overruns | Daily limits, usage alerts, approval for bulk sends |
| Delivery failures | Retry logic, fallback channels, monitoring |
| Compliance violations | Proper opt-in UX, required disclosures, audit trail |
| Rate limiting | Queue management, staggered sending |
| Data breaches | Encrypted credentials, minimal PII exposure |

---

## Success Metrics

1. **Shift Fill Rate** - % of shifts claimed via SMS
2. **Response Time** - Time from notification to claim
3. **Delivery Rate** - % successfully delivered
4. **Engagement Rate** - % of recipients who interact
5. **Opt-Out Rate** - Monitor for messaging fatigue
6. **Cost Per Shift Filled** - ROI measurement

---

## Appendix: Twilio Resources

- [Twilio Node.js SDK](https://www.twilio.com/docs/libraries/node)
- [Programmable Messaging API](https://www.twilio.com/docs/messaging)
- [Webhook Security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- [Message Status Callbacks](https://www.twilio.com/docs/messaging/guides/track-outbound-message-status)
- [Messaging Services](https://www.twilio.com/docs/messaging/services)
- [TCPA Compliance Guide](https://www.twilio.com/docs/messaging/compliance)
