import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShiftCard, type ShiftCardProps } from "@/components/ShiftCard";
import { ShiftDetailModal } from "@/components/ShiftDetailModal";
import { BulkActionToolbar } from "@/components/BulkActionToolbar";
import { WeekGridView } from "@/components/WeekGridView";
import { Plus, Search, Filter, Loader2, Calendar, RefreshCw, List, CalendarDays } from "lucide-react";
import { Link, useLocation } from "wouter";
import { startOfWeek, addWeeks, format, isSameDay } from "date-fns";
import { transformShiftsToCards, type ShiftWithDetails } from "@/lib/shiftUtils";
import type { Area, Employee } from "@shared/schema";
import type { InterestedEmployee } from "@/components/ShiftDetailModal";

const statuses = ["All Status", "Available", "Claimed", "Expired"];

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
  bonusAmount: number | null;
  createdAt: string;
  area: Area | null;
  assignedEmployee: Employee | null;
  interestedEmployees: InterestedEmployee[];
}

export default function Shifts() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Fetch shifts and areas data
  const { data: shifts = [], isLoading: loadingShifts } = useQuery<ShiftWithDetails[]>({
    queryKey: ["/api/shifts"],
  });

  const { data: areas = [], isLoading: loadingAreas } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
  });

  // Fetch detailed shift data when a shift is selected
  const { data: shiftDetail } = useQuery<ShiftDetailResponse>({
    queryKey: ["/api/shifts", selectedShiftId],
    enabled: !!selectedShiftId && modalOpen,
  });

  const isLoading = loadingShifts || loadingAreas;

  // Transform shifts to ShiftCardProps format using shared utility
  const transformedShifts = useMemo(() => {
    return transformShiftsToCards(shifts);
  }, [shifts]);

  // Filter shifts based on search, area, status, and date
  const filteredShifts = useMemo(() => {
    return transformedShifts.filter((shift) => {
      const areaName = shift.areaName || "";
      const matchesSearch = shift.position.toLowerCase().includes(search.toLowerCase()) ||
                            areaName.toLowerCase().includes(search.toLowerCase());
      const matchesArea = areaFilter === "all" || shift.area?.id === areaFilter;
      const matchesStatus = statusFilter === "All Status" || shift.status === statusFilter.toLowerCase();
      
      // Date filter when a day is selected in calendar view
      let matchesDate = true;
      if (selectedDate) {
        const shiftDateStr = shift.date;
        const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
        if (shiftDateStr.includes("-")) {
          matchesDate = shiftDateStr === selectedDateStr;
        } else {
          try {
            matchesDate = isSameDay(new Date(shiftDateStr), selectedDate);
          } catch {
            matchesDate = false;
          }
        }
      }
      
      return matchesSearch && matchesArea && matchesStatus && matchesDate;
    });
  }, [transformedShifts, search, areaFilter, statusFilter, selectedDate]);

  const handleWeekChange = (direction: "prev" | "next") => {
    setWeekStart(prev => addWeeks(prev, direction === "next" ? 1 : -1));
  };

  const handleDateSelect = (date: Date) => {
    if (selectedDate && isSameDay(selectedDate, date)) {
      setSelectedDate(null); // Toggle off if clicking the same date
    } else {
      setSelectedDate(date);
    }
  };

  const handleViewDetails = (id: string) => {
    setSelectedShiftId(id);
    setModalOpen(true);
  };

  const handleShowInterest = (id: string) => {
    console.log("Show interest in shift:", id);
  };

  const [notifyingShiftId, setNotifyingShiftId] = useState<string | null>(null);

  const { toast } = useToast();

  // Notify mutation for quick notify action
  const notifyMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const response = await apiRequest("POST", `/api/shifts/${shiftId}/notify`);
      return response.json();
    },
    onSuccess: (data: { notificationCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Notifications Sent",
        description: data.notificationCount > 0
          ? `Sent notifications to ${data.notificationCount} eligible employees.`
          : "No eligible employees found to notify.",
      });
      setNotifyingShiftId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Notification Failed",
        description: error.message || "Failed to send notifications. Please try again.",
        variant: "destructive",
      });
      setNotifyingShiftId(null);
    },
  });

  const handleNotify = (shiftId: string) => {
    setNotifyingShiftId(shiftId);
    notifyMutation.mutate(shiftId);
  };

  const handleQuickAssign = (shiftId: string) => {
    setSelectedShiftId(shiftId);
    setModalOpen(true);
  };

  const handleClone = (shiftId: string) => {
    const shift = transformedShifts.find(s => s.id === shiftId);
    if (!shift) return;
    
    const params = new URLSearchParams();
    if (shift.positionId) params.set("positionId", shift.positionId);
    if (shift.areaId) params.set("areaId", shift.areaId);
    if (shift.location) params.set("location", shift.location);
    if (shift.startTime) params.set("startTime", shift.startTime);
    if (shift.endTime) params.set("endTime", shift.endTime);
    if (shift.requirements) params.set("requirements", shift.requirements);
    if (shift.bonusAmount) params.set("bonusAmount", String(shift.bonusAmount));
    
    setLocation(`/shifts/new?${params.toString()}`);
  };

  const assignMutation = useMutation({
    mutationFn: async ({ shiftId, employeeId, sendNotification }: { shiftId: string; employeeId: string; sendNotification: boolean }) => {
      console.log("Assigning shift:", { shiftId, employeeId, sendNotification });
      const response = await apiRequest("POST", `/api/shifts/${shiftId}/assign`, {
        employeeId,
        sendNotification,
      });
      const data = await response.json();
      console.log("Assignment response:", data);
      return data;
    },
    onSuccess: (data) => {
      console.log("Assignment success:", data);
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
      console.error("Assignment error:", error);
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign shift. Please try again.",
        variant: "destructive",
      });
    },
  });

  const repostMutation = useMutation({
    mutationFn: async ({ shiftId, bonusAmount }: { shiftId: string; bonusAmount: number | null }) => {
      const response = await apiRequest("POST", `/api/shifts/${shiftId}/repost`, {
        bonusAmount,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts", selectedShiftId] });
      toast({
        title: "Shift Reposted",
        description: `Notifications sent to ${data.notificationCount || 0} eligible employee(s).${data.bonusAmount ? ` Bonus: $${data.bonusAmount}` : ""}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Repost Failed",
        description: error.message || "Failed to repost shift. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      await apiRequest("DELETE", `/api/shifts/${shiftId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Shift Removed",
        description: "The shift has been successfully removed.",
      });
      setModalOpen(false);
      setSelectedShiftId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete shift",
        variant: "destructive",
      });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async ({ shiftId, sendNotification }: { shiftId: string; sendNotification: boolean }) => {
      const response = await apiRequest("POST", `/api/shifts/${shiftId}/unassign`, {
        sendNotification,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts", selectedShiftId] });
      toast({
        title: "Employee Unassigned",
        description: "The employee has been unassigned and the shift is now available.",
      });
      setModalOpen(false);
      setSelectedShiftId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Unassign Failed",
        description: error.message || "Failed to unassign employee. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAssign = (shiftId: string, employeeId: string, sendNotification: boolean) => {
    assignMutation.mutate({ shiftId, employeeId, sendNotification });
  };
  
  const handleRepost = (shiftId: string, bonusAmount: number | null) => {
    repostMutation.mutate({ shiftId, bonusAmount });
  };
  
  const handleDelete = (shiftId: string) => {
    deleteMutation.mutate(shiftId);
  };
  
  const handleUnassign = (shiftId: string, sendNotification: boolean) => {
    unassignMutation.mutate({ shiftId, sendNotification });
  };
  
  const handleEdit = (shiftId: string) => {
    setLocation(`/shifts/${shiftId}/edit`);
  };

  const handleSelectionChange = (id: string, selected: boolean) => {
    setSelectedShiftIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedShiftIds(new Set(filteredShifts.map(s => s.id)));
  };

  const handleDeselectAll = () => {
    setSelectedShiftIds(new Set());
  };

  const bulkCancelMutation = useMutation({
    mutationFn: async (shiftIds: string[]) => {
      const response = await apiRequest("POST", "/api/shifts/bulk/cancel", { shiftIds });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Shifts Cancelled",
        description: `${data.successCount} shift(s) cancelled successfully.${data.failedCount > 0 ? ` ${data.failedCount} failed.` : ""}`,
      });
      setSelectedShiftIds(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Cancel Failed",
        description: error.message || "Failed to cancel shifts.",
        variant: "destructive",
      });
    },
  });

  const bulkRepostMutation = useMutation({
    mutationFn: async (shiftIds: string[]) => {
      const response = await apiRequest("POST", "/api/shifts/bulk/repost", { shiftIds });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Shifts Reposted",
        description: `${data.successCount} shift(s) reposted. ${data.totalNotifications} notification(s) sent.`,
      });
      setSelectedShiftIds(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Repost Failed",
        description: error.message || "Failed to repost shifts.",
        variant: "destructive",
      });
    },
  });

  const bulkNotifyMutation = useMutation({
    mutationFn: async (shiftIds: string[]) => {
      const response = await apiRequest("POST", "/api/shifts/bulk/notify", { shiftIds });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Notifications Sent",
        description: `Sent notifications for ${data.successCount} shift(s). ${data.totalNotifications} employee(s) notified.`,
      });
      setSelectedShiftIds(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Notify Failed",
        description: error.message || "Failed to send notifications.",
        variant: "destructive",
      });
    },
  });

  const handleBulkCancel = () => {
    bulkCancelMutation.mutate(Array.from(selectedShiftIds));
  };

  const handleBulkRepost = () => {
    bulkRepostMutation.mutate(Array.from(selectedShiftIds));
  };

  const handleBulkNotify = () => {
    bulkNotifyMutation.mutate(Array.from(selectedShiftIds));
  };

  const isBulkLoading = bulkCancelMutation.isPending || bulkRepostMutation.isPending || bulkNotifyMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-shifts">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-shifts">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Open Shifts</h1>
          <p className="text-muted-foreground">Browse and claim available shifts</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setViewMode("list");
                setSelectedDate(null); // Clear date filter when switching to list view
              }}
              className="rounded-r-none"
              data-testid="button-view-list"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="rounded-l-none"
              data-testid="button-view-calendar"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
          </div>
          <Link href="/shifts/new">
            <Button data-testid="button-new-shift">
              <Plus className="h-4 w-4 mr-2" />
              Post New Shift
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search shifts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-shifts"
          />
        </div>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-area-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Areas</SelectItem>
            {areas.map((area) => (
              <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedShiftIds.size > 0 && (
        <BulkActionToolbar
          selectedCount={selectedShiftIds.size}
          totalCount={filteredShifts.length}
          onCancelSelected={handleBulkCancel}
          onRepostSelected={handleBulkRepost}
          onNotifySelected={handleBulkNotify}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          isLoading={isBulkLoading}
        />
      )}

      {viewMode === "calendar" && (
        <WeekGridView
          shifts={transformedShifts}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          weekStart={weekStart}
          onWeekChange={handleWeekChange}
        />
      )}

      {selectedDate && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Showing shifts for {format(selectedDate, "EEEE, MMMM d, yyyy")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDate(null)}
            data-testid="button-clear-date-filter"
          >
            Clear
          </Button>
        </div>
      )}

      {filteredShifts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              {...shift}
              onShowInterest={handleShowInterest}
              onViewDetails={handleViewDetails}
              onNotify={handleNotify}
              onClone={handleClone}
              onQuickAssign={handleQuickAssign}
              isAdmin={true}
              isNotifying={notifyingShiftId === shift.id}
              showCheckbox={true}
              isSelected={selectedShiftIds.has(shift.id)}
              onSelectionChange={handleSelectionChange}
            />
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No shifts available</h3>
          <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
            There are no open shifts at the moment. Check back later or post a new shift to get started.
          </p>
          <Link href="/shifts/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Post New Shift
            </Button>
          </Link>
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No matching shifts</h3>
          <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
            No shifts match your current filters. Try adjusting your search criteria or clearing filters.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setAreaFilter("all");
              setStatusFilter("All Status");
            }}
          >
            Clear All Filters
          </Button>
        </div>
      )}

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
            bonusAmount: shiftDetail.bonusAmount,
          }}
          isAdmin={true}
          onShowInterest={handleShowInterest}
          onAssign={handleAssign}
          onMessageEmployee={(id) => console.log("Message:", id)}
          onEdit={handleEdit}
          onRepost={handleRepost}
          onDelete={handleDelete}
          onUnassign={handleUnassign}
        />
      )}
    </div>
  );
}
