# Design Guidelines: Company Shift Management & Communication Platform

## Design Approach
**Selected System**: Linear-inspired productivity design with Material Design principles for data-dense components

**Rationale**: This is a utility-focused application where efficiency, clarity, and quick information processing are paramount. The interface should minimize friction for both employees checking shifts and supervisors managing them.

## Typography
**Font Stack**: 
- Primary: 'Inter' (Google Fonts) - all UI elements, body text
- Monospace: 'JetBrains Mono' - shift times, employee IDs

**Hierarchy**:
- Page Titles: text-3xl font-semibold
- Section Headers: text-xl font-medium
- Card Titles: text-lg font-medium
- Body Text: text-base font-normal
- Supporting Text: text-sm text-gray-600
- Timestamps/Meta: text-xs font-medium uppercase tracking-wide

## Layout System
**Spacing Primitives**: Use Tailwind units of 2, 4, 6, and 8 for consistency
- Component padding: p-4 or p-6
- Section spacing: space-y-6 or space-y-8
- Card gaps: gap-4
- Tight groupings: space-y-2

**Container Strategy**:
- Max width: max-w-7xl mx-auto
- Page padding: px-6 lg:px-8
- Content areas: max-w-4xl for focused content

## Core Component Library

### Navigation
**Top Navigation Bar**:
- Fixed header with backdrop blur (sticky top-0)
- Left: Company logo + primary navigation links
- Right: Notifications bell with badge count + user profile menu
- Height: h-16
- Border bottom with subtle shadow

**Sidebar Navigation** (for admin/supervisor views):
- Width: w-64 on desktop, collapsible drawer on mobile
- Grouped navigation items (Shifts, Messages, Employees, Training)
- Active state with border-l-4 accent indicator
- Icon + label format for all items

### Shift Management Components

**Shift Card**:
- Border with rounded corners (rounded-lg border)
- Padding: p-6
- Header: Position title + shift date/time (large, prominent)
- Body: Location, department, requirements
- Footer: Action buttons + metadata (posted by, posted time)
- Status badge (Available, Claimed, Expired) in top-right corner
- Hover state: subtle shadow elevation

**Shift Board/Grid**:
- Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Gaps: gap-6
- Filter bar above grid: department, date range, position type
- Sort options: newest first, start time, department

**Shift Detail Modal**:
- Overlay with centered modal (max-w-2xl)
- Full shift information displayed
- List of interested employees with timestamps
- Action buttons for claiming (employees) or assigning (supervisors)
- SMS notification toggle for supervisors

### Communication Components

**Message Thread**:
- Chat-style interface with alternating message alignment
- Sender messages: right-aligned with primary accent background
- Recipient messages: left-aligned with neutral background
- Timestamp below each message (text-xs)
- Avatar circles (h-8 w-8) next to messages
- Input area: fixed bottom with send button, h-16

**SMS Notification Panel**:
- Compose area with recipient selection (multi-select dropdown)
- Template shortcuts for common messages
- Character counter (160 char SMS limit indicator)
- Preview of formatted message
- Send button with confirmation

### Employee Directory

**Employee Card (Compact)**:
- Horizontal layout: avatar + name + role + contact button
- Border-b separator between items
- Quick actions: SMS, view profile icons (h-4 w-4)

**Employee Detail View**:
- Two-column layout: profile info (left) + shift history (right)
- Profile section: avatar (h-24 w-24), name, role, department, phone
- Shift history: table format with date, position, status columns

### Forms & Inputs

**Shift Creation Form**:
- Vertical form layout with clear field groupings
- Form sections: Shift Details, Requirements, Notifications
- Field spacing: space-y-4
- Input heights: h-10 for text inputs, h-12 for buttons
- Date/time pickers with calendar popover
- Multi-select for employee notification targeting

**Input Styles**:
- Border with rounded-md
- Focus state with ring-2 accent color
- Label above input (text-sm font-medium mb-2)
- Helper text below (text-xs)
- Error states with red border and message

### Data Displays

**Dashboard Cards**:
- Stat cards in grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Each card: p-6, rounded-lg, border
- Large number (text-4xl font-bold) + label (text-sm)
- Trend indicator (up/down arrow with percentage)

**Tables**:
- Striped rows for readability
- Sticky header row
- Action column (right-aligned) with icon buttons
- Row height: h-12 for comfortable clicking
- Hover state on rows

**Badges & Status Indicators**:
- Pill-shaped (rounded-full px-3 py-1)
- Size variations: text-xs for inline, text-sm for standalone
- Positions: Available (green tone), Claimed (blue tone), Expired (gray tone)
- Role badges: Admin (accent), Supervisor (secondary), Employee (neutral)

### Notifications

**Notification Dropdown**:
- Dropdown from bell icon in header
- Max height with scroll (max-h-96 overflow-y-auto)
- Individual notifications: p-4 with border-b
- Unread indicator: small dot or accent background
- Clear all + mark as read actions at bottom

**Toast Notifications**:
- Fixed bottom-right corner positioning
- Success/error/info variants
- Auto-dismiss after 5 seconds
- Slide-in animation from right

## Responsive Behavior
- Mobile: Single column, collapsible navigation, full-width cards
- Tablet: Two-column grids, persistent header
- Desktop: Three-column grids, sidebar navigation visible

## Images
**No hero images needed** - this is a functional application interface, not a marketing site. Focus on:
- User avatars throughout (profile pictures)
- Company logo in header
- Empty states with simple illustrations (when no shifts available, no messages, etc.)

## Key Design Principles
1. **Speed First**: Every interaction should feel instant - minimal loading states
2. **Information Density**: Maximize useful information per screen without clutter
3. **Scan-ability**: Use consistent spacing and typography to enable quick scanning
4. **Clear Hierarchy**: Most important actions always prominent (Claim Shift, Send SMS)
5. **Mobile-Optimized**: Employees checking shifts on phones - touch targets minimum 44px
6. **Accessibility**: High contrast text, keyboard navigation, screen reader support throughout