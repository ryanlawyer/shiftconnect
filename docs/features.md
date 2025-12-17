# ShiftConnect - Feature Documentation

## Overview

ShiftConnect is a comprehensive shift management and communication platform designed for healthcare organizations and community-based care facilities. The platform enables supervisors and administrators to efficiently post open shifts, manage employees across different areas and departments, send SMS notifications, and coordinate scheduling. Employees can view available shifts, express interest, and communicate with supervisors through both the web interface and SMS.

---

## Table of Contents

1. [User Roles & Permissions](#user-roles--permissions)
2. [Dashboard](#dashboard)
3. [Shift Management](#shift-management)
4. [Employee Management](#employee-management)
5. [SMS Communication](#sms-communication)
6. [Messaging](#messaging)
7. [Reports & Analytics](#reports--analytics)
8. [Training Management](#training-management)
9. [Audit Log](#audit-log)
10. [Settings & Configuration](#settings--configuration)

---

## User Roles & Permissions

### Role Types

| Role | Description | Typical Access |
|------|-------------|----------------|
| **Administrator** | Full system access | All features, settings, user management |
| **Supervisor** | Department/area manager | Shift management, employee oversight, messaging |
| **Employee** | Staff member | View shifts, express interest, receive notifications |

### Permission Categories

- **shifts:view** - View available shifts
- **shifts:manage** - Create, edit, delete, and assign shifts
- **shifts:all_areas** - Access shifts across all areas (not just assigned areas)
- **employees:view** - View employee directory
- **employees:manage** - Create, edit, delete employee records
- **settings:manage** - Access organization settings
- **reports:view** - Access reporting and analytics
- **audit:view** - View audit log entries

### Area-Based Access Control

- Employees are assigned to one or more service areas
- Shift visibility is filtered by assigned areas
- Administrators with `shifts:all_areas` permission can access all areas
- Notification targeting respects area assignments

### Permission-Aware Navigation

The application dynamically shows/hides navigation items and features based on user permissions:

**Protected Routes:**
- Pages are protected by required permissions
- Unauthorized users are redirected to appropriate pages
- Navigation sidebar only shows accessible modules

**Feature-Level Controls:**
- Buttons and actions are hidden if user lacks permission
- Forms omit fields that require elevated permissions
- Bulk actions require `shifts:manage` permission

**Employee vs. Admin Experience:**
- Employees see simplified "Employee Home" with available shifts
- Administrators see full Dashboard with metrics and management tools
- Supervisors see features relevant to their area assignments

---

## Dashboard

The Dashboard provides a quick overview of operational metrics and urgent items requiring attention.

### Key Metrics Cards

| Metric | Description |
|--------|-------------|
| **Open Shifts** | Count of currently available shifts |
| **Active Employees** | Number of active staff members |
| **SMS Sent** | Total SMS notifications sent |
| **Shifts Filled** | Number of assigned/claimed shifts |

### Urgent Unfilled Shifts

- Displays shifts starting within the configurable urgency threshold (default: 48 hours)
- Sorted by proximity to shift date
- Each shift card shows:
  - Position and area
  - Date and time
  - Location
  - Bonus amount (if applicable)
  - Number of interested employees

### Quick Actions (on shift cards)

| Action | Icon | Description |
|--------|------|-------------|
| **Notify** | Bell | Send SMS to eligible employees |
| **Clone** | Copy | Create new shift with same details |
| **Quick Assign** | User+ | Quickly assign from interested employees |
| **View Details** | Click card | Open full shift detail modal |

---

## Shift Management

### Shifts List View

**Filtering Options:**
- **Search** - Filter by position name or area name (case-insensitive)
- **Area** - Filter by specific service area
- **Status** - Filter by shift status (Available, Claimed, Expired)
- **Date** - Filter by specific date (in calendar view)

**View Modes:**
- **List View** - Traditional card grid layout
- **Calendar View** - Week-based grid showing shift counts per day

### Quick Actions on Shift Cards

Each shift card on the Shifts page includes quick action buttons for common operations:

| Action | Icon | Description |
|--------|------|-------------|
| **Notify** | Bell | Send SMS notifications to eligible employees for this shift |
| **Clone** | Copy | Create a new shift pre-filled with the same details (opens New Shift form) |
| **Quick Assign** | User+ | Opens dropdown to quickly assign from interested employees |
| **Select** | Checkbox | Add shift to selection for bulk actions |

*Note: Quick Assign button only appears when there are employees who have expressed interest*

### Calendar Week Grid

- Navigate between weeks using arrow buttons
- Click on a day to filter shifts for that date
- Visual indicators show shift density per day
- "Today" indicator for current date

### Creating Shifts

**Required Fields:**
- Position (from configured positions list)
- Area (service area/department)
- Location (from configured locations)
- Date
- Start Time
- End Time

**Optional Fields:**
- Requirements/Notes
- Bonus Amount
- Notify All Areas (requires `shifts:all_areas` permission)

**Options:**
- **Send Notification** - SMS eligible employees upon creation
- **Create from Template** - Pre-fill form using saved template
- **Save as Template** - Save current shift as reusable template

### Shift Templates

Templates allow quick shift creation with pre-configured settings:

- Create templates from any shift
- Manage templates in Settings > Organization > Shift Templates
- Templates store: position, area, location, start/end times, requirements, bonus
- Select template from dropdown in shift creation form

### Shift Detail Modal

When clicking a shift, view comprehensive details:

**Information Displayed:**
- Full shift details (position, area, location, times)
- Posted by information
- Status and notification history
- Interested employees list with timestamps
- Assigned employee (if applicable)

**Available Actions:**
- **Assign** - Select from interested employees
- **Edit** - Modify shift details
- **Repost** - Re-send notifications
- **Delete/Cancel** - Remove shift
- **Unassign** - Remove assigned employee
- **Message Employee** - Direct SMS communication

### Bulk Actions

Select multiple shifts using checkboxes for batch operations:

| Action | Description |
|--------|-------------|
| **Bulk Cancel** | Cancel all selected shifts |
| **Bulk Repost** | Re-send notifications for selected shifts |
| **Bulk Notify** | Send notifications for selected shifts |

*Note: Bulk actions require `shifts:manage` permission*

### Shift Statuses

| Status | Description |
|--------|-------------|
| **open** | Available for interest/assignment |
| **claimed** | Assigned to an employee |
| **expired** | Past date, no longer available |
| **cancelled** | Manually cancelled |

---

## Employee Management

### Employee Directory

**Display Information:**
- Name and contact details
- Position/job title
- Assigned areas (with badges)
- Role (Admin, Supervisor, Employee)
- Status (Active/Inactive)
- SMS opt-in status

**Filtering:**
- Search by name
- Filter by role
- Filter by assigned area

### Employee Profile Management

**Profile Fields:**
- Full Name
- Phone Number (auto-formatted to E.164 for SMS)
- Email Address
- Position
- Role
- Status (Active/Inactive)
- SMS Opt-In preference
- Area Assignments (multi-select)

### Web Access Control

Each employee can be granted web access to the platform:

- **Enable/Disable Web Access** - Toggle login capability
- **Username** - Auto-generated from name (first initial + lastname)
- **Password** - Set when enabling, leave blank to keep existing
- **Linked User Account** - Automatically synced with employee record

### Bulk SMS

Select multiple employees to send group SMS messages:

1. Enter selection mode
2. Check employees to include
3. Click "Send SMS to Selected"
4. Compose and send message

### Direct SMS

Send individual SMS messages to any employee directly from their row in the directory.

---

## SMS Communication

### Supported Providers

| Provider | Status | Configuration |
|----------|--------|---------------|
| **RingCentral** | Primary | Settings > SMS > RingCentral tab |
| **Twilio** | Secondary | Settings > SMS > Twilio tab |

### RingCentral Configuration

**Required Settings:**
- Client ID and Client Secret
- JWT Token (for authentication)
- From Phone Number (SMS-capable, assigned to extension)
- Server URL (production or sandbox)

**Features:**
- JWT Aliases - Store multiple JWT tokens for different extensions
- Phone Number Discovery - Auto-detect available SMS numbers
- Credential Import - Paste JSON configuration

### Twilio Configuration

**Required Settings:**
- Account SID
- Auth Token
- From Phone Number

### SMS Templates

Customize notification messages for different events:

| Template | Use Case |
|----------|----------|
| **New Shift** | When a new shift is posted |
| **Shift Assigned** | Confirmation to assigned employee |
| **Shift Reminder** | Automated reminder before shift |
| **Shift Cancelled** | When a shift is cancelled |

Templates support variables like `{shift_date}`, `{shift_time}`, `{position}`, `{area}`.

### Automated Shift Reminders

The system includes an automatic shift reminder scheduler that sends SMS reminders to assigned employees:

**How It Works:**
- Runs every 15 minutes in the background
- Checks for upcoming shifts that need reminders
- Sends reminder SMS to assigned employees before their shift
- Reminder timing is configurable in Settings

**Reminder Triggers:**
- Shifts assigned to employees with valid phone numbers
- Active employees who have opted in to SMS
- Shifts occurring within the reminder window

### Notification Tracking

Track the history and status of all SMS notifications:

- **Last Notified At** - Timestamp of most recent notification for each shift
- **Notification Count** - How many times a shift has been notified
- **Repost Counter** - Track re-notification attempts
- View notification history in shift detail modal

### Inbound SMS (Webhook)

Enable employees to interact via SMS replies:

**Setup:**
1. Configure RingCentral credentials
2. Enable Inbound SMS webhook
3. Webhook auto-renews (expires after 7 days)

**Employee SMS Commands:**

| Command | Description |
|---------|-------------|
| `YES` or `YES <code>` | Express interest in a shift |
| `NO` | Decline a shift offer |
| `SHIFTS` | View available open shifts |
| `STATUS` | Check assigned shifts and pending interests |
| `CONFIRM` | Confirm an assigned shift |
| `WITHDRAW` | List shifts with expressed interest |
| `WITHDRAW <code>` | Withdraw interest from specific shift |
| `HELP` | Show available commands |
| `STOP` | Opt out of SMS notifications |
| `START` | Opt back in to SMS notifications |

### Notification Tracking

- View last notification date/time per shift
- Track notification count
- SMS analytics in Settings > SMS > Analytics

---

## Messaging

### Conversation View

The Messages page provides a centralized communication hub for all SMS conversations:

**Conversation List:**
- View all employee conversations in a scrollable list
- Search conversations by employee name or phone number
- See preview of last message in each conversation
- Unread message indicators
- Sorted by most recent activity

**Selecting a Conversation:**
- Click any conversation to view full message history
- Employee name and phone number displayed in header
- Quick access to employee profile

### Message Thread

**Thread Display:**
- Full chronological message history
- Inbound messages (from employee) on left side
- Outbound messages (from system) on right side
- Timestamp for each message
- Delivery status indicators (sent, delivered, failed)

**Composing Messages:**
- Text input field at bottom of thread
- Send button to dispatch message
- Messages sent via configured SMS provider
- Character count display

### Direct SMS from Other Pages

Send SMS directly from various locations:
- **Employee Directory** - Click SMS icon on employee row
- **Shift Detail Modal** - "Message Employee" button
- **Bulk SMS** - Select multiple employees and compose group message

---

## Reports & Analytics

### Available Reports

**Weekly Fill Rate Chart:**
- Visual chart showing fill rate trends
- Configurable date range (4, 8, or 12 weeks)
- Filter by area
- Shows: total shifts, filled, expired, available

**Employee Performance:**
- Shifts assigned per employee
- Interest expression frequency
- Fill rate by employee

### Data Export

Export shift and employee data for external analysis:
- CSV format
- Filtered by date range and area
- Includes all relevant fields

---

## Training Management

*Note: Currently displays sample/mock data*

### Training Sessions View

- List of upcoming training sessions
- Search by title or description
- Schedule new training sessions

### Training Card Information

- Title and description
- Date and time
- Duration
- Attendee count vs. capacity
- Required/Optional indicator

---

## Audit Log

Track all critical system actions for compliance and troubleshooting.

### Logged Actions

| Category | Events Tracked |
|----------|----------------|
| **Shifts** | Create, update, delete, assign, unassign, repost |
| **Employees** | Create, update, delete, role changes |
| **Users** | Create, password reset, login attempts |
| **Settings** | Configuration changes |
| **SMS** | Notification sends, webhook events |

### Audit Entry Details

Each log entry includes:
- Action type (with visual badge)
- Actor (who performed the action)
- Target (what was affected)
- Timestamp
- IP Address
- Detailed changes (expandable JSON)

### Filtering

- Filter by action type
- Filter by target type (shift, employee, user, etc.)
- Pagination for large result sets

---

## Settings & Configuration

### Profile Settings

- Update personal account information
- Change password

### Notification Preferences

- Email notification settings
- SMS notification preferences
- Quiet hours configuration

### Organization Settings

**Areas Management:**
- Add/edit/delete service areas
- Enable/disable SMS for specific areas
- Set area descriptions

**Positions:**
- Configure job positions (RN, LPN, CNA, etc.)
- Set position titles and descriptions

**Roles:**
- Define access roles
- Assign permission sets to roles

**Shift Locations:**
- Manage location options for shifts
- Add/remove available locations

**Shift Templates:**
- View and manage saved templates
- Edit template details
- Delete unused templates

**Dashboard Settings:**
- Configure urgent shift threshold (hours)
- Customize dashboard display

### SMS Settings

**Provider Tabs:**
- RingCentral configuration
- Twilio configuration
- Active provider selection

**Templates:**
- Customize all SMS message templates
- Preview template output

**Analytics:**
- View SMS send statistics
- Success/failure rates
- Cost tracking (if applicable)

**Webhook Management:**
- Enable/disable inbound SMS
- View subscription status
- Renew expiring subscriptions

### Security Settings

- Password policies
- Session management
- Two-factor authentication (if enabled)

### Documentation

- Download user guides
- Access help resources
- View system documentation

---

## Technical Specifications

### Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

### Mobile Responsiveness

- Fully responsive design
- Touch-optimized controls
- Mobile-friendly navigation

### Data Formats

- **Phone Numbers:** Stored in E.164 format (+1XXXXXXXXXX)
- **Dates:** ISO 8601 format (YYYY-MM-DD)
- **Times:** 24-hour format (HH:MM)

### Session Management

- Secure session-based authentication
- Automatic logout after inactivity
- Session stored in PostgreSQL

---

## Quick Reference

### Keyboard Shortcuts

*Currently no dedicated keyboard shortcuts implemented*

### Common Workflows

**Post a New Shift:**
1. Navigate to Shifts > New Shift
2. Fill in required fields
3. Optionally check "Send Notification"
4. Click "Post Shift"

**Assign an Employee:**
1. Click on shift card to open details
2. View interested employees
3. Click "Assign" on desired employee
4. Optionally send confirmation SMS

**Send Bulk Notification:**
1. Go to Shifts page
2. Check multiple shifts
3. Click "Notify" in bulk action toolbar
4. Confirm action

**Create Shift from Template:**
1. Navigate to New Shift
2. Click "Create from Template" dropdown
3. Select template
4. Adjust date and any other fields
5. Post shift

---

*Document Version: 1.0*  
*Last Updated: December 2024*
