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
  - RingCentral uses JWT authentication with secrets: RINGCENTRAL_CLIENT_ID, RINGCENTRAL_CLIENT_SECRET, RINGCENTRAL_JWT, RINGCENTRAL_FROM_NUMBER
  - SMS templates managed via Settings > SMS tab
  - Note: RingCentral requires sending from assigned extension phone numbers
- **Authentication**: Passport.js with passport-local strategy
  - Default admin: username "pmorrison", password "admin123"

### Organization Configuration
- **Positions**: Managed via Settings > Organization tab (RN, LPN, CNA, Medical Tech, etc.)
- **Shift Locations**: Managed via Settings > Organization tab (configurable list)
- **Areas**: Managed via Settings > Organization tab (service areas/departments)

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