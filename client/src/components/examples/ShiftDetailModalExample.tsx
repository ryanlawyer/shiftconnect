import { useState } from "react";
import { ShiftDetailModal } from "../ShiftDetailModal";
import { Button } from "@/components/ui/button";

const mockShift = {
  id: "1",
  position: "Registered Nurse",
  areaName: "Emergency Department",
  location: "Building A, Floor 2, Station 5",
  date: "Dec 18, 2025",
  startTime: "07:00",
  endTime: "19:00",
  requirements: "BLS certification required. Previous ED experience preferred.",
  postedBy: "Sarah Johnson",
  status: "available" as const,
  interestedEmployees: [
    { id: "1", name: "John Smith", timestamp: "2 hours ago" },
    { id: "2", name: "Emily Davis", timestamp: "1 hour ago" },
    { id: "3", name: "Michael Brown", timestamp: "30 minutes ago" },
  ],
};

export default function ShiftDetailModalExample() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Shift Details</Button>
      <ShiftDetailModal
        open={open}
        onOpenChange={setOpen}
        shift={mockShift}
        isAdmin={true}
        onShowInterest={(id) => console.log("Show interest:", id)}
        onAssign={(shiftId, empId) => console.log("Assign:", shiftId, empId)}
        onMessageEmployee={(id) => console.log("Message employee:", id)}
      />
    </>
  );
}
