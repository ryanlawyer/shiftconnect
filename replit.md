# ShiftConnect - Shift Management & Communication Platform

## Overview
ShiftConnect is a shift management and communication platform for healthcare or similar organizations. It enables supervisors to manage shifts, employees, and training, and send SMS notifications. Employees can view, express interest in, and communicate about shifts. The platform aims to streamline shift coordination and improve internal communication within organizations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript (Vite build tool)
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS with custom design tokens
- **Design System**: Linear-inspired for productivity and data clarity

### Backend
- **Runtime**: Node.js with Express.js (TypeScript, ESM modules)
- **API**: RESTful API (`/api/*`)
- **Build Process**: esbuild for server, Vite for client

### Data Layer
- **ORM**: Drizzle ORM (PostgreSQL dialect)
- **Schema**: `shared/schema.ts` (centralized definitions)
- **Validation**: Zod schemas (generated from Drizzle)
- **Migrations**: Drizzle Kit (`./migrations`)

### Project Structure
- `client/`: React frontend
- `server/`: Express backend
- `shared/`: Shared code (e.g., database schema)
- `migrations/`: Database migration files

### Key Design Patterns
- **Shared Types**: Type safety across frontend/backend via `shared/schema.ts`
- **Storage Interface**: `IStorage` abstracting data access
- **Path Aliases**: `@/` for client, `@shared/` for shared directory

### Feature Specifications
- **Phone Number Handling**: Stores in E.164 format, displays as (555) 123-4567.
- **SMS Agent (Future)**: AI-powered SMS agent using LLMs for natural language understanding, integrated with Role-Based Access Control (RBAC) aware guardrails. This includes an AI RBAC schema extension, context builder, data filtering layer, and conversation context management. Fallback to fixed commands if AI intent is unclear.
- **Security Patterns**: Server-side permission validation for sensitive fields, logging of unauthorized access attempts.

## External Dependencies

### Database
- **PostgreSQL**: Primary database.
- **connect-pg-simple**: Session storage.

### Third-Party Services
- **SMS Integration**: RingCentral (primary) and Twilio (secondary).
  - SMS templates and provider configuration managed in settings.
  - RingCentral uses JWT-based authentication, supports multiple JWT aliases, and requires specific app permissions (`SMS`, `ReadAccounts`).
  - Inbound SMS via webhook subscriptions (7-day expiration, renewable).
  - Supported SMS commands for employees: `YES`, `NO`, `SHIFTS`, `STATUS`, `CONFIRM`, `WITHDRAW`, `HELP`, `STOP`, `START`.
- **Authentication**: Passport.js with `passport-local` strategy.
- **LLM Integration**: OpenAI API (GPT-4 or GPT-3.5-turbo) for the AI SMS agent.