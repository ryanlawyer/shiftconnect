import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Phone } from "lucide-react";

export type EmployeeRole = "admin" | "supervisor" | "employee";

export interface EmployeeCardProps {
  id: string;
  name: string;
  role: EmployeeRole;
  department: string;
  phone: string;
  onSendSMS?: (id: string) => void;
  onViewProfile?: (id: string) => void;
}

const roleConfig = {
  admin: { label: "Admin", className: "bg-primary/10 text-primary" },
  supervisor: { label: "Supervisor", className: "bg-chart-2/10 text-chart-2" },
  employee: { label: "Employee", className: "bg-muted text-muted-foreground" },
};

export function EmployeeCard({
  id,
  name,
  role,
  department,
  phone,
  onSendSMS,
  onViewProfile,
}: EmployeeCardProps) {
  const config = roleConfig[role];
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div
      className="flex items-center justify-between gap-4 p-4 border-b last:border-b-0 hover-elevate"
      data-testid={`card-employee-${id}`}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 cursor-pointer" onClick={() => onViewProfile?.(id)}>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
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
          <p className="text-sm text-muted-foreground">{department}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground mr-2">
          <Phone className="h-3 w-3" />
          <span className="font-mono">{phone}</span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onSendSMS?.(id)}
          data-testid={`button-sms-${id}`}
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
