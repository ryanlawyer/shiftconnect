import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Users, Send } from "lucide-react";

export interface TrainingCardProps {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  duration: string;
  attendees: number;
  maxAttendees: number;
  isRequired: boolean;
  onNotify?: (id: string) => void;
  onViewDetails?: (id: string) => void;
}

export function TrainingCard({
  id,
  title,
  description,
  date,
  time,
  duration,
  attendees,
  maxAttendees,
  isRequired,
  onNotify,
  onViewDetails,
}: TrainingCardProps) {
  const spotsLeft = maxAttendees - attendees;
  const isFull = spotsLeft <= 0;

  return (
    <Card className="hover-elevate" data-testid={`card-training-${id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="space-y-1">
          <h3 className="text-lg font-medium" data-testid={`text-training-title-${id}`}>{title}</h3>
        </div>
        <div className="flex gap-2">
          {isRequired && (
            <Badge variant="destructive" data-testid={`badge-required-${id}`}>
              Required
            </Badge>
          )}
          {isFull ? (
            <Badge variant="secondary">Full</Badge>
          ) : (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              {spotsLeft} spots left
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{date}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{time}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{attendees}/{maxAttendees} enrolled</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Duration: {duration}</p>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onNotify?.(id)}
          data-testid={`button-notify-training-${id}`}
        >
          <Send className="h-4 w-4 mr-1" />
          Send Reminder
        </Button>
        <Button
          size="sm"
          onClick={() => onViewDetails?.(id)}
          data-testid={`button-details-training-${id}`}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}
