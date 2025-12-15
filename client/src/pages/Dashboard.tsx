import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DashboardStats, type StatCardProps } from "@/components/DashboardStats";
import { ShiftCard, type ShiftCardProps } from "@/components/ShiftCard";
import { ShiftDetailModal } from "@/components/ShiftDetailModal";
import { Calendar, Users, MessageSquare, Clock, Plus } from "lucide-react";
import { Link } from "wouter";

// todo: remove mock functionality
const mockStats: StatCardProps[] = [
  { title: "Open Shifts", value: 12, change: 8, changeLabel: "from last week", icon: Calendar },
  { title: "Active Employees", value: 48, change: 2, changeLabel: "new this month", icon: Users },
  { title: "SMS Sent Today", value: 156, change: -5, changeLabel: "from yesterday", icon: MessageSquare },
  { title: "Shifts Filled", value: "85%", change: 12, changeLabel: "improvement", icon: Clock },
];

// todo: remove mock functionality
const mockRecentShifts: ShiftCardProps[] = [
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
];

export default function Dashboard() {
  const [selectedShift, setSelectedShift] = useState<typeof mockRecentShifts[0] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleViewDetails = (id: string) => {
    const shift = mockRecentShifts.find(s => s.id === id);
    if (shift) {
      setSelectedShift(shift);
      setModalOpen(true);
    }
  };

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

      <DashboardStats stats={mockStats} />

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-medium">Recent Shifts</h2>
          <Link href="/shifts">
            <Button variant="ghost" data-testid="link-view-all-shifts">View All</Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockRecentShifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              {...shift}
              isAdmin={true}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      </div>

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
