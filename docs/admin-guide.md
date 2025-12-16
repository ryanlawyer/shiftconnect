# ShiftConnect Administrator Guide

## Overview

This guide covers administrative functions in ShiftConnect including employee management, shift posting, SMS configuration, and reporting.

---

## Logging In

1. Open ShiftConnect in your web browser
2. Enter your admin credentials
3. Click "Login"

Default admin account: `pmorrison` / `admin123` (change this immediately after first login)

---

## Dashboard

The admin dashboard shows:
- **Quick Stats** - Total employees, open shifts, pending interests
- **Urgent Unfilled Shifts** - Shifts starting soon that need coverage
- **Post New Shift** button for quick access

---

## Managing Employees

### Viewing Employees

1. Click "Employees" in the sidebar
2. Use search and filters to find specific employees
3. Click on an employee to view details

### Adding an Employee

1. Go to Employees page
2. Click "Add Employee"
3. Fill in required fields:
   - Name
   - Phone number (for SMS notifications)
   - Email
   - Position
   - Area assignments
4. Click "Save"

### Enabling Web Access

To allow an employee to log in:

1. Edit the employee record
2. Toggle "Web Access Enabled"
3. Set a username (auto-generated from name)
4. Set a password
5. Save changes

### Employee Status

- **Active** - Can receive shifts and notifications
- **Inactive** - Cannot receive shifts or notifications

---

## Posting Shifts

### Creating a New Shift

1. Click "Post New Shift" from Dashboard or Shifts page
2. Fill in shift details:
   - **Date** - When the shift occurs
   - **Start/End Time** - Shift hours
   - **Position** - Required role (RN, CNA, DSP, etc.)
   - **Area** - Department or service area
   - **Location** - Where to report
   - **Requirements** - Special notes or qualifications
   - **Bonus Amount** - Optional extra pay incentive
3. Choose notification options:
   - Send SMS to eligible employees
4. Click "Post Shift"

### Managing Shifts

From the Shifts page, you can:
- **View Details** - See interested employees and shift info
- **Assign** - Assign an interested employee to the shift
- **Edit** - Modify shift details
- **Repost** - Re-notify employees (optionally with bonus)
- **Remove** - Delete the shift

### Reposting a Shift

To re-notify employees about an unfilled shift:

1. Open the shift details
2. Click "Repost"
3. Optionally add or update a bonus amount
4. Confirm to send notifications

### Assigning Shifts

1. Open shift details
2. View employees who expressed interest
3. Click "Assign" next to the chosen employee
4. Optional: Send confirmation notification

---

## SMS Configuration

### Accessing SMS Settings

1. Go to Settings
2. Click the "SMS" tab

### Provider Setup (RingCentral)

1. Enter your RingCentral credentials:
   - Client ID
   - Client Secret
   - JWT Token
   - From Phone Number
2. Click "Save Settings"
3. Use "Test SMS" to verify configuration

### Enabling Inbound SMS

For employees to reply to messages:

1. In SMS settings, find "Inbound SMS" section
2. Click "Enable Inbound SMS"
3. This creates a webhook subscription

**Important:** If you see duplicate messages, click "Cleanup Duplicate Subscriptions" first, then re-enable.

### SMS Templates

Customize notification messages:

1. Go to Settings > SMS
2. Find the template you want to edit
3. Click to modify
4. Use variables like `{{date}}`, `{{location}}`, `{{bonus}}`
5. Save changes

Available templates:
- New Shift Available
- Shift Reposted
- Shift Confirmation
- Shift Reminder
- Shift Cancelled

### Template Variables

| Variable | Description |
|----------|-------------|
| `{{date}}` | Shift date |
| `{{startTime}}` | Shift start time |
| `{{endTime}}` | Shift end time |
| `{{location}}` | Shift location |
| `{{area}}` | Department/area name |
| `{{position}}` | Position title |
| `{{shiftType}}` | Same as position |
| `{{bonus}}` | Bonus amount (e.g., "$50 bonus") |
| `{{smsCode}}` | 6-character shift code |
| `{{employeeName}}` | Employee's name |

---

## Organization Settings

### Managing Positions

1. Go to Settings > Organization
2. Add, edit, or remove positions
3. Positions determine which employees are notified for shifts

### Managing Areas

1. Go to Settings > Organization
2. Add, edit, or remove areas/departments
3. Assign employees to areas
4. Areas determine notification targeting

### Managing Locations

1. Go to Settings > Organization
2. Add or edit shift locations
3. These appear in the location dropdown when posting shifts

---

## Reports

### Accessing Reports

1. Click "Reports" in the sidebar
2. Select date range
3. View metrics and charts

### Available Reports

- **Shift Coverage** - Fill rates by area and position
- **Employee Activity** - Hours worked, shifts taken
- **SMS Analytics** - Messages sent, delivery rates

---

## Audit Logs

Track all system activity:

1. Go to Settings > Audit Logs
2. Filter by date, action type, or user
3. View detailed activity records

Logged actions include:
- Employee changes
- Shift postings and assignments
- SMS notifications sent
- Settings changes

---

## Best Practices

### Shift Management

- Post shifts as early as possible for better coverage
- Use bonuses strategically for hard-to-fill shifts
- Repost unfilled shifts with increased bonuses if needed
- Assign shifts promptly when interest is received

### SMS Notifications

- Keep templates concise (SMS has character limits)
- Include shift codes for easy replies
- Respect quiet hours settings
- Monitor delivery rates in reports

### Employee Management

- Keep phone numbers updated
- Verify employees have correct position assignments
- Regularly review area assignments
- Disable accounts for departed employees

---

## Troubleshooting

### SMS Not Sending

1. Verify provider credentials in Settings > SMS
2. Check if SMS is enabled
3. Confirm employee has valid phone and opted in
4. Review quiet hours settings
5. Check audit logs for errors

### Duplicate SMS Messages

1. Go to Settings > SMS
2. Click "Cleanup Duplicate Subscriptions"
3. Re-enable inbound SMS

### Employee Not Receiving Shift Notifications

Verify the employee:
1. Has "Active" status
2. Has SMS Opt-In enabled
3. Is assigned to the shift's area
4. Has matching position for the shift

---

## Need Help?

For technical issues, contact your system administrator or Replit support.
