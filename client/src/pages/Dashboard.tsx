import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { DashboardStats, type StatCardProps } from "@/components/DashboardStats";
import { ShiftCard } from "@/components/ShiftCard";
import { ShiftDetailModal, type InterestedEmployee } from "@/components/ShiftDetailModal";
import { Calendar, Users, MessageSquare, Clock, Plus, Loader2, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { calculateDashboardStats } from "@/lib/dashboardStats";
import { transformShiftsToCards, type ShiftWithDetails } from "@/lib/shiftUtils";
import type { Employee, Area, OrganizationSetting } from "@shared/schema";

// Type for the detailed shift response from /api/shifts/:id
interface ShiftDetailResponse {
  id: string;
  position: string;
  areaId: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  requirements: string | null;
  postedById: string | null;
  postedByName: string;
  status: "available" | "claimed" | "expired";
  assignedEmployeeId: string | null;
  createdAt: string;
  area: Area | null;
  assignedEmployee: Employee | null;
  interestedEmployees: InterestedEmployee[];
}


export default function Dashboard() {
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch organization settings for urgency threshold
  const { data: settings = [] } = useQuery<OrganizationSetting[]>({
    queryKey: ["/api/settings"],
  });

  // Get urgency threshold from settings (default 48 hours)
  const urgentThresholdHours = useMemo(() => {
    const setting = settings.find(s => s.key === "urgent_shift_threshold_hours");
    return setting ? parseInt(setting.value, 10) : 48;
  }, [settings]);

  // Fetch shifts and employees data
  const { data: shifts = [], isLoading: loadingShifts } = useQuery<ShiftWithDetails[]>({
    queryKey: ["/api/shifts"],
  });

  const { data: employees = [], isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // Fetch detailed shift data when a shift is selected
  const { data: shiftDetail } = useQuery<ShiftDetailResponse>({
    queryKey: ["/api/shifts", selectedShiftId],
    enabled: !!selectedShiftId && modalOpen,
  });

  const isLoading = loadingShifts || loadingEmployees;

  const { toast } = useToast();

  const assignMutation = useMutation({
    mutationFn: async ({ shiftId, employeeId, sendNotification }: { shiftId: string; employeeId: string; sendNotification: boolean }) => {
      const response = await apiRequest("POST", `/api/shifts/${shiftId}/assign`, {
        employeeId,
        sendNotification,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts", selectedShiftId] });
      toast({
        title: "Shift Assigned",
        description: "The shift has been successfully assigned to the employee.",
      });
      setModalOpen(false);
      setSelectedShiftId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign shift. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAssign = (shiftId: string, employeeId: string, sendNotification: boolean) => {
    assignMutation.mutate({ shiftId, employeeId, sendNotification });
  };

  // Calculate dashboard stats from real data
  const dashboardStats = useMemo(() => {
    return calculateDashboardStats(shifts, employees);
  }, [shifts, employees]);

  // Transform stats to StatCardProps format
  // Convert null changes to undefined for the component
  const statsCards: StatCardProps[] = useMemo(() => [
    {
      title: "Open Shifts",
      value: dashboardStats.openShifts.value,
      change: dashboardStats.openShifts.change ?? undefined,
      changeLabel: "from last week",
      icon: Calendar,
    },
    {
      title: "Active Employees",
      value: dashboardStats.activeEmployees.value,
      change: dashboardStats.activeEmployees.change ?? undefined,
      changeLabel: "new this month",
      icon: Users,
    },
    {
      title: "SMS Sent Today",
      value: dashboardStats.smsSentToday.value,
      change: dashboardStats.smsSentToday.change ?? undefined,
      changeLabel: "from yesterday",
      icon: MessageSquare,
    },
    {
      title: "Shifts Filled",
      value: dashboardStats.shiftsFilled.value,
      change: dashboardStats.shiftsFilled.change ?? undefined,
      changeLabel: "from last week",
      icon: Clock,
    },
  ], [dashboardStats]);

  // Filter for urgent shifts (open shifts starting within threshold hours)
  const urgentShifts = useMemo(() => {
    const now = new Date();
    const thresholdMs = urgentThresholdHours * 60 * 60 * 1000;

    // Helper to parse date string and time into a Date object
    const parseShiftDateTime = (dateStr: string, timeStr: string): Date => {
      // Handle ISO format dates (YYYY-MM-DD) to avoid timezone issues
      // When parsing "2024-12-16" directly, JS treats it as UTC midnight which can shift days
      let year: number, month: number, day: number;
      
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        // ISO format: "2024-12-16"
        const [y, m, d] = dateStr.split("-").map(Number);
        year = y;
        month = m - 1; // JS months are 0-indexed
        day = d;
      } else {
        // Try parsing as human-readable format
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) {
          return new Date(NaN);
        }
        year = parsed.getFullYear();
        month = parsed.getMonth();
        day = parsed.getDate();
      }
      
      // Parse time (HH:MM format)
      const [hours, minutes] = timeStr.split(":").map(Number);
      
      // Create date in local timezone
      return new Date(year, month, day, hours, minutes, 0, 0);
    };

    const filtered = shifts.filter(shift => {
      // Only show available (unfilled) shifts
      if (shift.status !== "available") return false;

      // Parse shift date and start time
      const shiftDateTime = parseShiftDateTime(shift.date, shift.startTime);
      if (isNaN(shiftDateTime.getTime())) return false;

      const timeUntilShift = shiftDateTime.getTime() - now.getTime();

      // Include if shift is in the future and within threshold
      return timeUntilShift > 0 && timeUntilShift <= thresholdMs;
    });

    // Sort by soonest first
    filtered.sort((a, b) => {
      const dateA = parseShiftDateTime(a.date, a.startTime);
      const dateB = parseShiftDateTime(b.date, b.startTime);
      return dateA.getTime() - dateB.getTime();
    });

    return transformShiftsToCards(filtered);
  }, [shifts, urgentThresholdHours]);

  const handleViewDetails = (id: string) => {
    setSelectedShiftId(id);
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-dashboard">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8" data-testid="page-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your overview.</p>
        </div>
        <Link href="/shifts/new">
          <Button data-testid="button-new-shift">
            <Plus className="h-4 w-4 mr-2" />
            Post New Shift
          </Button>
        </Link>
      </div>

      <DashboardStats stats={statsCards} />

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-medium">Urgent Unfilled Shifts</h2>
            <span className="text-sm text-muted-foreground">(next {urgentThresholdHours}h)</span>
          </div>
          <Link href="/shifts">
            <Button variant="ghost" data-testid="link-view-all-shifts">View All Shifts</Button>
          </Link>
        </div>
        {urgentShifts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {urgentShifts.map((shift) => (
              <ShiftCard
                key={shift.id}
                {...shift}
                isAdmin={true}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg bg-green-50 dark:bg-green-950/20">
            <Calendar className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">No urgent shifts</h3>
            <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
              All shifts starting in the next {urgentThresholdHours} hours have been filled. Great job!
            </p>
            <Link href="/shifts">
              <Button variant="outline">
                View All Shifts
              </Button>
            </Link>
          </div>
        )}
      </div>

      {shiftDetail && (
        <ShiftDetailModal
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) setSelectedShiftId(null);
          }}
          shift={{
            id: shiftDetail.id,
            position: shiftDetail.position,
            area: shiftDetail.area,
            areaName: shiftDetail.area?.name,
            location: shiftDetail.location,
            date: shiftDetail.date,
            startTime: shiftDetail.startTime,
            endTime: shiftDetail.endTime,
            requirements: shiftDetail.requirements,
            postedBy: shiftDetail.postedByName,
            status: shiftDetail.status,
            interestedEmployees: shiftDetail.interestedEmployees,
            assignedEmployee: shiftDetail.assignedEmployee,
          }}
          isAdmin={true}
          onAssign={handleAssign}
          onMessageEmployee={(id) => console.log("Message:", id)}
        />
      )}
    </div>
  );
}
