import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrainingCard, type TrainingCardProps } from "@/components/TrainingCard";
import { Plus, Search } from "lucide-react";

// todo: remove mock functionality
const mockTrainings: TrainingCardProps[] = [
  {
    id: "1",
    title: "CPR Recertification",
    description: "Annual CPR and basic life support recertification course. All clinical staff must complete this training.",
    date: "Dec 20, 2025",
    time: "09:00 AM",
    duration: "4 hours",
    attendees: 18,
    maxAttendees: 25,
    isRequired: true,
  },
  {
    id: "2",
    title: "HIPAA Compliance Update",
    description: "Annual HIPAA compliance training covering patient privacy regulations and best practices.",
    date: "Dec 22, 2025",
    time: "02:00 PM",
    duration: "2 hours",
    attendees: 42,
    maxAttendees: 50,
    isRequired: true,
  },
  {
    id: "3",
    title: "New EMR System Training",
    description: "Introduction to the new electronic medical records system. Hands-on training session.",
    date: "Jan 5, 2026",
    time: "10:00 AM",
    duration: "3 hours",
    attendees: 8,
    maxAttendees: 30,
    isRequired: false,
  },
  {
    id: "4",
    title: "Workplace Safety Refresher",
    description: "Review of workplace safety protocols including fire safety, hazard identification, and emergency procedures.",
    date: "Jan 10, 2026",
    time: "01:00 PM",
    duration: "2 hours",
    attendees: 15,
    maxAttendees: 40,
    isRequired: false,
  },
  {
    id: "5",
    title: "Customer Service Excellence",
    description: "Improve patient interaction skills and learn techniques for handling difficult situations.",
    date: "Jan 15, 2026",
    time: "09:00 AM",
    duration: "3 hours",
    attendees: 25,
    maxAttendees: 25,
    isRequired: false,
  },
];

export default function Training() {
  const [search, setSearch] = useState("");

  const filteredTrainings = mockTrainings.filter((training) =>
    training.title.toLowerCase().includes(search.toLowerCase()) ||
    training.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6" data-testid="page-training">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Training</h1>
          <p className="text-muted-foreground">Upcoming training sessions and certifications</p>
        </div>
        <Button data-testid="button-new-training">
          <Plus className="h-4 w-4 mr-2" />
          Schedule Training
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search training sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-training"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTrainings.map((training) => (
          <TrainingCard
            key={training.id}
            {...training}
            onNotify={(id) => console.log("Send reminder for training:", id)}
            onViewDetails={(id) => console.log("View training details:", id)}
          />
        ))}
      </div>

      {filteredTrainings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No training sessions found.</p>
        </div>
      )}
    </div>
  );
}
