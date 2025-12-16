import { Link, useLocation } from "wouter";
import {
  Calendar,
  Users,
  GraduationCap,
  LayoutDashboard,
  MoreHorizontal,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { MobileMoreSheet } from "./MobileMoreSheet";
import { usePermissions, type Permission } from "@/hooks/use-permissions";

export interface MobileBottomNavProps {
  userRole: "admin" | "supervisor" | "employee";
  userName: string;
  unreadMessages?: number;
}

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  badge?: number;
  permission?: Permission | null;
  action?: "navigate" | "sheet";
}

export function MobileBottomNav({
  userRole,
  userName,
  unreadMessages = 0,
}: MobileBottomNavProps) {
  const [location] = useLocation();
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const { hasPermission } = usePermissions();

  // Define all possible navigation items with permissions
  const allNavItems: NavItem[] = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      href: "/",
      permission: null, // Available to all
    },
    {
      icon: Calendar,
      label: "Shifts",
      href: "/shifts",
      permission: "shifts:view",
    },
    {
      icon: Users,
      label: "Employees",
      href: "/employees",
      permission: "employees:manage",
    },
    {
      icon: GraduationCap,
      label: "Training",
      href: "/training",
      permission: null, // Available to all
    },
    {
      icon: User,
      label: "Profile",
      href: "/settings",
      permission: null, // Available to all
    },
    {
      icon: MoreHorizontal,
      label: "More",
      href: "#",
      permission: null, // Available to all
      action: "sheet",
    },
  ];

  // Filter items based on permissions
  const availableItems = allNavItems.filter(
    item => !item.permission || hasPermission(item.permission)
  );

  // Select items for bottom nav (max 5)
  // Priority: Dashboard, Shifts, Employees (if has permission), then More
  const priorityOrder = ["Dashboard", "Shifts", "Employees", "Training", "Profile", "More"];
  const sortedItems = [...availableItems].sort(
    (a, b) => priorityOrder.indexOf(a.label) - priorityOrder.indexOf(b.label)
  );

  // Take first 4 items + More
  const moreItem = sortedItems.find(item => item.label === "More");
  const otherItems = sortedItems.filter(item => item.label !== "More").slice(0, 4);
  const navItems = moreItem ? [...otherItems, moreItem] : otherItems;

  const handleNavClick = (item: NavItem, e: React.MouseEvent) => {
    if (item.action === "sheet") {
      e.preventDefault();
      setMoreSheetOpen(true);
    }
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive =
              item.action !== "sheet" &&
              (item.href === "/"
                ? location === "/"
                : location.startsWith(item.href));

            const NavContent = (
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-150",
                  "active:scale-95",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.badge && (
                    <Badge
                      className="absolute -top-2 -right-3 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
                      variant="destructive"
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-1 h-1 w-6 bg-primary rounded-full" />
                )}
              </div>
            );

            if (item.action === "sheet") {
              return (
                <button
                  key={item.label}
                  onClick={(e) => handleNavClick(item, e)}
                  className="relative flex-1 flex items-center justify-center"
                >
                  {NavContent}
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className="relative flex-1 flex items-center justify-center"
              >
                {NavContent}
              </Link>
            );
          })}
        </div>
      </nav>

      <MobileMoreSheet
        open={moreSheetOpen}
        onOpenChange={setMoreSheetOpen}
        userRole={userRole}
        userName={userName}
      />
    </>
  );
}
