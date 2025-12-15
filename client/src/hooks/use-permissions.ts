import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import type { Role } from "@shared/schema";

// All available permissions in the system
export type Permission =
  | "manage_shifts"
  | "view_shifts"
  | "manage_employees"
  | "view_reports"
  | "export_reports"
  | "view_audit_log"
  | "manage_settings";

// Map routes/features to required permissions
export const ROUTE_PERMISSIONS: Record<string, Permission | null> = {
  "/": null, // Dashboard - available to all authenticated users, but content varies
  "/shifts": "view_shifts",
  "/shifts/new": "manage_shifts",
  "/employees": "manage_employees",
  "/messages": null, // Messages - available to all
  "/training": null, // Training - available to all
  "/reports": "view_reports",
  "/settings": null, // Settings - available to all (profile), but org settings need manage_settings
  "/audit-log": "view_audit_log",
};

export function usePermissions() {
  const { user } = useAuth();

  // Fetch the user's role to get permissions
  const { data: role, isLoading } = useQuery<Role>({
    queryKey: ["/api/roles", user?.roleId],
    enabled: !!user?.roleId,
  });

  const permissions = (role?.permissions as Permission[]) || [];

  const hasPermission = (permission: Permission): boolean => {
    // Admin role has all permissions
    if (user?.role === "admin") return true;
    return permissions.includes(permission);
  };

  const hasAnyPermission = (...perms: Permission[]): boolean => {
    return perms.some((p) => hasPermission(p));
  };

  const hasAllPermissions = (...perms: Permission[]): boolean => {
    return perms.every((p) => hasPermission(p));
  };

  const canAccessRoute = (route: string): boolean => {
    const requiredPermission = ROUTE_PERMISSIONS[route];
    if (requiredPermission === null) return true; // No permission required
    if (requiredPermission === undefined) return false; // Unknown route
    return hasPermission(requiredPermission);
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessRoute,
    isLoading,
    isAdmin: user?.role === "admin",
    isSupervisor: user?.role === "supervisor",
    isEmployee: user?.role === "employee",
  };
}
