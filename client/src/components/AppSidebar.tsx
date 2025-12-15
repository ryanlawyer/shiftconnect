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
  Settings,
  LogOut,
  Building2,
} from "lucide-react";

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
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase();

  const isAdmin = userRole === "admin" || userRole === "supervisor";

  const mainNavItems = [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
      visible: isAdmin,
    },
    {
      title: "Open Shifts",
      url: "/shifts",
      icon: Calendar,
      visible: true,
    },
    {
      title: "Messages",
      url: "/messages",
      icon: MessageSquare,
      visible: true,
      badge: unreadMessages > 0 ? unreadMessages : undefined,
    },
    {
      title: "Employees",
      url: "/employees",
      icon: Users,
      visible: isAdmin,
    },
    {
      title: "Training",
      url: "/training",
      icon: GraduationCap,
      visible: true,
    },
  ].filter(item => item.visible);

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

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
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
          <Button size="icon" variant="ghost" data-testid="button-logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
