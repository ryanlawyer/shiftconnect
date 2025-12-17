import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MapPin, Clock, Users, Calendar, Hand, UserCheck, DollarSign, Globe, Bell, Copy, UserPlus, Loader2 } from "lucide-react";
import type { Area, Employee } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export type ShiftStatus = "available" | "claimed" | "expired";

export interface ShiftCardProps {
  id: string;
  position: string;
  positionId?: string;
  area?: Area | null;
  areaId?: string;
  areaName?: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  requirements?: string | null;
  postedBy: string;
  postedAt: string;
  status: ShiftStatus;
  interestedCount?: number;
  assignedEmployee?: Employee | null;
  bonusAmount?: number | null;
  notifyAllAreas?: boolean;
  lastNotifiedAt?: string | Date | null;
  notificationCount?: number | null;
  onShowInterest?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  onNotify?: (id: string) => void;
  onClone?: (id: string) => void;
  onQuickAssign?: (id: string) => void;
  isAdmin?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (id: string, selected: boolean) => void;
  showCheckbox?: boolean;
  isNotifying?: boolean;
}

const statusConfig = {
  available: { label: "Available", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  claimed: { label: "Claimed", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground" },
};

export function ShiftCard({
  id,
  position,
  positionId,
  area,
  areaId,
  areaName,
  location,
  date,
  startTime,
  endTime,
  requirements,
  postedBy,
  postedAt,
  status,
  interestedCount = 0,
  assignedEmployee,
  bonusAmount,
  notifyAllAreas,
  lastNotifiedAt,
  notificationCount,
  onShowInterest,
  onViewDetails,
  onNotify,
  onClone,
  onQuickAssign,
  isAdmin = false,
  isSelected = false,
  onSelectionChange,
  showCheckbox = false,
  isNotifying = false,
}: ShiftCardProps) {
  const config = statusConfig[status];
  const displayAreaName = area?.name || areaName || "Unassigned";
  
  const formatNotificationStatus = () => {
    if (!lastNotifiedAt) return null;
    const notifiedDate = typeof lastNotifiedAt === 'string' ? new Date(lastNotifiedAt) : lastNotifiedAt;
    const timeAgo = formatDistanceToNow(notifiedDate, { addSuffix: true });
    const count = notificationCount || 0;
    return `Notified ${count} ${count === 1 ? 'employee' : 'employees'} ${timeAgo}`;
  };
  
  const notificationStatus = formatNotificationStatus();

  return (
    <Card 
      className={cn(
        "hover-elevate",
        isSelected && "ring-2 ring-primary bg-primary/5"
      )} 
      data-testid={`card-shift-${id}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-start gap-3">
          {showCheckbox && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelectionChange?.(id, !!checked)}
              data-testid={`checkbox-shift-${id}`}
              className="mt-1"
            />
          )}
          <div className="space-y-1">
            <h3 className="text-lg font-medium" data-testid={`text-position-${id}`}>{position}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs" data-testid={`badge-area-${id}`}>
                {displayAreaName}
              </Badge>
              {notifyAllAreas && (
                <Badge variant="secondary" className="text-xs" data-testid={`badge-all-areas-${id}`}>
                  <Globe className="h-3 w-3 mr-1" />
                  All Areas
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Badge className={config.className} data-testid={`badge-status-${id}`}>
          {config.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{date}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{startTime} - {endTime}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span>{location}</span>
        </div>
        {bonusAmount && bonusAmount > 0 && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400" data-testid={`text-bonus-${id}`}>
              ${bonusAmount} Bonus
            </span>
          </div>
        )}
        {requirements && (
          <p className="text-sm text-muted-foreground">{requirements}</p>
        )}
        {assignedEmployee && (
          <div className="flex items-center gap-1.5 text-sm">
            <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              Assigned to {assignedEmployee.name}
            </span>
          </div>
        )}
        {interestedCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{interestedCount} interested</span>
          </div>
        )}
        {notificationStatus && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid={`text-notification-status-${id}`}>
            <Bell className="h-4 w-4" />
            <span>{notificationStatus}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">{postedBy.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">
            Posted by {postedBy} {postedAt}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && status === "available" && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onNotify?.(id)}
                    disabled={isNotifying}
                    data-testid={`button-notify-${id}`}
                  >
                    {isNotifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Notify Again</TooltipContent>
              </Tooltip>
              {interestedCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onQuickAssign?.(id)}
                      data-testid={`button-quick-assign-${id}`}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Quick Assign</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onClone?.(id)}
                    data-testid={`button-clone-${id}`}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clone Shift</TooltipContent>
              </Tooltip>
            </>
          )}
          {status === "available" && !isAdmin && (
            <Button
              size="sm"
              onClick={() => onShowInterest?.(id)}
              data-testid={`button-interest-${id}`}
            >
              <Hand className="h-4 w-4 mr-1" />
              I'm Interested
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails?.(id)}
            data-testid={`button-details-${id}`}
          >
            View Details
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
