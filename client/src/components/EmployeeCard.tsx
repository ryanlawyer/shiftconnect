import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageSquare, Phone, MapPin, Edit2, UserCog, UserPlus, Send, History } from "lucide-react";
import { useLocation } from "wouter";
import type { Area } from "@shared/schema";

export type EmployeeRole = "admin" | "supervisor" | "employee";

export interface EmployeeCardProps {
  id: string;
  name: string;
  role: string;
  position: string;
  phone: string;
  areas?: Area[];
  onSendSMS?: (id: string) => void;
  onViewProfile?: (id: string) => void;
  onEditAreas?: (id: string) => void;
  onManageUser?: (id: string) => void;
  hasUserAccount?: boolean;
}

const roleConfig: Record<string, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-primary/10 text-primary" },
  supervisor: { label: "Supervisor", className: "bg-chart-2/10 text-chart-2" },
  employee: { label: "Employee", className: "bg-muted text-muted-foreground" },
};

export function EmployeeCard({
  id,
  name,
  role,
  position,
  phone,
  areas,
  onSendSMS,
  onViewProfile,
  onEditAreas,
  onManageUser,
  hasUserAccount,
}: EmployeeCardProps) {
  const [, setLocation] = useLocation();
  const normalizedRole = role.toLowerCase();
  const config = roleConfig[normalizedRole] || { label: role, className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" };
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();

  const handleViewConversation = () => {
    // Navigate to messages page with the employee pre-selected
    setLocation(`/messages?employee=${id}`);
  };

  return (
    <div
      className="flex items-center justify-between gap-4 p-4 border-b last:border-b-0 hover-elevate"
      data-testid={`card-employee-${id}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-10 w-10 cursor-pointer shrink-0" onClick={() => onViewProfile?.(id)}>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-medium cursor-pointer hover:underline"
              onClick={() => onViewProfile?.(id)}
              data-testid={`text-name-${id}`}
            >
              {name}
            </span>
            <Badge className={`text-xs ${config.className}`} data-testid={`badge-role-${id}`}>
              {config.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{position}</p>
          {areas && areas.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
              {areas.map((area) => (
                <Badge
                  key={area.id}
                  variant="outline"
                  className="text-xs"
                  data-testid={`badge-area-${id}-${area.id}`}
                >
                  {area.name}
                </Badge>
              ))}
              {onEditAreas && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditAreas(id);
                  }}
                  data-testid={`button-edit-areas-${id}`}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
          {areas && areas.length === 0 && onEditAreas && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground mt-1 px-1"
              onClick={(e) => {
                e.stopPropagation();
                onEditAreas(id);
              }}
              data-testid={`button-add-areas-${id}`}
            >
              <MapPin className="h-3 w-3 mr-1" />
              Assign areas
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground mr-2">
          <Phone className="h-3 w-3" />
          <span className="font-mono">{phone}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => e.stopPropagation()}
              data-testid={`button-sms-${id}`}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSendSMS?.(id)}>
              <Send className="h-4 w-4 mr-2" />
              Send SMS
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleViewConversation}>
              <History className="h-4 w-4 mr-2" />
              View Conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {onManageUser && (
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onManageUser(id);
            }}
            title={hasUserAccount ? "Manage User Account" : "Create User Account"}
            data-testid={`button-manage-user-${id}`}
          >
            {hasUserAccount ? (
              <UserCog className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
