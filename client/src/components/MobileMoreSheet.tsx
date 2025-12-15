import { Link, useLocation } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  GraduationCap,
  Settings,
  LogOut,
  LayoutDashboard,
  BarChart3,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions, type Permission } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

export interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: "admin" | "supervisor" | "employee";
  userName: string;
}

interface MoreNavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  permission?: Permission | null;
}

export function MobileMoreSheet({
  open,
  onOpenChange,
  userRole,
  userName,
}: MobileMoreSheetProps) {
  const [location] = useLocation();
  const { logoutMutation } = useAuth();
  const { hasPermission } = usePermissions();
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  // All possible items for the More sheet with permission requirements
  const allMoreItems: MoreNavItem[] = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      href: "/",
      permission: null, // Available to all
    },
    {
      icon: GraduationCap,
      label: "Training",
      href: "/training",
      permission: null, // Available to all
    },
    {
      icon: BarChart3,
      label: "Reports",
      href: "/reports",
      permission: "view_reports",
    },
    {
      icon: Shield,
      label: "Audit Log",
      href: "/audit-log",
      permission: "view_audit_log",
    },
    {
      icon: Settings,
      label: "Settings",
      href: "/settings",
      permission: null, // Available to all
    },
  ];

  // Filter items based on permissions
  const moreNavItems = allMoreItems.filter(
    item => !item.permission || hasPermission(item.permission)
  );

  const handleNavClick = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        <SheetHeader className="text-left pb-4">
          <SheetTitle className="sr-only">More Options</SheetTitle>
          {/* User Profile Card */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{userName}</p>
              <p className="text-sm text-muted-foreground capitalize">
                {userRole}
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-1">
          {moreNavItems.map((item) => {
            const isActive =
              item.href === "/"
                ? location === "/"
                : location.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <Separator className="my-4" />

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-3 py-3 h-auto text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => {
            logoutMutation.mutate();
            onOpenChange(false);
          }}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Log Out</span>
        </Button>
      </SheetContent>
    </Sheet>
  );
}
