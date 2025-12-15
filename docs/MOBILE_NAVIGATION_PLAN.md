# Mobile Navigation Enhancement Plan

## Current State Analysis

### Existing Implementation
- **Desktop**: Full sidebar navigation with icons + labels
- **Mobile**: Sheet-based sidebar (hamburger menu) that slides in from left
- **Breakpoint**: 768px (md breakpoint)
- **Mobile Detection**: `useIsMobile()` hook using matchMedia

### Current Mobile UX Issues
1. **Hidden navigation** - Users must tap hamburger icon to see any navigation
2. **Extra tap required** - Every navigation action requires 2 taps (hamburger → destination)
3. **No persistent context** - User can't see current location at a glance
4. **Not thumb-friendly** - Hamburger icon in top-left corner is hardest reach zone on mobile

---

## Proposed Solution: Hybrid Navigation

### Approach
Add a **fixed bottom navigation bar** on mobile that provides:
- Quick access to primary actions (most used by DSPs on the go)
- Persistent visibility of current location
- Thumb-friendly interaction zone
- Keep hamburger menu for secondary navigation (Settings, etc.)

### Primary Navigation Items (Bottom Bar)
Based on DSP user needs, prioritize:

| Icon | Label | Route | Priority |
|------|-------|-------|----------|
| Calendar | My Shifts | `/shifts` | **Primary** - DSPs check shifts constantly |
| MessageSquare | Messages | `/messages` | **Primary** - Communication is critical |
| LayoutDashboard | Dashboard | `/` | **Secondary** - Admin overview (hide for employees) |
| User | Profile | `/settings` (Profile tab) | **Secondary** - Quick access to own info |
| MoreHorizontal | More | Opens sidebar | **Always** - Access to full navigation |

### Role-Based Navigation
```
Admin/Supervisor:
[Dashboard] [Shifts] [Messages] [Employees] [More]

Employee:
[Shifts] [Messages] [Training] [Profile] [More]
```

---

## Implementation Plan

### Phase 1: Create MobileBottomNav Component

```
/client/src/components/MobileBottomNav.tsx
```

**Features:**
- Fixed position at bottom of viewport
- 5-item navigation with icons + labels
- Active state indicator
- Badge support for unread counts
- Safe area inset support (notched phones)
- Hide on keyboard open (optional)

**Styling:**
- Height: 64px + safe-area-inset-bottom
- Background: bg-background with border-t
- Active item: Primary color highlight
- Icons: 24px with labels below (12px)

### Phase 2: Modify App Layout

**Changes to App.tsx:**
1. Import and render `MobileBottomNav` conditionally
2. Add bottom padding to main content on mobile
3. Pass user role for role-based nav items

**Changes to Header:**
1. Keep hamburger icon but restyle for consistency
2. Consider moving theme toggle to bottom nav "More" sheet

### Phase 3: Create "More" Sheet Component

When user taps "More" in bottom nav:
- Open a bottom sheet (not the full sidebar)
- Show remaining nav items: Training, Employees (if employee), Settings
- Include user profile mini-card
- Logout button

### Phase 4: Polish & Accessibility

- Add haptic feedback (if supported)
- Ensure keyboard navigation works
- Add ARIA labels
- Test with screen readers
- Add transition animations

---

## Technical Specifications

### MobileBottomNav Component Interface

```tsx
interface MobileBottomNavProps {
  userRole: "admin" | "supervisor" | "employee";
  unreadMessages?: number;
  currentPath: string;
}

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  badge?: number;
  roles?: ("admin" | "supervisor" | "employee")[];
  action?: "navigate" | "sheet"; // "sheet" for More button
}
```

### CSS Considerations

```css
/* Safe area support */
.mobile-bottom-nav {
  padding-bottom: env(safe-area-inset-bottom, 0);
}

/* Hide on desktop */
@media (min-width: 768px) {
  .mobile-bottom-nav {
    display: none;
  }
}

/* Main content padding when nav visible */
@media (max-width: 767px) {
  .main-content {
    padding-bottom: calc(64px + env(safe-area-inset-bottom, 0));
  }
}
```

### Animation Specs
- Nav item tap: scale(0.95) → scale(1) with 100ms ease
- Active indicator: slide transition 200ms ease
- Badge pulse on update

---

## File Changes Summary

### New Files
1. `client/src/components/MobileBottomNav.tsx` - Main component
2. `client/src/components/MobileMoreSheet.tsx` - "More" menu sheet

### Modified Files
1. `client/src/App.tsx` - Layout integration
2. `client/src/index.css` - Safe area styles
3. `client/src/components/AppSidebar.tsx` - Possible simplification for mobile

---

## Visual Design

```
┌─────────────────────────────────────┐
│  [≡]  ShiftConnect           [🌙]  │  ← Header (mobile)
├─────────────────────────────────────┤
│                                     │
│                                     │
│         Page Content                │
│                                     │
│                                     │
├─────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ │
│ │ 📅  │ │ 💬  │ │ 📊  │ │ 👤  │ │ ⋯  │ │
│ │Shifts│ │ Msg │ │Dash │ │ Me  │ │More │ │
│ │  •  │ │ (2) │ │     │ │     │ │     │ │  ← Bottom Nav
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← Safe area
└─────────────────────────────────────┘

• = Active indicator
(2) = Badge with unread count
```

---

## Success Metrics

1. **Reduced tap count** - Navigation should be 1 tap for primary destinations
2. **Discoverability** - New users immediately see navigation options
3. **Thumb zone** - All primary actions in comfortable reach
4. **Performance** - No layout shift on navigation

---

## Alternatives Considered

### 1. Tab Bar Only (No Hamburger)
**Rejected** - Too many nav items (7+) to fit comfortably

### 2. Floating Action Button (FAB)
**Rejected** - Better for single primary action, not navigation

### 3. Gesture-Based Navigation
**Rejected** - Not discoverable, conflicts with browser gestures

### 4. Keep Current (Sheet Sidebar Only)
**Rejected** - Requires 2 taps for every action, poor for frequent use

---

## Implementation Order

1. ✅ Create `MobileBottomNav.tsx` component
2. ✅ Add to App.tsx with conditional rendering
3. ✅ Implement role-based nav items
4. ✅ Add badge support for messages
5. ✅ Create "More" sheet component
6. ✅ Add safe area inset support
7. ✅ Polish animations and transitions
8. ✅ Test on various devices
