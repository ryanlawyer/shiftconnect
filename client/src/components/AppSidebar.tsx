import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  MessageSquare,
  Users,
  GraduationCap,
  LayoutDashboard,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions, PERMISSIONS } from "@/hooks/use-permissions";

export interface AppSidebarProps {
  userRole?: "admin" | "supervisor" | "employee";
  userName?: string;
  unreadMessages?: number;
}

export function AppSidebar({
  userRole = "admin",
  userName = "Admin User",
  unreadMessages = 0
}: AppSidebarProps) {
  const [location] = useLocation();
  const { logoutMutation } = useAuth();
  const { hasPermission, canAccessDashboard, canManageOrgSettings } = usePermissions();
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase();

  const allNavItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      permission: PERMISSIONS.DASHBOARD_VIEW,
    },
    {
      title: "Open Shifts",
      url: "/shifts",
      icon: Calendar,
      permission: PERMISSIONS.SHIFTS_VIEW,
    },
    {
      title: "Messages",
      url: "/messages",
      icon: MessageSquare,
      permission: null,
      badge: unreadMessages > 0 ? unreadMessages : undefined,
    },
    {
      title: "Employees",
      url: "/employees",
      icon: Users,
      permission: PERMISSIONS.EMPLOYEES_MANAGE,
    },
    {
      title: "Training",
      url: "/training",
      icon: GraduationCap,
      permission: PERMISSIONS.TRAINING_VIEW,
    },
    {
      title: "Reports",
      url: "/reports",
      icon: BarChart3,
      permission: PERMISSIONS.REPORTS_VIEW,
    },
    {
      title: "Audit Log",
      url: "/audit-log",
      icon: Shield,
      permission: PERMISSIONS.AUDIT_LOG_VIEW,
    },
  ];

  const mainNavItems = allNavItems.filter(
    item => item.permission === null || hasPermission(item.permission)
  );

  return (
    <Sidebar data-testid="app-sidebar">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">ShiftConnect</h2>
            <p className="text-xs text-muted-foreground">Shift Management</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                  >
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.badge && (
                        <Badge className="ml-auto text-xs" data-testid={`badge-${item.title.toLowerCase()}`}>
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {canManageOrgSettings && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/settings"}>
                    <Link href="/settings" data-testid="nav-settings">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">{userName}</p>
            <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            data-testid="button-logout"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
