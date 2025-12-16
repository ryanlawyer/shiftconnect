import { useAuth } from "./use-auth";

// Canonical permission definitions matching server/shared permissions
export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view",
  SHIFTS_VIEW: "shifts:view",
  SHIFTS_MANAGE: "shifts:manage",
  SHIFTS_INTEREST: "shifts:interest",
  EMPLOYEES_VIEW: "employees:view",
  EMPLOYEES_MANAGE: "employees:manage",
  REPORTS_VIEW: "reports:view",
  REPORTS_EXPORT: "reports:export",
  AUDIT_LOG_VIEW: "audit_log:view",
  SETTINGS_VIEW: "settings:view",
  SETTINGS_ORG: "settings:org",
  SETTINGS_SMS: "settings:sms",
  TRAINING_VIEW: "training:view",
  TRAINING_MANAGE: "training:manage",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Map routes to required permissions
export const ROUTE_PERMISSIONS: Record<string, Permission | null> = {
  "/": null, // Home - routes to appropriate page based on permissions
  "/dashboard": PERMISSIONS.DASHBOARD_VIEW,
  "/shifts": PERMISSIONS.SHIFTS_VIEW,
  "/shifts/new": PERMISSIONS.SHIFTS_MANAGE,
  "/employees": PERMISSIONS.EMPLOYEES_MANAGE,
  "/messages": null, // Messages - available to all
  "/training": PERMISSIONS.TRAINING_VIEW,
  "/reports": PERMISSIONS.REPORTS_VIEW,
  "/settings": PERMISSIONS.SETTINGS_VIEW,
  "/audit-log": PERMISSIONS.AUDIT_LOG_VIEW,
};

export function usePermissions() {
  const { user } = useAuth();

  // Permissions now come directly from the auth user
  const permissions = user?.permissions || [];

  const hasPermission = (permission: Permission | string): boolean => {
    if (!user) return false;
    return permissions.includes(permission);
  };

  const hasAnyPermission = (...perms: (Permission | string)[]): boolean => {
    return perms.some((p) => hasPermission(p));
  };

  const hasAllPermissions = (...perms: (Permission | string)[]): boolean => {
    return perms.every((p) => hasPermission(p));
  };

  const canAccessRoute = (route: string): boolean => {
    const requiredPermission = ROUTE_PERMISSIONS[route];
    if (requiredPermission === null) return true; // No permission required
    if (requiredPermission === undefined) return false; // Unknown route
    return hasPermission(requiredPermission);
  };

  // Check if user can access dashboard (determines landing page)
  const canAccessDashboard = hasPermission(PERMISSIONS.DASHBOARD_VIEW);

  // Check if user can manage organization settings
  const canManageOrgSettings = hasPermission(PERMISSIONS.SETTINGS_ORG);
  const canManageSmsSettings = hasPermission(PERMISSIONS.SETTINGS_SMS);

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessRoute,
    canAccessDashboard,
    canManageOrgSettings,
    canManageSmsSettings,
    // Area assignments for filtering
    areaIds: user?.areaIds || [],
    // Legacy role checks for backwards compatibility
    isAdmin: user?.role === "admin",
    isSupervisor: user?.role === "supervisor",
    isEmployee: user?.role === "employee",
  };
}
