import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: string;
  isSent: boolean;
}

export interface MessageThreadProps {
  messages: Message[];
  currentUserId: string;
  recipientName: string;
  onSendMessage?: (content: string) => void;
}

export function MessageThread({
  messages,
  currentUserId,
  recipientName,
  onSendMessage,
}: MessageThreadProps) {
  const [newMessage, setNewMessage] = useState("");

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage?.(newMessage);
      setNewMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h3 className="font-medium" data-testid="text-recipient-name">{recipientName}</h3>
        <p className="text-sm text-muted-foreground">SMS Conversation</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="container-messages">
        {messages.map((message) => {
          const isMine = message.senderId === currentUserId;
          const initials = message.senderName.split(' ').map(n => n[0]).join('');
          
          return (
            <div
              key={message.id}
              className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}
              data-testid={`message-${message.id}`}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className={`max-w-[70%] ${isMine ? 'text-right' : ''}`}>
                <div
                  className={`rounded-lg p-3 ${
                    isMine
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{message.timestamp}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t p-4">
        <div className="flex items-end gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="resize-none min-h-[44px]"
            rows={1}
            data-testid="input-message"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim()}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
