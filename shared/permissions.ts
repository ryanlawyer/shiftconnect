// Canonical permission definitions for role-based access control

export const PERMISSIONS = {
  // Dashboard access
  DASHBOARD_VIEW: "dashboard:view",
  
  // Shift management
  SHIFTS_VIEW: "shifts:view",
  SHIFTS_MANAGE: "shifts:manage",
  SHIFTS_INTEREST: "shifts:interest", // Express interest in shifts
  SHIFTS_ALL_AREAS: "shifts:all_areas", // Can create shifts that notify all areas
  
  // Employee management
  EMPLOYEES_VIEW: "employees:view",
  EMPLOYEES_MANAGE: "employees:manage",
  
  // Reports
  REPORTS_VIEW: "reports:view",
  REPORTS_EXPORT: "reports:export",
  
  // Audit log
  AUDIT_LOG_VIEW: "audit_log:view",
  
  // Settings
  SETTINGS_VIEW: "settings:view",
  SETTINGS_ORG: "settings:org", // Organization-wide settings
  SETTINGS_SMS: "settings:sms", // SMS templates and configuration
  
  // Training
  TRAINING_VIEW: "training:view",
  TRAINING_MANAGE: "training:manage",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Default permission sets for each role
export const ROLE_PERMISSIONS = {
  admin: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SHIFTS_VIEW,
    PERMISSIONS.SHIFTS_MANAGE,
    PERMISSIONS.SHIFTS_ALL_AREAS,
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.AUDIT_LOG_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_ORG,
    PERMISSIONS.SETTINGS_SMS,
    PERMISSIONS.TRAINING_VIEW,
    PERMISSIONS.TRAINING_MANAGE,
  ],
  supervisor: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SHIFTS_VIEW,
    PERMISSIONS.SHIFTS_MANAGE,
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.AUDIT_LOG_VIEW,
    PERMISSIONS.TRAINING_VIEW,
    PERMISSIONS.TRAINING_MANAGE,
  ],
  employee: [
    PERMISSIONS.SHIFTS_VIEW,
    PERMISSIONS.SHIFTS_INTEREST,
    PERMISSIONS.TRAINING_VIEW,
  ],
} as const;

// Helper to check if a user has a specific permission
export function hasPermission(userPermissions: string[], permission: Permission): boolean {
  return userPermissions.includes(permission);
}

// Helper to check if a user has any of the specified permissions
export function hasAnyPermission(userPermissions: string[], permissions: Permission[]): boolean {
  return permissions.some(p => userPermissions.includes(p));
}

// Helper to check if a user has all of the specified permissions
export function hasAllPermissions(userPermissions: string[], permissions: Permission[]): boolean {
  return permissions.every(p => userPermissions.includes(p));
}
