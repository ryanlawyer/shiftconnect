import { startOfWeek, endOfWeek, subWeeks, isWithinInterval } from "date-fns";
import type { Shift, Employee } from "@shared/schema";

export interface StatValue {
  value: number | string;
  change: number | null; // null indicates no comparison available (e.g., 0→N case)
}

export interface DashboardStatsData {
  openShifts: StatValue;
  activeEmployees: StatValue;
  smsSentToday: StatValue;
  shiftsFilled: StatValue;
}

/**
 * Calculates the percentage change between two values.
 * Returns null if previous is 0 (can't calculate meaningful percentage from zero baseline).
 */
function calculatePercentageChange(current: number, previous: number): number | null {
  if (previous === 0) {
    // Can't calculate percentage change from zero baseline
    return null;
  }
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Safely parses a date, returning null for invalid dates.
 */
function safeParseDate(dateValue: string | Date | null | undefined): Date | null {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Checks if a date is within an interval, with null safety.
 */
function isDateInInterval(
  dateValue: string | Date | null | undefined,
  interval: { start: Date; end: Date }
): boolean {
  const date = safeParseDate(dateValue);
  if (!date) return false;
  return isWithinInterval(date, interval);
}

/**
 * Gets week boundaries for trend calculations.
 * Week starts on Sunday by default.
 */
function getWeekBoundaries() {
  const now = new Date();

  const thisWeekStart = startOfWeek(now);
  const thisWeekEnd = endOfWeek(now);

  const lastWeekDate = subWeeks(now, 1);
  const lastWeekStart = startOfWeek(lastWeekDate);
  const lastWeekEnd = endOfWeek(lastWeekDate);

  return { now, thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd };
}

/**
 * Filters shifts by creation date within a given interval.
 */
function getShiftsCreatedInInterval(
  shifts: Shift[],
  interval: { start: Date; end: Date }
): Shift[] {
  return shifts.filter(s => isDateInInterval(s.createdAt, interval));
}

/**
 * Calculates fill rate (percentage of shifts that are claimed).
 */
function calculateFillRate(shifts: Shift[]): number {
  if (shifts.length === 0) return 0;
  const claimed = shifts.filter(s => s.status === "claimed").length;
  return (claimed / shifts.length) * 100;
}

/**
 * Calculates dashboard statistics from shifts and employees data.
 *
 * Metrics:
 * - Open Shifts: Current count of available shifts, with week-over-week creation trend
 * - Active Employees: Count of employees with "active" status
 * - SMS Sent Today: Placeholder (0) until SMS integration is implemented
 * - Shifts Filled: Fill rate percentage with week-over-week percentage change
 */
export function calculateDashboardStats(
  shifts: Shift[],
  employees: Employee[]
): DashboardStatsData {
  const { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd } = getWeekBoundaries();

  // --- Open Shifts ---
  // Value: Count of currently available shifts
  // Trend: Week-over-week change in shifts created
  const openShiftsCount = shifts.filter(s => s.status === "available").length;

  const thisWeekInterval = { start: thisWeekStart, end: thisWeekEnd };
  const lastWeekInterval = { start: lastWeekStart, end: lastWeekEnd };

  const shiftsCreatedThisWeek = getShiftsCreatedInInterval(shifts, thisWeekInterval).length;
  const shiftsCreatedLastWeek = getShiftsCreatedInInterval(shifts, lastWeekInterval).length;
  const openShiftsChange = calculatePercentageChange(shiftsCreatedThisWeek, shiftsCreatedLastWeek);

  // --- Active Employees ---
  // Value: Count of employees with "active" status
  // Trend: Not available (employee schema lacks createdAt)
  const activeEmployeesCount = employees.filter(e => e.status === "active").length;
  const activeEmployeesChange = null; // No createdAt field in employee schema

  // --- SMS Sent Today ---
  // Placeholder until SMS integration is implemented
  const smsSentTodayCount = 0;
  const smsSentChange = null; // SMS not implemented

  // --- Shifts Filled Percentage ---
  // Value: Overall fill rate (claimed / total non-expired)
  // Trend: Week-over-week percentage change in fill rate
  const nonExpiredShifts = shifts.filter(s => s.status !== "expired");
  const fillPercentage = nonExpiredShifts.length > 0
    ? Math.round(calculateFillRate(nonExpiredShifts))
    : 0;

  // Calculate week-over-week fill rate change
  const thisWeekShifts = getShiftsCreatedInInterval(shifts, thisWeekInterval);
  const lastWeekShifts = getShiftsCreatedInInterval(shifts, lastWeekInterval);

  const thisWeekFillRate = calculateFillRate(thisWeekShifts);
  const lastWeekFillRate = calculateFillRate(lastWeekShifts);

  // Use percentage change formula for consistency with other metrics
  const fillRateChange = calculatePercentageChange(
    Math.round(thisWeekFillRate),
    Math.round(lastWeekFillRate)
  );

  return {
    openShifts: {
      value: openShiftsCount,
      change: openShiftsChange,
    },
    activeEmployees: {
      value: activeEmployeesCount,
      change: activeEmployeesChange,
    },
    smsSentToday: {
      value: smsSentTodayCount,
      change: smsSentChange,
    },
    shiftsFilled: {
      value: `${fillPercentage}%`,
      change: fillRateChange,
    },
  };
}
