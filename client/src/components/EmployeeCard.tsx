import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Phone, MapPin, Edit2 } from "lucide-react";
import type { Area } from "@shared/schema";

export type EmployeeRole = "admin" | "supervisor" | "employee";

export interface EmployeeCardProps {
  id: string;
  name: string;
  role: EmployeeRole;
  position: string;
  phone: string;
  areas?: Area[];
  onSendSMS?: (id: string) => void;
  onViewProfile?: (id: string) => void;
  onEditAreas?: (id: string) => void;
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
  position,
  phone,
  areas,
  onSendSMS,
  onViewProfile,
  onEditAreas,
}: EmployeeCardProps) {
  const config = roleConfig[role];
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();

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
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onSendSMS?.(id);
          }}
          data-testid={`button-sms-${id}`}
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
