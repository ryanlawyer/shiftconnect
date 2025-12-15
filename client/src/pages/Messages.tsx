import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageThread, type Message } from "@/components/MessageThread";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface Conversation {
  id: string;
  contactName: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
}

// todo: remove mock functionality
const mockConversations: Conversation[] = [
  { id: "1", contactName: "John Smith", lastMessage: "Thanks for assigning me the shift!", timestamp: "10:30 AM", unread: true },
  { id: "2", contactName: "Emily Davis", lastMessage: "I'm interested in the morning shift", timestamp: "Yesterday", unread: true },
  { id: "3", contactName: "Michael Brown", lastMessage: "Confirmed for training tomorrow", timestamp: "Yesterday", unread: false },
  { id: "4", contactName: "Lisa Chen", lastMessage: "Can you cover my shift on Friday?", timestamp: "2 days ago", unread: false },
  { id: "5", contactName: "David Wilson", lastMessage: "I'll be there at 7 AM", timestamp: "3 days ago", unread: false },
];

// todo: remove mock functionality
const mockMessages: Record<string, Message[]> = {
  "1": [
    { id: "m1", content: "Hi John, I saw you're interested in the ED shift tomorrow.", senderId: "admin", senderName: "You", timestamp: "10:25 AM", isSent: true },
    { id: "m2", content: "Yes, I'd love to pick it up!", senderId: "1", senderName: "John Smith", timestamp: "10:28 AM", isSent: true },
    { id: "m3", content: "Great, I've assigned it to you. You'll receive a confirmation.", senderId: "admin", senderName: "You", timestamp: "10:29 AM", isSent: true },
    { id: "m4", content: "Thanks for assigning me the shift!", senderId: "1", senderName: "John Smith", timestamp: "10:30 AM", isSent: true },
  ],
  "2": [
    { id: "m1", content: "Hi Emily, we have a morning shift available on Dec 20th.", senderId: "admin", senderName: "You", timestamp: "9:00 AM", isSent: true },
    { id: "m2", content: "I'm interested in the morning shift", senderId: "2", senderName: "Emily Davis", timestamp: "9:15 AM", isSent: true },
  ],
  "3": [
    { id: "m1", content: "Reminder: CPR training is scheduled for tomorrow at 9 AM.", senderId: "admin", senderName: "You", timestamp: "3:00 PM", isSent: true },
    { id: "m2", content: "Confirmed for training tomorrow", senderId: "3", senderName: "Michael Brown", timestamp: "3:30 PM", isSent: true },
  ],
  "4": [
    { id: "m1", content: "Hi, can you cover my shift on Friday?", senderId: "4", senderName: "Lisa Chen", timestamp: "2:00 PM", isSent: true },
    { id: "m2", content: "Let me check my schedule and get back to you.", senderId: "admin", senderName: "You", timestamp: "2:15 PM", isSent: true },
  ],
  "5": [
    { id: "m1", content: "Your shift starts at 7 AM tomorrow in the Lab.", senderId: "admin", senderName: "You", timestamp: "5:00 PM", isSent: true },
    { id: "m2", content: "I'll be there at 7 AM", senderId: "5", senderName: "David Wilson", timestamp: "5:10 PM", isSent: true },
  ],
};

export default function Messages() {
  const [search, setSearch] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<string | null>("1");
  const [conversations, setConversations] = useState(mockConversations);
  const [messages, setMessages] = useState(mockMessages);

  const filteredConversations = conversations.filter((conv) =>
    conv.contactName.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectConversation = (id: string) => {
    setSelectedConversation(id);
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, unread: false } : c)
    );
  };

  const handleSendMessage = (content: string) => {
    if (!selectedConversation) return;
    
    const newMessage: Message = {
      id: `m${Date.now()}`,
      content,
      senderId: "admin",
      senderName: "You",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSent: true,
    };

    setMessages(prev => ({
      ...prev,
      [selectedConversation]: [...(prev[selectedConversation] || []), newMessage],
    }));

    setConversations(prev =>
      prev.map(c =>
        c.id === selectedConversation
          ? { ...c, lastMessage: content, timestamp: "Just now" }
          : c
      )
    );
  };

  const selectedContact = conversations.find(c => c.id === selectedConversation);
  const currentMessages = selectedConversation ? messages[selectedConversation] || [] : [];

  return (
    <div className="flex h-full" data-testid="page-messages">
      <Card className="w-80 flex-shrink-0 rounded-none border-r border-l-0 border-t-0 border-b-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Messages</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-messages"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredConversations.map((conv) => {
              const initials = conv.contactName.split(' ').map(n => n[0]).join('');
              return (
                <div
                  key={conv.id}
                  className={`p-4 cursor-pointer hover-elevate ${selectedConversation === conv.id ? 'bg-muted' : ''}`}
                  onClick={() => handleSelectConversation(conv.id)}
                  data-testid={`conversation-${conv.id}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{conv.contactName}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{conv.timestamp}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                        {conv.unread && (
                          <Badge className="h-2 w-2 p-0 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex-1">
        {selectedContact ? (
          <MessageThread
            messages={currentMessages}
            currentUserId="admin"
            recipientName={selectedContact.contactName}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Select a conversation to start messaging
          </div>
        )}
      </div>
    </div>
  );
}
