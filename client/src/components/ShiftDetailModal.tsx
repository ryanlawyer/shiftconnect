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
import { Input } from "@/components/ui/input";
import { MapPin, Clock, Calendar, Users, MessageSquare, Hand, CheckCircle, UserCheck, Edit, RefreshCw, Trash2, DollarSign, UserMinus } from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import type { ShiftStatus } from "./ShiftCard";
import type { Area, Employee, Position } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    assignedEmployee?: Employee | null;
    bonusAmount?: number | null;
  };
  isAdmin?: boolean;
  onShowInterest?: (id: string) => void;
  onAssign?: (shiftId: string, employeeId: string, sendNotification: boolean) => void;
  onMessageEmployee?: (employeeId: string) => void;
  onEdit?: (shiftId: string) => void;
  onRepost?: (shiftId: string, bonusAmount: number | null) => void;
  onDelete?: (shiftId: string) => void;
  onUnassign?: (shiftId: string, sendNotification: boolean) => void;
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
  onEdit,
  onRepost,
  onDelete,
  onUnassign,
}: ShiftDetailModalProps) {
  const [sendNotification, setSendNotification] = useState(true);
  const [showRepostDialog, setShowRepostDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUnassignDialog, setShowUnassignDialog] = useState(false);
  const [unassignNotify, setUnassignNotify] = useState(true);
  const [bonusAmount, setBonusAmount] = useState<string>(shift.bonusAmount?.toString() || "");
  const config = statusConfig[shift.status];
  const displayAreaName = shift.area?.name || shift.areaName || "Unassigned";

  const { data: positions = [] } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
  });
  
  const handleRepost = () => {
    // Parse bonus amount - ensure valid number or null
    let bonus: number | null = null;
    if (bonusAmount && bonusAmount.trim() !== "") {
      const parsed = parseInt(bonusAmount, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        bonus = parsed;
      }
    }
    onRepost?.(shift.id, bonus);
    setShowRepostDialog(false);
  };
  
  const handleDelete = () => {
    onDelete?.(shift.id);
    setShowDeleteDialog(false);
    onOpenChange(false);
  };

  const sortedInterestedEmployees = useMemo(() => {
    return [...shift.interestedEmployees].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }, [shift.interestedEmployees]);

  const formatInterestTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return format(date, "MMM d, yyyy 'at' h:mm a");
    } catch {
      return timestamp;
    }
  };

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Location</p>
                <p className="text-sm text-muted-foreground">{shift.location}</p>
              </div>
            </div>
            {shift.bonusAmount && shift.bonusAmount > 0 && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm font-medium">Bonus</p>
                  <p className="text-sm text-green-600 dark:text-green-400 font-semibold">${shift.bonusAmount}</p>
                </div>
              </div>
            )}
          </div>

          {shift.requirements && (
            <div>
              <p className="text-sm font-medium mb-1">Requirements</p>
              <p className="text-sm text-muted-foreground">{shift.requirements}</p>
            </div>
          )}

          <Separator />

          {/* Assigned Employee Section - shown for claimed shifts */}
          {shift.assignedEmployee && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm font-medium">Assigned Employee</p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200">
                        {shift.assignedEmployee.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{shift.assignedEmployee.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {positions.find(p => p.id === shift.assignedEmployee?.positionId)?.title || "Unknown Position"}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onMessageEmployee?.(shift.assignedEmployee!.id)}
                        data-testid="button-message-assigned"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowUnassignDialog(true)}
                        className="text-destructive"
                        data-testid="button-unassign-shift"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Interested Employees Section - shown for available and claimed (non-expired) shifts */}
          {shift.status !== "expired" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4" />
                <p className="text-sm font-medium">Interested Employees ({shift.interestedEmployees.length})</p>
              </div>
              {sortedInterestedEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one has expressed interest yet.</p>
              ) : (
                <div className="space-y-2">
                  {sortedInterestedEmployees.map((emp, index) => (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                      data-testid={`interested-employee-${emp.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {emp.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          {index === 0 && (
                            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-medium">
                              1
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{emp.name}</p>
                          <p className="text-xs text-muted-foreground" data-testid={`timestamp-${emp.id}`}>
                            Responded: {formatInterestTimestamp(emp.timestamp)}
                          </p>
                        </div>
                      </div>
                      {isAdmin && shift.status === "available" && (
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
                      {isAdmin && shift.status === "claimed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onMessageEmployee?.(emp.id)}
                          data-testid={`button-message-${emp.id}`}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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

        <DialogFooter className="flex-wrap gap-2">
          {isAdmin && shift.status === "available" && (
            <div className="flex gap-2 mr-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit?.(shift.id)}
                data-testid="button-edit-shift"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRepostDialog(true)}
                data-testid="button-repost-shift"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Repost
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive"
                data-testid="button-delete-shift"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
          )}
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
      
      {/* Repost Dialog */}
      <AlertDialog open={showRepostDialog} onOpenChange={setShowRepostDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Repost Shift</AlertDialogTitle>
            <AlertDialogDescription>
              This will send SMS notifications to all eligible employees for this shift.
              You can optionally add a bonus to make the shift more attractive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="bonus-amount" className="text-sm font-medium">
              Bonus Amount (optional)
            </Label>
            <div className="relative mt-2">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="bonus-amount"
                type="number"
                placeholder="0"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                className="pl-9"
                min="0"
                data-testid="input-bonus-amount"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Example: Enter 50 for a $50 bonus offer
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRepost} data-testid="button-confirm-repost">
              <RefreshCw className="h-4 w-4 mr-1" />
              Repost Shift
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Shift</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this shift? This action cannot be undone.
              {shift.interestedEmployees.length > 0 && (
                <span className="block mt-2 text-yellow-600 dark:text-yellow-400">
                  Note: {shift.interestedEmployees.length} employee(s) have expressed interest in this shift.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remove Shift
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unassign Confirmation Dialog */}
      <AlertDialog open={showUnassignDialog} onOpenChange={setShowUnassignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unassign Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unassign {shift.assignedEmployee?.name} from this shift?
              The shift will be marked as available again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notify-unassign" className="text-sm">
                Send SMS notification to employee
              </Label>
              <Switch
                id="notify-unassign"
                checked={unassignNotify}
                onCheckedChange={setUnassignNotify}
                data-testid="switch-notify-unassign"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                onUnassign?.(shift.id, unassignNotify);
                setShowUnassignDialog(false);
                onOpenChange(false);
              }}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-unassign"
            >
              <UserMinus className="h-4 w-4 mr-1" />
              Unassign Employee
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
