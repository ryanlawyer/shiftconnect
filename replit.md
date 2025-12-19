# ShiftConnect - Shift Management & Communication Platform

## Overview

ShiftConnect is a company-wide shift management and communication platform designed for healthcare or similar organizations. The application enables supervisors and administrators to post open shifts, manage employees across different areas/departments, send SMS notifications, and coordinate training sessions. Employees can view available shifts, express interest, and communicate with supervisors.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for client-side routing (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens defined in CSS variables
- **Design System**: Linear-inspired productivity design with emphasis on clarity and efficiency for data-dense components

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful API endpoints under `/api/*` prefix
- **Build Process**: esbuild for server bundling, Vite for client bundling

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` - contains all database table definitions
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod
- **Migrations**: Drizzle Kit for database migrations (output to `./migrations`)

### Project Structure
```
├── client/           # React frontend application
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── pages/        # Route page components
│       ├── hooks/        # Custom React hooks
│       └── lib/          # Utilities and query client
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data access layer interface
│   └── vite.ts       # Vite dev server integration
├── shared/           # Shared code between client and server
│   └── schema.ts     # Database schema and types
└── migrations/       # Database migration files
```

### Key Design Patterns
- **Shared Types**: Database schemas in `shared/schema.ts` are used by both frontend and backend, ensuring type safety across the stack
- **Storage Interface**: `IStorage` interface in `server/storage.ts` abstracts data access, allowing for different implementations
- **Path Aliases**: `@/` maps to client source, `@shared/` maps to shared directory

## External Dependencies

### Database
- **PostgreSQL**: Primary database (configured via `DATABASE_URL` environment variable)
- **connect-pg-simple**: Session storage in PostgreSQL

### Third-Party Services
- **SMS Integration**: RingCentral (primary) and Twilio (secondary) SMS providers configured
  - SMS templates managed via Settings > SMS tab
  - Provider selection and configuration in Settings > SMS tab

#### RingCentral SMS Configuration
- **Authentication**: JWT-based authentication
- **Required Settings**:
  - Client ID and Client Secret from RingCentral Developer Portal
  - JWT token for the extension that will send SMS
  - From Phone Number (must be assigned to the authenticated extension)
- **Credential Import**: Supports JSON import with format:
  ```json
  {
    "clientId": "xxx",
    "clientSecret": "xxx",
    "server": "https://platform.ringcentral.com",
    "jwt": { "ITS": "jwt_token_here" },
    "fromNumber": "+1XXXXXXXXXX"
  }
  ```
- **JWT Aliases**: Multiple JWT tokens can be stored with aliases (e.g., "ITS", "Nursing")
  - Select active JWT from dropdown to switch between extensions
  - Each JWT authenticates a different RingCentral user/extension

**CRITICAL: From Phone Number Configuration**
- The FROM number MUST be an SMS-capable number assigned to the authenticated extension
- Use the "Refresh" button next to the phone number dropdown to discover available numbers
- The dropdown will only show numbers with SMS capability ("SmsSender" feature)
- If the FROM number doesn't belong to the extension, SMS sending will fail with "Phone number doesn't belong to extension" error
- Phone numbers are automatically formatted to E.164 format (+1XXXXXXXXXX)

**RingCentral App Permissions** (in Developer Portal):
- `SMS` - Required for sending/receiving SMS
- `ReadAccounts` - Optional, enables automatic phone number discovery
- Without ReadAccounts, manually enter the FROM number in E.164 format

**Settings Keys** (stored in organization_settings table):
- `ringcentral_client_id`, `ringcentral_client_secret`
- `ringcentral_jwt` - Active JWT token
- `ringcentral_jwt_aliases` - JSON array of {alias, jwt} pairs
- `ringcentral_active_jwt_alias` - Currently selected JWT alias
- `ringcentral_from_number` - E.164 formatted phone number
- `ringcentral_server_url` - API endpoint (production or sandbox)

#### Inbound SMS (Webhook Subscription)
To receive SMS replies from employees, a webhook subscription must be created:

**Setup via Settings > SMS tab:**
1. Configure and save RingCentral credentials
2. Select a valid FROM phone number
3. In the "Inbound SMS (Receive Messages)" section, click "Enable Inbound SMS"
4. The system will create a webhook subscription pointing to this app's public URL

**How It Works:**
- When enabled, employees can reply to SMS messages with commands
- Webhook subscription expires after 7 days and needs renewal
- Use "Renew Subscription" button to extend before expiration

**Supported SMS Commands** (employees reply to messages):
- `YES` or `YES <code>` - Express interest in a shift
- `NO` - Decline a shift offer
- `SHIFTS` - View available open shifts
- `STATUS` - Check assigned shifts and pending interests
- `CONFIRM` - Confirm an assigned shift
- `WITHDRAW` - List shifts you've expressed interest in
- `WITHDRAW <code>` - Withdraw interest in a specific shift
- `HELP` - Show available commands
- `STOP` - Opt out of SMS notifications
- `START` - Opt back in to SMS notifications

**Webhook Settings Keys:**
- `ringcentral_webhook_subscription_id` - Active subscription ID
- `ringcentral_webhook_url` - Webhook endpoint URL
- `ringcentral_webhook_expires_at` - Subscription expiration timestamp

**API Endpoints:**
- `GET /api/sms/ringcentral/webhook` - Check subscription status
- `POST /api/sms/ringcentral/webhook` - Create new subscription
- `DELETE /api/sms/ringcentral/webhook` - Delete subscription
- `POST /api/sms/ringcentral/webhook/renew` - Renew subscription

- **Authentication**: Passport.js with passport-local strategy
  - Default admin: username "pmorrison", password "admin123"

### Organization Configuration
- **Positions**: Managed via Settings > Organization tab (RN, LPN, CNA, Medical Tech, etc.)
- **Shift Locations**: Managed via Settings > Organization tab (configurable list)
- **Areas**: Managed via Settings > Organization tab (service areas/departments)

### User/Employee Management
- **Combined Management**: User accounts are managed alongside employee profiles
- **Web Access Toggle**: Enable/disable web login for each employee
- **Username Generation**: Auto-generates username from name (first initial + lastname)
- **Password Management**: Set password when enabling web access, or leave blank to keep existing
- **Linked Accounts**: User table automatically synced when employee web access changes

### Phone Number Handling
- **Storage Format**: E.164 (+1XXXXXXXXXX) for SMS compatibility
- **Display Format**: (555) 123-4567 for user-friendly display
- **PhoneInput Component**: `client/src/components/ui/phone-input.tsx`
  - Accepts 10-digit input with auto-formatting
  - Handles pasted E.164 or formatted numbers correctly
  - Emits E.164 format for storage, empty string if incomplete
- **Utilities**: `client/src/lib/phoneUtils.ts`
  - `formatPhoneDisplay()` - converts to (555) 123-4567
  - `toE164()` - converts to +1XXXXXXXXXX
  - `isValidPhoneNumber()` - validates 10-digit phone
  - `extractDigits()` - strips formatting and country code

### Key NPM Packages
- **UI**: Radix UI primitives, Lucide icons, class-variance-authority, embla-carousel
- **Forms**: react-hook-form with @hookform/resolvers for Zod validation
- **Dates**: date-fns for date manipulation
- **API**: Express with express-session, express-rate-limit

### Security Patterns

#### Permission-Gated Fields
For fields requiring specific permissions (e.g., `notifyAllAreas` requiring `shifts:all_areas`):

**Server-side enforcement pattern:**
```typescript
// Always validate on server - never trust client
const isValidBooleanTrue = requestData.fieldName === true;
if (isValidBooleanTrue && !userPermissions.includes("required:permission")) {
  // Strip unauthorized field
  requestData.fieldName = false;
}
// Reject non-boolean values to prevent truthy string/number coercion
if (typeof requestData.fieldName !== "boolean") {
  requestData.fieldName = false;
}
```

**Key principles:**
1. Use strict equality (`=== true`) not truthy checks (`Boolean()`)
2. Validate typeof to reject strings like "true" or numbers like 1
3. Frontend permission checks are for UX only; server enforces
4. Log unauthorized attempts for monitoring

---

## AI SMS Agent Implementation Notes (Future Feature)

### Overview
Replace fixed SMS command parsing with an AI agent that understands natural language while maintaining strict security guardrails. The AI will be embedded via LLM API calls (not external n8n). Fixed commands (YES, NO, SHIFTS, etc.) will remain as fallback.

### Architecture Decision Record

**ADR-001: AI SMS Agent with RBAC-Aware Guardrails**
- **Status**: Planned
- **Date**: December 2024
- **Decision**: Build an embedded AI agent for SMS handling with context-aware data filtering

### Core Components to Build

#### 1. AI RBAC Schema Extension (`shared/permissions.ts`)
New permissions to add under a dedicated "AI Access" section:
```typescript
// AI-specific permissions
AI_VIEW_OTHER_SCHEDULES: "ai:view_other_schedules",   // Can query other employees' schedules
AI_VIEW_SHIFT_HISTORY: "ai:view_shift_history",       // Can access historical shift data
AI_VIEW_CONTACT_INFO: "ai:view_contact_info",         // Can see employee contact details
AI_ALL_AREAS: "ai:all_areas",                         // Can query across all areas (bypass area filter)
AI_SUBMIT_PTO: "ai:submit_pto",                       // Can submit PTO requests (future)
```

Default permission assignments:
- **Admin**: All AI permissions
- **Supervisor**: `ai:view_other_schedules`, `ai:view_shift_history` (area-restricted unless `ai:all_areas` granted)
- **Employee**: None (can only query own data and available shifts)

#### 2. AI Context Builder Service (`server/services/ai/contextBuilder.ts`)
Assembles user context for each AI request:
```typescript
interface AIUserContext {
  employeeId: string;
  employeeName: string;
  role: string;
  permissions: string[];           // All permissions including AI-specific
  assignedAreaIds: string[];       // Areas this user can access
  qualifiedPositionIds: string[];  // Positions user is qualified for
  canAccessAllAreas: boolean;      // Derived from ai:all_areas permission
}
```

#### 3. Data Filtering Layer (`server/services/ai/dataFilter.ts`)
Permission-aware query filters:
- `getAccessibleShifts(context)` - Returns only shifts in user's areas + qualified positions
- `getAccessibleEmployees(context)` - Returns employees based on permission level
- `getAccessibleSchedules(context)` - Filters schedule data by permissions

Security rules:
- Employees: Own data only + available shifts they qualify for
- Supervisors: All data within assigned areas (or all areas if toggled)
- Admins: All data

#### 4. AI SMS Handler (`server/services/ai/smsHandler.ts`)
Main processing flow:
```
1. Receive SMS -> Identify employee by phone
2. Build AIUserContext from employee record
3. Attempt AI intent classification
   - If clear intent -> Process with guardrails
   - If unclear/ambiguous -> Fall back to fixed command parser
4. Filter data access based on permissions
5. Generate response (or block + log if unauthorized)
6. Send SMS response
```

System prompt structure:
```
You are ShiftConnect Assistant. You help employees manage shifts.

USER CONTEXT:
- Name: {employeeName}
- Role: {role}
- Areas: {areaNames}

STRICT RULES:
1. Only discuss ShiftConnect topics (shifts, schedules, availability)
2. User can ONLY see shifts in these areas: {allowedAreas}
3. User can ONLY see their own schedule unless they have supervisor access
4. NEVER reveal information about other employees unless explicitly permitted
5. If asked about restricted data, politely redirect to available options

AVAILABLE ACTIONS:
- Express interest in shifts (YES)
- Decline shifts (NO)
- Check shift status
- View available shifts
- Submit PTO request (cannot approve)
```

#### 5. Security Event Logging
New audit event types:
- `ai_access_blocked` - Attempted unauthorized data access
- `ai_topic_redirect` - Off-topic conversation redirected
- `ai_intent_fallback` - Fell back to fixed commands

Log structure:
```typescript
{
  action: "ai_access_blocked",
  actor: employeeId,
  targetType: "employee" | "shift" | "schedule",
  details: {
    attemptedQuery: string,
    deniedPermission: string,
    redirectMessage: string
  }
}
```

#### 6. Conversation Context Manager (`server/services/ai/conversationContext.ts`)
Track multi-turn conversations:
```typescript
interface ConversationContext {
  employeeId: string;
  threadId: string;
  lastMessageAt: Date;
  recentMessages: Array<{role: 'user'|'assistant', content: string}>;
  pendingAction?: {type: string, data: any};  // e.g., confirming a shift
}
```
- TTL: 30 minutes of inactivity
- Max history: Last 5 exchanges

#### 7. UI: AI Access Section in Role Editor
Location: Settings > Access Roles > Edit Role
New section "AI Chat Permissions" with toggles:
- [ ] Can view other employees' schedules
- [ ] Can access shift history
- [ ] Can see employee contact info
- [ ] Can access all areas (bypasses area restrictions)
- [ ] Can submit PTO requests

### Integration Points

**Existing code to modify:**
- `server/routes/sms.ts` - Route inbound SMS through AI handler first
- `shared/permissions.ts` - Add AI permission constants
- `client/src/pages/settings-roles.tsx` - Add AI permissions UI section
- `server/storage.ts` - Add methods for AI-filtered queries

**New files to create:**
- `server/services/ai/index.ts` - AI service entry point
- `server/services/ai/contextBuilder.ts`
- `server/services/ai/dataFilter.ts`
- `server/services/ai/smsHandler.ts`
- `server/services/ai/conversationContext.ts`
- `server/services/ai/prompts.ts` - System prompt templates

### LLM Integration
- **Provider**: OpenAI API (GPT-4 or GPT-3.5-turbo)
- **Secret**: `OPENAI_API_KEY` environment variable
- **Fallback**: If LLM fails, use existing fixed command parser

### Testing Scenarios
1. Employee asks "what shifts are available?" -> Shows only their area/qualification matches
2. Employee asks "who's working Friday?" -> Polite redirect + security log
3. Supervisor asks "who's working Friday?" -> Shows their area's schedule
4. Admin asks about any employee -> Full access
5. Anyone asks about weather -> Polite redirect to shift topics
6. Garbled message -> Falls back to HELP response

### Implementation Task List
1. Design AI RBAC schema extension - Add AI-specific permissions to shared/permissions.ts
2. Create AI context builder service - Build user context assembly for AI requests
3. Implement data filtering layer - Create permission-aware query filters
4. Build AI SMS handler service - Create LLM integration with guardrails
5. Implement security event logging - Log blocked access attempts to audit log
6. Add fallback to fixed commands - Integrate AI handler with existing command parser
7. Create AI Access section in Role Editor UI - Add toggle controls for AI permissions
8. Build conversation context manager - Track multi-turn conversation state
9. Integration testing & guardrail validation - Test access controls and security logging