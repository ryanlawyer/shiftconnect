import { Redirect } from "wouter";
import { usePermissions } from "@/hooks/use-permissions";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface ProtectedRouteProps {
  permission?: string;
  children: React.ReactNode;
  fallback?: "redirect" | "denied";
}

export function ProtectedRoute({
  permission,
  children,
  fallback = "denied",
}: ProtectedRouteProps) {
  const { hasPermission } = usePermissions();

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
