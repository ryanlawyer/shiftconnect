import { useState } from "react";
import { SMSComposePanel, type Recipient } from "../SMSComposePanel";

const initialRecipients: Recipient[] = [
  { id: "1", name: "John Smith", phone: "+1 555-123-4567" },
  { id: "2", name: "Emily Davis", phone: "+1 555-234-5678" },
  { id: "3", name: "Michael Brown", phone: "+1 555-345-6789" },
];

export default function SMSComposePanelExample() {
  const [recipients, setRecipients] = useState(initialRecipients);

  return (
    <SMSComposePanel
      recipients={recipients}
      onRemoveRecipient={(id) => setRecipients(recipients.filter(r => r.id !== id))}
      onSend={(message) => console.log("Send SMS:", message, "to", recipients)}
      onCancel={() => console.log("Cancel SMS")}
    />
  );
}
