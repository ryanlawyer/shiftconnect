import { TrainingCard } from "../TrainingCard";

export default function TrainingCardExample() {
  return (
    <TrainingCard
      id="1"
      title="CPR Recertification"
      description="Annual CPR and basic life support recertification course. All clinical staff must complete this training."
      date="Dec 20, 2025"
      time="09:00 AM"
      duration="4 hours"
      attendees={18}
      maxAttendees={25}
      isRequired={true}
      onNotify={(id) => console.log("Notify for training:", id)}
      onViewDetails={(id) => console.log("View training details:", id)}
    />
  );
}
