import { Redirect } from "wouter";
import { usePermissions, type Permission } from "@/hooks/use-permissions";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface ProtectedRouteProps {
  permission?: Permission;
  children: React.ReactNode;
  fallback?: "redirect" | "denied";
}

export function ProtectedRoute({
  permission,
  children,
  fallback = "denied",
}: ProtectedRouteProps) {
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If no permission required, render children
  if (!permission) {
    return <>{children}</>;
  }

  // Check if user has required permission
  if (!hasPermission(permission)) {
    if (fallback === "redirect") {
      return <Redirect to="/" />;
    }

    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <ShieldAlert className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground text-center max-w-md">
          You don't have permission to access this page. Please contact your
          administrator if you believe this is an error.
        </p>
        <Link href="/">
          <Button variant="outline">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
