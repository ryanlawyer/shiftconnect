import { storage } from "../storage";
import { sendShiftReminder } from "./smsNotifications";
import type { Shift, Employee, Area } from "@shared/schema";

// Store for scheduled reminder timeouts
const scheduledReminders = new Map<string, NodeJS.Timeout>();

// Store last check time to prevent duplicate processing
let lastCheckTime = new Date();

interface ReminderSettings {
  enabled: boolean;
  hoursBeforeShift: number;
}

/**
 * Get reminder settings from organization settings
 */
async function getReminderSettings(): Promise<ReminderSettings> {
  const settings = await storage.getSettings();
  const getValue = (key: string, defaultValue: string): string => {
    const setting = settings.find(s => s.key === key);
    return setting?.value ?? defaultValue;
  };

  return {
    enabled: getValue("shift_reminder_enabled", "true") === "true" && getValue("sms_enabled", "false") === "true",
    hoursBeforeShift: parseInt(getValue("shift_reminder_hours", "24")),
  };
}

/**
 * Parse a shift's date and time into a Date object
 */
function parseShiftDateTime(shift: Shift): Date {
  // Date format expected: "YYYY-MM-DD" or similar
  // Time format expected: "HH:MM" (24-hour format)
  const [year, month, day] = shift.date.split("-").map(Number);
  const [hours, minutes] = shift.startTime.split(":").map(Number);

  return new Date(year, month - 1, day, hours, minutes);
}

/**
 * Check if a reminder has already been sent for this shift/employee combination
 */
async function hasReminderBeenSent(shiftId: string, employeeId: string): Promise<boolean> {
  const messages = await storage.getMessages({
    employeeId,
    messageType: "shift_reminder",
  });

  return messages.some(m => m.relatedShiftId === shiftId);
}

/**
 * Process shifts that need reminders sent
 */
export async function processShiftReminders(webhookBaseUrl?: string): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const settings = await getReminderSettings();

  if (!settings.enabled) {
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const now = new Date();
  const reminderWindowEnd = new Date(now.getTime() + settings.hoursBeforeShift * 60 * 60 * 1000);

  // Get all claimed shifts (have an assigned employee)
  const allShifts = await storage.getShifts();
  const claimedShifts = allShifts.filter(s => s.status === "claimed" && s.assignedEmployeeId);

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const shift of claimedShifts) {
    const shiftStartTime = parseShiftDateTime(shift);

    // Skip if shift has already started
    if (shiftStartTime <= now) {
      continue;
    }

    // Check if shift is within the reminder window
    if (shiftStartTime > reminderWindowEnd) {
      continue;
    }

    processed++;

    // Check if reminder already sent
    const alreadySent = await hasReminderBeenSent(shift.id, shift.assignedEmployeeId!);
    if (alreadySent) {
      skipped++;
      continue;
    }

    // Get employee and area info
    const employee = await storage.getEmployee(shift.assignedEmployeeId!);
    if (!employee) {
      failed++;
      continue;
    }

    const area = await storage.getArea(shift.areaId);

    // Send reminder
    const result = await sendShiftReminder(shift, employee, area, webhookBaseUrl);

    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  lastCheckTime = now;

  return { processed, sent, failed, skipped };
}

/**
 * Schedule a reminder for a specific shift
 * This is called when a shift is claimed/assigned
 */
export async function scheduleShiftReminder(
  shift: Shift,
  employee: Employee,
  area?: Area | null,
  webhookBaseUrl?: string
): Promise<void> {
  const settings = await getReminderSettings();

  if (!settings.enabled) {
    return;
  }

  const shiftStartTime = parseShiftDateTime(shift);
  const reminderTime = new Date(shiftStartTime.getTime() - settings.hoursBeforeShift * 60 * 60 * 1000);
  const now = new Date();

  // If reminder time has passed but shift hasn't started, send immediately
  if (reminderTime <= now && shiftStartTime > now) {
    const alreadySent = await hasReminderBeenSent(shift.id, employee.id);
    if (!alreadySent) {
      await sendShiftReminder(shift, employee, area, webhookBaseUrl);
    }
    return;
  }

  // If reminder time is in the future, schedule it
  if (reminderTime > now) {
    const delay = reminderTime.getTime() - now.getTime();
    const reminderKey = `${shift.id}-${employee.id}`;

    // Clear any existing scheduled reminder for this shift/employee
    if (scheduledReminders.has(reminderKey)) {
      clearTimeout(scheduledReminders.get(reminderKey));
    }

    // Schedule the reminder
    const timeoutId = setTimeout(async () => {
      const alreadySent = await hasReminderBeenSent(shift.id, employee.id);
      if (!alreadySent) {
        await sendShiftReminder(shift, employee, area, webhookBaseUrl);
      }
      scheduledReminders.delete(reminderKey);
    }, delay);

    scheduledReminders.set(reminderKey, timeoutId);

    console.log(`Scheduled reminder for shift ${shift.id} at ${reminderTime.toISOString()}`);
  }
}

/**
 * Cancel a scheduled reminder (e.g., if shift is unassigned)
 */
export function cancelShiftReminder(shiftId: string, employeeId: string): void {
  const reminderKey = `${shiftId}-${employeeId}`;

  if (scheduledReminders.has(reminderKey)) {
    clearTimeout(scheduledReminders.get(reminderKey));
    scheduledReminders.delete(reminderKey);
    console.log(`Cancelled reminder for shift ${shiftId}`);
  }
}

/**
 * Get count of scheduled reminders (for monitoring)
 */
export function getScheduledReminderCount(): number {
  return scheduledReminders.size;
}

/**
 * Clear all scheduled reminders (for shutdown)
 */
export function clearAllReminders(): void {
  scheduledReminders.forEach((timeoutId) => {
    clearTimeout(timeoutId);
  });
  scheduledReminders.clear();
}

// Interval-based checker for reminders (backup to scheduled reminders)
let reminderCheckInterval: NodeJS.Timeout | null = null;

/**
 * Start the periodic reminder checker
 * Runs every 15 minutes to catch any shifts that weren't scheduled individually
 */
export function startReminderChecker(webhookBaseUrl?: string, intervalMinutes = 15): void {
  if (reminderCheckInterval) {
    clearInterval(reminderCheckInterval);
  }

  reminderCheckInterval = setInterval(async () => {
    try {
      const result = await processShiftReminders(webhookBaseUrl);
      if (result.sent > 0 || result.failed > 0) {
        console.log(`Reminder check: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
      }
    } catch (error) {
      console.error("Error in reminder checker:", error);
    }
  }, intervalMinutes * 60 * 1000);

  console.log(`Started shift reminder checker (every ${intervalMinutes} minutes)`);
}

/**
 * Stop the periodic reminder checker
 */
export function stopReminderChecker(): void {
  if (reminderCheckInterval) {
    clearInterval(reminderCheckInterval);
    reminderCheckInterval = null;
    console.log("Stopped shift reminder checker");
  }
}

export { getReminderSettings };
