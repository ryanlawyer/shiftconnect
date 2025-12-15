# ShiftConnect Project Handoff

## 📌 Project Overview
ShiftConnect is a shift management application designed for healthcare or residential facility staffing. It allows administrators to manage employees, positions, areas (programs), and shifts, while enabling employees to view and claim available shifts.

## 🛠 Tech Stack
-   **Frontend**: React, TypeScript, Vite, TanStack Query, Wouter (Routing), Shadcn UI, Tailwind CSS.
-   **Backend**: Node.js, Express, Passport.js (Auth).
-   **Database/ORM**: Drizzle ORM. Currently using `MemStorage` (In-Memory) for rapid development.
    -   *Note*: Data resets when the server restarts.

## ✅ Current Features & Status

### 1. Authentication & Security
-   **Login**: Secure session-based authentication (`passport-local`).
-   **Registration**: Public registration is **DISABLED**.
-   **User Management**: Admins create user accounts and reset passwords via the **Employees** page.
-   **Password Hashing**: Uses `scrypt` with a `hash.salt` format.

### 2. Role-Based Access Control (RBAC)
-   **Dynamic Roles**: Roles are stored in the database (`roles` table), not hardcoded.
-   **Management**: Configurable via **Settings > Access Roles**.
-   **Permissions**: Granular permissions support (JSON array in database).
-   **System Roles**: `Admin`, `Supervisor`, `Employee` (cannot be deleted).

### 3. Position Management
-   **Dynamic Positions**: Job titles are managed in the database (`positions` table).
-   **Management**: Configurable via **Settings > Position Management**.
-   **Safe Deletion**: Deleting a position requires reassigning affected employees/shifts.

### 4. Employee & Shift Management
-   **Employees**: detailed profiles, area assignments, SMS opt-in status.
-   **Shifts**: Create, list, filtering by Area/Status.
-   **Interests**: Employees can signal interest in shifts; Admins assign them.

## 📂 Project Structure
-   `server/`: Backend logic.
    -   `routes.ts`: API endpoints (includes Admin User Management).
    -   `storage.ts`: Data access layer (CRUD).
    -   `auth.ts`: Authentication setup (Passport strategies).
-   `client/src/pages/`:
    -   `Employees.tsx`: Staff directory & User Management logic.
    -   `Settings.tsx`: RBAC & Position configuration.
    -   `Shifts.tsx`: Shift listing (Grid view).
-   `shared/schema.ts`: Database schema (Drizzle Tables & Zod Schemas).

## 🚀 Next Steps (Recommendations)
Based on the latest analysis, the following features are recommended for the next sprint:

1.  **Calendar View**: Implement a weekly/monthly calendar for shifts (`react-big-calendar`) in `Shifts.tsx`.
2.  **Bulk Actions**: Allow creating recurring shifts or assigning multiple shifts at once.
3.  **Reporting**: Add a Stats/Analytics page for fill rates and employee utilization.

## ⚠️ Important Notes for Next Developer
-   **Storage**: The app currently uses `MemStorage`. To persist data, implement `DatabaseStorage` using Postgres/SQLite.
-   **User Creation**: `storage.createUser` initializes users with `null` role/employee links. usage in `routes.ts` handles the linking via `updateUser` immediately after creation.
-   **Environment**: Requires `npm install && npm run dev`. Server runs on port 5000.

---
*Last Updated: December 15, 2025*
