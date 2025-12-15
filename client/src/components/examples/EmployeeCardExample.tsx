import { EmployeeCard } from "../EmployeeCard";

export default function EmployeeCardExample() {
  return (
    <div className="border rounded-lg">
      <EmployeeCard
        id="1"
        name="John Smith"
        role="supervisor"
        position="Supervisor"
        phone="+1 (555) 123-4567"
        areas={[{ id: "area-1", name: "Emergency Department", description: null, smsEnabled: true }]}
        onSendSMS={(id) => console.log("Send SMS to:", id)}
        onViewProfile={(id) => console.log("View profile:", id)}
      />
      <EmployeeCard
        id="2"
        name="Emily Davis"
        role="employee"
        position="CNA"
        phone="+1 (555) 234-5678"
        areas={[{ id: "area-2", name: "Pediatrics", description: null, smsEnabled: true }]}
        onSendSMS={(id) => console.log("Send SMS to:", id)}
        onViewProfile={(id) => console.log("View profile:", id)}
      />
    </div>
  );
}
