import { ShiftCard } from "../ShiftCard";

export default function ShiftCardExample() {
  return (
    <ShiftCard
      id="1"
      position="Registered Nurse"
      department="Emergency Department"
      location="Building A, Floor 2"
      date="Dec 18, 2025"
      startTime="07:00"
      endTime="19:00"
      requirements="BLS certification required"
      postedBy="Sarah Johnson"
      postedAt="2 hours ago"
      status="available"
      interestedCount={3}
      onShowInterest={(id) => console.log("Show interest:", id)}
      onViewDetails={(id) => console.log("View details:", id)}
    />
  );
}
