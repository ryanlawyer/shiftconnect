import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { useMemo } from "react";
import type { ShiftCardProps } from "@/components/ShiftCard";

interface WeekGridViewProps {
  shifts: ShiftCardProps[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  weekStart: Date;
  onWeekChange: (direction: "prev" | "next") => void;
}

interface DayData {
  date: Date;
  dateStr: string;
  available: number;
  claimed: number;
  expired: number;
  total: number;
}

export function WeekGridView({
  shifts,
  selectedDate,
  onDateSelect,
  weekStart,
  onWeekChange,
}: WeekGridViewProps) {
  const weekDays = useMemo(() => {
    const days: DayData[] = [];
    const start = startOfWeek(weekStart, { weekStartsOn: 0 });
    
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const dateStr = format(date, "yyyy-MM-dd");
      
      const dayShifts = shifts.filter(shift => {
        const shiftDateStr = shift.date;
        if (shiftDateStr.includes("-")) {
          return shiftDateStr === dateStr;
        }
        try {
          const parsed = parseISO(shiftDateStr);
          return isSameDay(parsed, date);
        } catch {
          return false;
        }
      });
      
      days.push({
        date,
        dateStr,
        available: dayShifts.filter(s => s.status === "available").length,
        claimed: dayShifts.filter(s => s.status === "claimed").length,
        expired: dayShifts.filter(s => s.status === "expired").length,
        total: dayShifts.length,
      });
    }
    
    return days;
  }, [shifts, weekStart]);

  const weekLabel = useMemo(() => {
    const start = weekDays[0]?.date;
    const end = weekDays[6]?.date;
    if (!start || !end) return "";
    return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
  }, [weekDays]);

  return (
    <Card className="p-4" data-testid="week-grid-view">
      <div className="flex items-center justify-between gap-4 mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onWeekChange("prev")}
          data-testid="button-prev-week"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium" data-testid="text-week-label">
          {weekLabel}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onWeekChange("next")}
          data-testid="button-next-week"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {weekDays.map((day) => {
          const isSelected = selectedDate && isSameDay(day.date, selectedDate);
          const isToday = isSameDay(day.date, new Date());
          
          return (
            <button
              key={day.dateStr}
              onClick={() => onDateSelect(day.date)}
              className={`
                flex flex-col items-center p-2 sm:p-3 rounded-md transition-colors
                ${isSelected ? "bg-primary text-primary-foreground" : "hover-elevate"}
                ${isToday && !isSelected ? "ring-1 ring-primary" : ""}
              `}
              data-testid={`day-cell-${day.dateStr}`}
            >
              <span className="text-xs font-medium mb-1">
                {format(day.date, "EEE")}
              </span>
              <span className={`text-lg font-semibold ${isSelected ? "" : ""}`}>
                {format(day.date, "d")}
              </span>
              
              {day.total > 0 && (
                <div className="flex items-center gap-0.5 mt-1 flex-wrap justify-center">
                  {day.available > 0 && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs px-1 py-0 ${isSelected ? "border-primary-foreground/50 text-primary-foreground" : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0"}`}
                    >
                      {day.available}
                    </Badge>
                  )}
                  {day.claimed > 0 && (
                    <Badge 
                      variant="outline"
                      className={`text-xs px-1 py-0 ${isSelected ? "border-primary-foreground/50 text-primary-foreground" : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0"}`}
                    >
                      {day.claimed}
                    </Badge>
                  )}
                </div>
              )}
              
              {day.total === 0 && (
                <span className={`text-xs mt-1 ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  -
                </span>
              )}
            </button>
          );
        })}
      </div>
      
      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          <span>Claimed</span>
        </div>
      </div>
    </Card>
  );
}
