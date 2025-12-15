import { EmployeeCard } from "../EmployeeCard";

export default function EmployeeCardExample() {
  return (
    <div className="border rounded-lg">
      <EmployeeCard
        id="1"
        name="John Smith"
        role="supervisor"
        department="Emergency Department"
        phone="+1 (555) 123-4567"
        onSendSMS={(id) => console.log("Send SMS to:", id)}
        onViewProfile={(id) => console.log("View profile:", id)}
      />
      <EmployeeCard
        id="2"
        name="Emily Davis"
        role="employee"
        department="Pediatrics"
        phone="+1 (555) 234-5678"
        onSendSMS={(id) => console.log("Send SMS to:", id)}
        onViewProfile={(id) => console.log("View profile:", id)}
      />
    </div>
  );
}
