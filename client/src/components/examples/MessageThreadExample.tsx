import { MessageThread, type Message } from "../MessageThread";

const mockMessages: Message[] = [
  {
    id: "1",
    content: "Hi! I saw the open shift for tomorrow morning. Are you interested?",
    senderId: "admin1",
    senderName: "Sarah Johnson",
    timestamp: "10:30 AM",
    isSent: true,
  },
  {
    id: "2",
    content: "Yes, I'd love to pick it up! What time does it start?",
    senderId: "emp1",
    senderName: "John Smith",
    timestamp: "10:32 AM",
    isSent: true,
  },
  {
    id: "3",
    content: "Great! It's 7 AM to 3 PM in the Emergency Department. I'll assign it to you now.",
    senderId: "admin1",
    senderName: "Sarah Johnson",
    timestamp: "10:33 AM",
    isSent: true,
  },
];

export default function MessageThreadExample() {
  return (
    <div className="h-[400px] border rounded-lg">
      <MessageThread
        messages={mockMessages}
        currentUserId="admin1"
        recipientName="John Smith"
        onSendMessage={(content) => console.log("Send message:", content)}
      />
    </div>
  );
}
