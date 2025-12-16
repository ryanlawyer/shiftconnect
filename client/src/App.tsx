import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { usePermissions, PERMISSIONS } from "@/hooks/use-permissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/Dashboard";
import EmployeeHome from "@/pages/EmployeeHome";
import Shifts from "@/pages/Shifts";
import NewShift from "@/pages/NewShift";
import Employees from "@/pages/Employees";
import Messages from "@/pages/Messages";
import Training from "@/pages/Training";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import AuditLog from "@/pages/AuditLog";

function ProtectedApp() {
  const { user, isLoading } = useAuth();
  const { canAccessDashboard, hasPermission } = usePermissions();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const userRole = user.role as "admin" | "supervisor" | "employee";
  const displayName = user.employeeName || user.username;

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar
          userRole={userRole}
          userName={displayName}
          unreadMessages={2}
        />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 p-3 border-b sticky top-0 bg-background z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className={`flex-1 overflow-auto ${isMobile ? "pb-20" : ""}`}>
            <Switch>
              <Route path="/">
                {canAccessDashboard ? <Dashboard /> : <EmployeeHome />}
              </Route>
              <Route path="/dashboard">
                <ProtectedRoute permission={PERMISSIONS.DASHBOARD_VIEW}>
                  <Dashboard />
                </ProtectedRoute>
              </Route>
              <Route path="/shifts">
                <ProtectedRoute permission={PERMISSIONS.SHIFTS_VIEW}>
                  <Shifts />
                </ProtectedRoute>
              </Route>
              <Route path="/shifts/new">
                <ProtectedRoute permission={PERMISSIONS.SHIFTS_MANAGE}>
                  <NewShift />
                </ProtectedRoute>
              </Route>
              <Route path="/shifts/:id/edit">
                {(params) => (
                  <ProtectedRoute permission={PERMISSIONS.SHIFTS_MANAGE}>
                    <NewShift editId={params.id} />
                  </ProtectedRoute>
                )}
              </Route>
              <Route path="/employees">
                <ProtectedRoute permission={PERMISSIONS.EMPLOYEES_MANAGE}>
                  <Employees />
                </ProtectedRoute>
              </Route>
              <Route path="/messages">
                <Messages />
              </Route>
              <Route path="/training">
                <ProtectedRoute permission={PERMISSIONS.TRAINING_VIEW}>
                  <Training />
                </ProtectedRoute>
              </Route>
              <Route path="/reports">
                <ProtectedRoute permission={PERMISSIONS.REPORTS_VIEW}>
                  <Reports />
                </ProtectedRoute>
              </Route>
              <Route path="/settings">
                <ProtectedRoute permission={PERMISSIONS.SETTINGS_ORG}>
                  <Settings />
                </ProtectedRoute>
              </Route>
              <Route path="/audit-log">
                <ProtectedRoute permission={PERMISSIONS.AUDIT_LOG_VIEW}>
                  <AuditLog />
                </ProtectedRoute>
              </Route>
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
        {isMobile && (
          <MobileBottomNav
            userRole={userRole}
            userName={displayName}
            unreadMessages={2}
          />
        )}
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route component={ProtectedApp} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
