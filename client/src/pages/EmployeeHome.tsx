import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Clock, MapPin, AlertCircle, CheckCircle2, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions, PERMISSIONS } from "@/hooks/use-permissions";
import { format, parseISO, isAfter } from "date-fns";
import type { Shift, Area, Position } from "@shared/schema";

type ShiftWithDetails = Shift & {
  position?: { title: string };
  area?: { name: string };
  interests?: { employeeId: string; status: string }[];
};

export default function EmployeeHome() {
  const { user } = useAuth();
  const { areaIds, hasPermission } = usePermissions();

  const { data: shifts = [], isLoading: loadingShifts } = useQuery<ShiftWithDetails[]>({
    queryKey: ["/api/shifts"],
  });

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
  });

  const { data: positions = [] } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
  });

  // Filter shifts to only show open shifts in the employee's assigned areas
  const availableShifts = shifts.filter(shift => {
    // Only show open shifts
    if (shift.status !== "open") return false;
    
    // Only show shifts in the future
    const shiftDate = parseISO(shift.date);
    if (!isAfter(shiftDate, new Date())) return false;
    
    // Filter by user's assigned areas (if they have area restrictions)
    if (areaIds.length > 0 && shift.areaId) {
      return areaIds.includes(shift.areaId);
    }
    
    // If no area restrictions, show all
    return true;
  });

  // Check if user has expressed interest in a shift
  const hasExpressedInterest = (shift: ShiftWithDetails): boolean => {
    if (!user?.employeeId || !shift.interests) return false;
    return shift.interests.some(i => i.employeeId === user.employeeId);
  };

  const getPositionTitle = (positionId: string) => {
    const position = positions.find(p => p.id === positionId);
    return position?.title || "Unknown Position";
  };

  const getAreaName = (areaId: string | null) => {
    if (!areaId) return "Not Assigned";
    const area = areas.find(a => a.id === areaId);
    return area?.name || "Unknown Area";
  };

  const formatShiftTime = (startTime: string, endTime: string) => {
    return `${startTime} - ${endTime}`;
  };

  if (loadingShifts) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-welcome">
          Welcome back, {user?.employeeName || user?.username}
        </h1>
        <p className="text-muted-foreground">
          View available shifts and express interest
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Available Shifts
            </CardTitle>
            <Badge variant="secondary" data-testid="badge-shift-count">
              {availableShifts.length} open
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {availableShifts.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No available shifts</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                There are no open shifts available for your assigned areas right now. Check back later for new opportunities.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {availableShifts.map((shift) => {
                const interested = hasExpressedInterest(shift);
                return (
                  <div
                    key={shift.id}
                    className="flex items-start gap-4 p-4 rounded-lg border"
                    data-testid={`shift-card-${shift.id}`}
                  >
                    <div className="flex-shrink-0 w-16 text-center">
                      <div className="text-sm font-medium text-muted-foreground">
                        {format(parseISO(shift.date), "MMM")}
                      </div>
                      <div className="text-2xl font-bold">
                        {format(parseISO(shift.date), "d")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(parseISO(shift.date), "EEE")}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="font-medium" data-testid={`shift-position-${shift.id}`}>
                            {getPositionTitle(shift.positionId)}
                          </h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {formatShiftTime(shift.startTime, shift.endTime)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {shift.location || "TBD"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {shift.priority === "high" && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Urgent
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {getAreaName(shift.areaId)}
                        </Badge>
                        
                        {interested ? (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Interest Submitted
                          </Badge>
                        ) : (
                          hasPermission(PERMISSIONS.SHIFTS_INTEREST) && (
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-interest-${shift.id}`}
                            >
                              Express Interest
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
