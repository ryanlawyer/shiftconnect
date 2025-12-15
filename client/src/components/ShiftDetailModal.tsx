import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MapPin, Clock, Calendar, Users, MessageSquare, Hand, CheckCircle } from "lucide-react";
import { useState } from "react";
import type { ShiftStatus } from "./ShiftCard";
import type { Area } from "@shared/schema";

export interface InterestedEmployee {
  id: string;
  name: string;
  timestamp: string;
}

export interface ShiftDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: {
    id: string;
    position: string;
    area?: Area | null;
    areaName?: string;
    location: string;
    date: string;
    startTime: string;
    endTime: string;
    requirements?: string | null;
    postedBy: string;
    status: ShiftStatus;
    interestedEmployees: InterestedEmployee[];
  };
  isAdmin?: boolean;
  onShowInterest?: (id: string) => void;
  onAssign?: (shiftId: string, employeeId: string, sendNotification: boolean) => void;
  onMessageEmployee?: (employeeId: string) => void;
}

const statusConfig = {
  available: { label: "Available", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  claimed: { label: "Claimed", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground" },
};

export function ShiftDetailModal({
  open,
  onOpenChange,
  shift,
  isAdmin = false,
  onShowInterest,
  onAssign,
  onMessageEmployee,
}: ShiftDetailModalProps) {
  const [sendNotification, setSendNotification] = useState(true);
  const config = statusConfig[shift.status];
  const displayAreaName = shift.area?.name || shift.areaName || "Unassigned";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="modal-shift-detail">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">{shift.position}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{displayAreaName}</Badge>
              </DialogDescription>
            </div>
            <Badge className={config.className}>{config.label}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Date</p>
                <p className="text-sm text-muted-foreground font-mono">{shift.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Time</p>
                <p className="text-sm text-muted-foreground font-mono">{shift.startTime} - {shift.endTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Location</p>
                <p className="text-sm text-muted-foreground">{shift.location}</p>
              </div>
            </div>
          </div>

          {shift.requirements && (
            <div>
              <p className="text-sm font-medium mb-1">Requirements</p>
              <p className="text-sm text-muted-foreground">{shift.requirements}</p>
            </div>
          )}

          <Separator />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4" />
              <p className="text-sm font-medium">Interested Employees ({shift.interestedEmployees.length})</p>
            </div>
            {shift.interestedEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one has expressed interest yet.</p>
            ) : (
              <div className="space-y-2">
                {shift.interestedEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    data-testid={`interested-employee-${emp.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {emp.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">{emp.timestamp}</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onMessageEmployee?.(emp.id)}
                          data-testid={`button-message-${emp.id}`}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onAssign?.(shift.id, emp.id, sendNotification)}
                          data-testid={`button-assign-${emp.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isAdmin && shift.status === "available" && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <Label htmlFor="notify-assignment" className="text-sm">
                  Send SMS notification when assigned
                </Label>
                <Switch
                  id="notify-assignment"
                  checked={sendNotification}
                  onCheckedChange={setSendNotification}
                  data-testid="switch-notify-assignment"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!isAdmin && shift.status === "available" && (
            <Button onClick={() => onShowInterest?.(shift.id)} data-testid="button-modal-interest">
              <Hand className="h-4 w-4 mr-2" />
              I'm Interested
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
