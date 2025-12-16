import { useState, useMemo, useEffect } from "react";
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
import { Plus, Search, Filter, Loader2, Calendar, RefreshCw } from "lucide-react";
import { Link } from "wouter";
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
  createdAt: string;
  area: Area | null;
  assignedEmployee: Employee | null;
  interestedEmployees: InterestedEmployee[];
}

export default function Shifts() {
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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

  // Filter shifts based on search, area, and status
  const filteredShifts = useMemo(() => {
    return transformedShifts.filter((shift) => {
      const areaName = shift.areaName || "";
      const matchesSearch = shift.position.toLowerCase().includes(search.toLowerCase()) ||
                            areaName.toLowerCase().includes(search.toLowerCase());
      const matchesArea = areaFilter === "all" || shift.area?.id === areaFilter;
      const matchesStatus = statusFilter === "All Status" || shift.status === statusFilter.toLowerCase();
      return matchesSearch && matchesArea && matchesStatus;
    });
  }, [transformedShifts, search, areaFilter, statusFilter]);

  const handleViewDetails = (id: string) => {
    setSelectedShiftId(id);
    setModalOpen(true);
  };

  const handleShowInterest = (id: string) => {
    console.log("Show interest in shift:", id);
  };

  const { toast } = useToast();

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

  const handleAssign = (shiftId: string, employeeId: string, sendNotification: boolean) => {
    assignMutation.mutate({ shiftId, employeeId, sendNotification });
  };

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
        <Link href="/shifts/new">
          <Button data-testid="button-new-shift">
            <Plus className="h-4 w-4 mr-2" />
            Post New Shift
          </Button>
        </Link>
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

      {filteredShifts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              {...shift}
              onShowInterest={handleShowInterest}
              onViewDetails={handleViewDetails}
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
          }}
          isAdmin={true}
          onShowInterest={handleShowInterest}
          onAssign={handleAssign}
          onMessageEmployee={(id) => console.log("Message:", id)}
        />
      )}
    </div>
  );
}
