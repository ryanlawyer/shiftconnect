import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Clock, Users, Calendar, Hand } from "lucide-react";

export type ShiftStatus = "available" | "claimed" | "expired";

export interface ShiftCardProps {
  id: string;
  position: string;
  department: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  requirements?: string;
  postedBy: string;
  postedAt: string;
  status: ShiftStatus;
  interestedCount?: number;
  onShowInterest?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  isAdmin?: boolean;
}

const statusConfig = {
  available: { label: "Available", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  claimed: { label: "Claimed", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground" },
};

export function ShiftCard({
  id,
  position,
  department,
  location,
  date,
  startTime,
  endTime,
  requirements,
  postedBy,
  postedAt,
  status,
  interestedCount = 0,
  onShowInterest,
  onViewDetails,
  isAdmin = false,
}: ShiftCardProps) {
  const config = statusConfig[status];

  return (
    <Card className="hover-elevate" data-testid={`card-shift-${id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="space-y-1">
          <h3 className="text-lg font-medium" data-testid={`text-position-${id}`}>{position}</h3>
          <p className="text-sm text-muted-foreground">{department}</p>
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
        {requirements && (
          <p className="text-sm text-muted-foreground">{requirements}</p>
        )}
        {interestedCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{interestedCount} interested</span>
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
