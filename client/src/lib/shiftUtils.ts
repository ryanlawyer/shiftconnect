import { formatRelativeTime } from "./formatRelativeTime";
import type { ShiftCardProps } from "@/components/ShiftCard";
import type { Shift, Area, Employee } from "@shared/schema";

/**
 * Extended shift type that includes area, interest count, and assigned employee from the API.
 * This matches the response shape from GET /api/shifts.
 */
export type ShiftWithDetails = Shift & {
  area: Area | null;
  interestedCount: number;
  assignedEmployee: Employee | null;
  position: string;
};

/**
 * Transforms a shift from API response format to ShiftCard component props.
 */
export function transformShiftToCard(shift: ShiftWithDetails): ShiftCardProps {
  return {
    id: shift.id,
    position: shift.position,
    positionId: shift.positionId,
    area: shift.area,
    areaId: shift.areaId,
    areaName: shift.area?.name,
    location: shift.location,
    date: shift.date,
    startTime: shift.startTime,
    endTime: shift.endTime,
    requirements: shift.requirements,
    postedBy: shift.postedByName,
    postedAt: formatRelativeTime(shift.createdAt),
    status: shift.status as "available" | "claimed" | "expired",
    interestedCount: shift.interestedCount,
    assignedEmployee: shift.assignedEmployee,
    bonusAmount: shift.bonusAmount,
    notifyAllAreas: shift.notifyAllAreas ?? undefined,
    lastNotifiedAt: shift.lastNotifiedAt,
    notificationCount: shift.notificationCount,
  };
}

/**
 * Transforms an array of shifts from API response format to ShiftCard component props.
 */
export function transformShiftsToCards(shifts: ShiftWithDetails[]): ShiftCardProps[] {
  return shifts.map(transformShiftToCard);
}
