import { useState } from "react";
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
import { Plus, Search, Filter } from "lucide-react";
import { Link } from "wouter";

// todo: remove mock functionality
const mockShifts: ShiftCardProps[] = [
  {
    id: "1",
    position: "Registered Nurse",
    department: "Emergency Department",
    location: "Building A, Floor 2",
    date: "Dec 18, 2025",
    startTime: "07:00",
    endTime: "19:00",
    requirements: "BLS certification required",
    postedBy: "Sarah Johnson",
    postedAt: "2 hours ago",
    status: "available",
    interestedCount: 3,
  },
  {
    id: "2",
    position: "CNA",
    department: "Intensive Care Unit",
    location: "Building B, Floor 3",
    date: "Dec 19, 2025",
    startTime: "15:00",
    endTime: "23:00",
    postedBy: "Mike Wilson",
    postedAt: "4 hours ago",
    status: "available",
    interestedCount: 1,
  },
  {
    id: "3",
    position: "Medical Technologist",
    department: "Laboratory",
    location: "Main Lab",
    date: "Dec 17, 2025",
    startTime: "08:00",
    endTime: "16:00",
    postedBy: "Sarah Johnson",
    postedAt: "Yesterday",
    status: "claimed",
    interestedCount: 5,
  },
  {
    id: "4",
    position: "LPN",
    department: "Pediatrics",
    location: "Children's Wing",
    date: "Dec 20, 2025",
    startTime: "07:00",
    endTime: "15:00",
    requirements: "Pediatric experience preferred",
    postedBy: "Lisa Chen",
    postedAt: "5 hours ago",
    status: "available",
    interestedCount: 0,
  },
  {
    id: "5",
    position: "Respiratory Therapist",
    department: "Intensive Care Unit",
    location: "Building B, Floor 3",
    date: "Dec 16, 2025",
    startTime: "19:00",
    endTime: "07:00",
    postedBy: "Mike Wilson",
    postedAt: "3 days ago",
    status: "expired",
    interestedCount: 2,
  },
  {
    id: "6",
    position: "Radiology Technician",
    department: "Radiology",
    location: "Imaging Center",
    date: "Dec 21, 2025",
    startTime: "08:00",
    endTime: "16:00",
    postedBy: "Sarah Johnson",
    postedAt: "1 hour ago",
    status: "available",
    interestedCount: 0,
  },
];

const departments = ["All Departments", "Emergency Department", "Intensive Care Unit", "Pediatrics", "Radiology", "Laboratory"];
const statuses = ["All Status", "Available", "Claimed", "Expired"];

export default function Shifts() {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All Departments");
  const [status, setStatus] = useState("All Status");
  const [selectedShift, setSelectedShift] = useState<typeof mockShifts[0] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filteredShifts = mockShifts.filter((shift) => {
    const matchesSearch = shift.position.toLowerCase().includes(search.toLowerCase()) ||
                          shift.department.toLowerCase().includes(search.toLowerCase());
    const matchesDept = department === "All Departments" || shift.department === department;
    const matchesStatus = status === "All Status" || shift.status === status.toLowerCase();
    return matchesSearch && matchesDept && matchesStatus;
  });

  const handleViewDetails = (id: string) => {
    const shift = mockShifts.find(s => s.id === id);
    if (shift) {
      setSelectedShift(shift);
      setModalOpen(true);
    }
  };

  const handleShowInterest = (id: string) => {
    console.log("Show interest in shift:", id);
  };

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
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-[200px]" data-testid="select-department-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {departments.map((dept) => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
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

      {filteredShifts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No shifts found matching your criteria.</p>
        </div>
      )}

      {selectedShift && (
        <ShiftDetailModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          shift={{
            ...selectedShift,
            interestedEmployees: [
              { id: "1", name: "John Smith", timestamp: "2 hours ago" },
              { id: "2", name: "Emily Davis", timestamp: "1 hour ago" },
            ],
          }}
          isAdmin={true}
          onShowInterest={handleShowInterest}
          onAssign={(shiftId, empId) => {
            console.log("Assign:", shiftId, empId);
            setModalOpen(false);
          }}
          onMessageEmployee={(id) => console.log("Message:", id)}
        />
      )}
    </div>
  );
}
