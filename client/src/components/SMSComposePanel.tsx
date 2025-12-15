import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Send, Zap } from "lucide-react";

export interface Recipient {
  id: string;
  name: string;
  phone: string;
}

export interface SMSComposePanelProps {
  recipients: Recipient[];
  onRemoveRecipient?: (id: string) => void;
  onSend?: (message: string) => void;
  onCancel?: () => void;
}

const quickTemplates = [
  "Shift available tomorrow - interested?",
  "Training session scheduled for next week",
  "Please check your schedule for updates",
];

export function SMSComposePanel({
  recipients,
  onRemoveRecipient,
  onSend,
  onCancel,
}: SMSComposePanelProps) {
  const [message, setMessage] = useState("");
  const charCount = message.length;
  const charLimit = 160;

  const handleSend = () => {
    if (message.trim() && recipients.length > 0) {
      onSend?.(message);
      setMessage("");
    }
  };

  return (
    <Card data-testid="panel-sms-compose">
      <CardHeader>
        <CardTitle className="text-lg">Send SMS Notification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Recipients ({recipients.length})</label>
          <div className="flex flex-wrap gap-2 min-h-[44px] p-2 border rounded-md bg-muted/30">
            {recipients.length === 0 ? (
              <span className="text-sm text-muted-foreground">No recipients selected</span>
            ) : (
              recipients.map((r) => (
                <Badge key={r.id} variant="secondary" className="gap-1" data-testid={`badge-recipient-${r.id}`}>
                  {r.name}
                  <button
                    onClick={() => onRemoveRecipient?.(r.id)}
                    className="ml-1 hover:text-destructive"
                    data-testid={`button-remove-recipient-${r.id}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </div>
        
        <div>
          <label className="text-sm font-medium mb-2 block">Quick Templates</label>
          <div className="flex flex-wrap gap-2">
            {quickTemplates.map((template, i) => (
              <Button
                key={i}
                size="sm"
                variant="outline"
                onClick={() => setMessage(template)}
                data-testid={`button-template-${i}`}
              >
                <Zap className="h-3 w-3 mr-1" />
                {template.slice(0, 25)}...
              </Button>
            ))}
          </div>
        </div>
        
        <div>
          <label className="text-sm font-medium mb-2 block">Message</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here..."
            className="min-h-[100px]"
            data-testid="input-sms-message"
          />
          <div className="flex justify-between mt-1">
            <span className={`text-xs ${charCount > charLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
              {charCount}/{charLimit} characters
            </span>
            {charCount > charLimit && (
              <span className="text-xs text-muted-foreground">
                Will be sent as {Math.ceil(charCount / charLimit)} messages
              </span>
            )}
          </div>
        </div>
        
        {message && (
          <div className="p-3 bg-muted/50 rounded-md">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Preview</p>
            <p className="text-sm">{message}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} data-testid="button-cancel-sms">
          Cancel
        </Button>
        <Button
          onClick={handleSend}
          disabled={!message.trim() || recipients.length === 0}
          data-testid="button-send-sms"
        >
          <Send className="h-4 w-4 mr-2" />
          Send to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
        </Button>
      </CardFooter>
    </Card>
  );
}
