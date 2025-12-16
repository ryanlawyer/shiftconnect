import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageThread, type Message } from "@/components/MessageThread";
import { Input } from "@/components/ui/input";
import { Search, Loader2, MessageSquare } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ConversationSummary {
  employeeId: string;
  employee: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    status: string;
    smsOptIn: boolean;
  };
  lastMessage: {
    id: string;
    content: string;
    direction: string;
    status: string;
    createdAt: string;
  };
  messageCount: number;
  unreadCount: number;
}

interface SMSMessage {
  id: string;
  employeeId: string;
  direction: string;
  content: string;
  status: string;
  twilioSid?: string;
  deliveryStatus?: string;
  messageType?: string;
  createdAt: string;
}

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export default function Messages() {
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [urlEmployeeId, setUrlEmployeeId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchString = useSearch();

  // Parse employee from URL query params (runs once on mount/URL change)
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const employeeId = params.get("employee");
    if (employeeId) {
      setUrlEmployeeId(employeeId);
      setSelectedEmployeeId(employeeId);
    }
  }, [searchString]);

  // Fetch all conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<ConversationSummary[]>({
    queryKey: ["/api/sms/conversations"],
  });

  // Fetch messages for selected conversation
  const { data: conversationData, isLoading: messagesLoading } = useQuery<{
    employee: ConversationSummary["employee"];
    messages: SMSMessage[];
  }>({
    queryKey: ["/api/sms/conversations", selectedEmployeeId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sms/conversations/${selectedEmployeeId}`);
      return res.json();
    },
    enabled: !!selectedEmployeeId,
  });

  // Fetch employee details if selected via URL but no conversation exists yet
  const { data: directEmployeeData } = useQuery<{
    id: string;
    name: string;
    phone: string;
    email?: string;
    status: string;
    smsOptIn: boolean;
  }>({
    queryKey: ["/api/employees", selectedEmployeeId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/employees/${selectedEmployeeId}`);
      return res.json();
    },
    enabled: !!selectedEmployeeId && !conversationData?.employee,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/sms/send", {
        employeeId: selectedEmployeeId,
        content: content,
        messageType: "general",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sms/conversations", selectedEmployeeId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      return apiRequest("POST", `/api/sms/conversations/${employeeId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms/conversations"] });
    },
  });

  // Auto-select first conversation when data loads (only if not already selected from URL)
  useEffect(() => {
    // Don't auto-select if we came from a URL with a specific employee
    if (urlEmployeeId) return;
    if (conversations.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(conversations[0].employeeId);
    }
  }, [conversations, selectedEmployeeId, urlEmployeeId]);

  // Mark as read when selecting a conversation
  const handleSelectConversation = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    const conv = conversations.find(c => c.employeeId === employeeId);
    if (conv && conv.unreadCount > 0) {
      markAsReadMutation.mutate(employeeId);
    }
  };

  const handleSendMessage = (content: string) => {
    if (!selectedEmployeeId) return;
    sendMessageMutation.mutate(content);
  };

  // Filter conversations by search
  const filteredConversations = conversations.filter((conv) =>
    conv.employee.name.toLowerCase().includes(search.toLowerCase()) ||
    conv.employee.phone.includes(search)
  );

  // Transform messages to MessageThread format
  const currentMessages: Message[] = (conversationData?.messages || []).map((msg) => ({
    id: msg.id,
    content: msg.content,
    senderId: msg.direction === "outbound" ? "admin" : msg.employeeId,
    senderName: msg.direction === "outbound" ? "You" : conversationData?.employee.name || "Employee",
    timestamp: formatTimestamp(msg.createdAt),
    isSent: msg.status === "sent" || msg.status === "delivered",
  }));

  const selectedEmployee = conversationData?.employee || conversations.find(c => c.employeeId === selectedEmployeeId)?.employee || directEmployeeData;

  // Loading state
  if (conversationsLoading) {
    return (
      <div className="flex h-full items-center justify-center" data-testid="page-messages">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state - but still show compose if employee selected via URL
  if (conversations.length === 0 && !urlEmployeeId) {
    return (
      <div className="flex h-full items-center justify-center" data-testid="page-messages">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No conversations yet</h3>
          <p className="text-muted-foreground mt-1">
            Send SMS notifications to employees to start conversations
          </p>
        </div>
      </div>
    );
  }

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
              const initials = conv.employee.name.split(' ').map(n => n[0]).join('');
              return (
                <div
                  key={conv.employeeId}
                  className={`p-4 cursor-pointer hover-elevate ${selectedEmployeeId === conv.employeeId ? 'bg-muted' : ''}`}
                  onClick={() => handleSelectConversation(conv.employeeId)}
                  data-testid={`conversation-${conv.employeeId}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{conv.employee.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatTimestamp(conv.lastMessage.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.lastMessage.direction === "outbound" ? "You: " : ""}
                          {conv.lastMessage.content}
                        </p>
                        {conv.unreadCount > 0 && (
                          <Badge className="h-5 min-w-[20px] p-0 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-xs">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{conv.employee.phone}</span>
                        {!conv.employee.smsOptIn && (
                          <Badge variant="secondary" className="text-xs h-4">
                            Opted out
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredConversations.length === 0 && (
              <div className="p-4 text-center text-muted-foreground">
                No conversations found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex-1">
        {selectedEmployee ? (
          <>
            {messagesLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <MessageThread
                messages={currentMessages}
                currentUserId="admin"
                recipientName={selectedEmployee.name}
                onSendMessage={handleSendMessage}
              />
            )}
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Select a conversation to start messaging
          </div>
        )}
      </div>
    </div>
  );
}
