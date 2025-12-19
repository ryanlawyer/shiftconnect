import { storage } from "../storage";
import { smsProvider, type SendSMSResult, type SMSProviderType } from "./sms";
import { logAuditEvent } from "../audit";
import { randomUUID } from "crypto";
import type { Shift, Employee, Area } from "@shared/schema";
import { getRenderedTemplate } from "./smsTemplates";

// Types for SMS operations
interface SMSSettings {
  // Provider selection
  smsProvider: SMSProviderType;

  // Twilio configuration
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;
  twilioMessagingServiceSid: string;

  // RingCentral configuration
  ringcentralClientId: string;
  ringcentralClientSecret: string;
  ringcentralServerUrl: string;
  ringcentralJwt: string;
  ringcentralFromNumber: string;

  // General SMS settings
  smsEnabled: boolean;
  smsDailyLimit: number;
  notifyOnNewShift: boolean;
  notifyOnShiftClaimed: boolean;
  shiftReminderEnabled: boolean;
  shiftReminderHours: number;
  smsQuietHoursStart: string;
  smsQuietHoursEnd: string;
  smsRespectQuietHours: boolean;
}

// Helper to get SMS settings from organization settings with env var fallbacks
async function getSMSSettings(): Promise<SMSSettings> {
  const settings = await storage.getSettings();
  const getValue = (key: string, defaultValue: string = ""): string => {
    const setting = settings.find((s) => s.key === key);
    return setting?.value ?? defaultValue;
  };

  // Check for RingCentral env vars
  const hasRingCentralEnvVars = !!(
    process.env.RINGCENTRAL_CLIENT_ID &&
    process.env.RINGCENTRAL_CLIENT_SECRET &&
    process.env.RINGCENTRAL_JWT &&
    process.env.RINGCENTRAL_FROM_NUMBER
  );

  // Determine provider: use ringcentral if env vars are set and no explicit db setting
  const dbProvider = getValue("sms_provider");
  const smsProvider = dbProvider || (hasRingCentralEnvVars ? "ringcentral" : "twilio");

  return {
    // Provider selection
    smsProvider: smsProvider as SMSProviderType,

    // Twilio configuration
    twilioAccountSid: getValue("twilio_account_sid"),
    twilioAuthToken: getValue("twilio_auth_token"),
    twilioFromNumber: getValue("twilio_from_number"),
    twilioMessagingServiceSid: getValue("twilio_messaging_service_sid"),

    // RingCentral configuration - fallback to env vars
    ringcentralClientId: getValue("ringcentral_client_id") || process.env.RINGCENTRAL_CLIENT_ID || "",
    ringcentralClientSecret: getValue("ringcentral_client_secret") || process.env.RINGCENTRAL_CLIENT_SECRET || "",
    ringcentralServerUrl: getValue("ringcentral_server_url", "https://platform.ringcentral.com"),
    ringcentralJwt: getValue("ringcentral_jwt") || process.env.RINGCENTRAL_JWT || "",
    ringcentralFromNumber: getValue("ringcentral_from_number") || process.env.RINGCENTRAL_FROM_NUMBER || "",

    // General SMS settings - auto-enable if RingCentral env vars are configured
    smsEnabled: getValue("sms_enabled") === "true" || hasRingCentralEnvVars,
    smsDailyLimit: parseInt(getValue("sms_daily_limit", "1000")),
    notifyOnNewShift: getValue("notify_on_new_shift", "true") === "true",
    notifyOnShiftClaimed: getValue("notify_on_shift_claimed", "true") === "true",
    shiftReminderEnabled: getValue("shift_reminder_enabled", "true") === "true",
    shiftReminderHours: parseInt(getValue("shift_reminder_hours", "24")),
    smsQuietHoursStart: getValue("sms_quiet_hours_start", "22:00"),
    smsQuietHoursEnd: getValue("sms_quiet_hours_end", "07:00"),
    smsRespectQuietHours: getValue("sms_respect_quiet_hours", "true") === "true",
  };
}

// Initialize SMS provider with current settings
async function initializeSMSProvider(): Promise<boolean> {
  const settings = await getSMSSettings();

  if (!settings.smsEnabled) {
    return false;
  }

  try {
    if (settings.smsProvider === "ringcentral") {
      // Validate RingCentral configuration
      if (
        !settings.ringcentralClientId ||
        !settings.ringcentralClientSecret ||
        !settings.ringcentralJwt ||
        !settings.ringcentralFromNumber
      ) {
        console.log("RingCentral configuration incomplete");
        return false;
      }

      const config = {
        provider: "ringcentral" as const,
        fromNumber: settings.ringcentralFromNumber,
        ringcentralClientId: settings.ringcentralClientId,
        ringcentralClientSecret: settings.ringcentralClientSecret,
        ringcentralServerUrl: settings.ringcentralServerUrl,
        ringcentralJwt: settings.ringcentralJwt,
      };
      
      // Use async initialization that verifies authentication
      const rcProvider = smsProvider as any;
      if (typeof rcProvider.initializeAsync === 'function') {
        const authenticated = await rcProvider.initializeAsync(config);
        if (!authenticated) {
          console.log("RingCentral authentication failed");
          return false;
        }
        return true;
      } else {
        // Fallback to sync initialize
        smsProvider.initialize(config);
      }
    } else {
      // Default to Twilio
      if (!settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioFromNumber) {
        console.log("Twilio configuration incomplete");
        return false;
      }

      smsProvider.initialize({
        provider: "twilio",
        fromNumber: settings.twilioFromNumber,
        twilioAccountSid: settings.twilioAccountSid,
        twilioAuthToken: settings.twilioAuthToken,
        twilioMessagingServiceSid: settings.twilioMessagingServiceSid || undefined,
      });
    }

    return smsProvider.isInitialized();
  } catch (error) {
    console.error("Failed to initialize SMS provider:", error);
    return false;
  }
}

// Check if current time is within quiet hours
function isQuietHours(start: string, end: string): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMin] = start.split(":").map(Number);
  const [endHour, endMin] = end.split(":").map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

// Format shift details for SMS
function formatShiftDetails(shift: Shift, area?: Area | null): string {
  return `${shift.date} ${shift.startTime}-${shift.endTime} at ${shift.location}${area ? ` (${area.name})` : ""}`;
}

/**
 * Send notification to eligible employees when a new shift is posted
 */
export async function notifyNewShift(
  shift: Shift,
  area: Area | undefined,
  recipients: Employee[],
  webhookBaseUrl?: string
): Promise<{ sent: number; failed: number }> {
  const settings = await getSMSSettings();

  // Check if notifications are enabled
  if (!settings.smsEnabled || !settings.notifyOnNewShift) {
    return { sent: 0, failed: 0 };
  }

  // Check quiet hours
  if (
    settings.smsRespectQuietHours &&
    isQuietHours(settings.smsQuietHoursStart, settings.smsQuietHoursEnd)
  ) {
    console.log("Skipping new shift notification during quiet hours");
    return { sent: 0, failed: 0 };
  }

  // Initialize SMS provider
  const initialized = await initializeSMSProvider();
  if (!initialized) {
    console.log("SMS provider not initialized, skipping notifications");
    return { sent: 0, failed: 0 };
  }

  // Filter to only active, opted-in employees
  const eligibleRecipients = recipients.filter((e) => e.status === "active" && e.smsOptIn);

  let sent = 0;
  let failed = 0;

  // Look up position for template
  const position = await storage.getPosition(shift.positionId);
  
  // Try to get template, fall back to hardcoded message
  const templateMessage = await getRenderedTemplate("shift_notification", {
    shift,
    area,
    position: position ? { title: position.title } : undefined,
  });
  const appUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.APP_URL || "";
  const message =
    templateMessage ||
    `[ShiftConnect] New shift available!\n${formatShiftDetails(shift, area)}\nCode: ${shift.smsCode}\n\nTap to claim: ${appUrl}/shift/${shift.smsCode}\n\nOr reply YES ${shift.smsCode}`;

  // Build status callback URL based on provider
  const statusCallback = webhookBaseUrl
    ? `${webhookBaseUrl}/api/webhooks/${settings.smsProvider}/status`
    : undefined;

  for (const employee of eligibleRecipients) {
    try {
      // Create message record
      const messageRecord = await storage.createMessage({
        employeeId: employee.id,
        direction: "outbound",
        content: message,
        status: "pending",
        messageType: "shift_notification",
        relatedShiftId: shift.id,
        threadId: randomUUID(),
      });

      // Send SMS using provider abstraction
      const result = await smsProvider.sendSMS(employee.phone, message, statusCallback);

      // Update message with result
      await storage.updateMessage(messageRecord.id, {
        providerMessageId: result.messageId || result.providerMessageId || null,
        smsProvider: settings.smsProvider,
        status: result.success ? "sent" : "failed",
        deliveryStatus: result.status || null,
        errorCode: result.errorCode || null,
        errorMessage: result.errorMessage || null,
        segments: result.segments || 1,
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
      }

      // Small delay to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`Failed to send notification to ${employee.name}:`, error);
      failed++;
    }
  }

  // Log audit event
  await logAuditEvent({
    action: "sms_sent",
    actor: null,
    targetType: "shift",
    targetId: shift.id,
    targetName: formatShiftDetails(shift, area),
    details: {
      type: "shift_notification",
      provider: settings.smsProvider,
      recipientCount: eligibleRecipients.length,
      sent,
      failed,
    },
    ipAddress: undefined,
  });

  return { sent, failed };
}

/**
 * Send repost notification to eligible employees
 * Uses the shift_repost template which conditionally includes bonus info
 */
export async function notifyRepostedShift(
  shift: Shift,
  area: Area | undefined,
  recipients: Employee[],
  webhookBaseUrl?: string
): Promise<{ sent: number; failed: number }> {
  const settings = await getSMSSettings();

  // Check if notifications are enabled
  if (!settings.smsEnabled || !settings.notifyOnNewShift) {
    return { sent: 0, failed: 0 };
  }

  // Check quiet hours
  if (
    settings.smsRespectQuietHours &&
    isQuietHours(settings.smsQuietHoursStart, settings.smsQuietHoursEnd)
  ) {
    console.log("Skipping shift repost notification during quiet hours");
    return { sent: 0, failed: 0 };
  }

  // Initialize SMS provider
  const initialized = await initializeSMSProvider();
  if (!initialized) {
    console.log("SMS provider not initialized, skipping notifications");
    return { sent: 0, failed: 0 };
  }

  // Filter to only active, opted-in employees
  const eligibleRecipients = recipients.filter((e) => e.status === "active" && e.smsOptIn);

  let sent = 0;
  let failed = 0;

  // Look up position for template
  const position = await storage.getPosition(shift.positionId);
  
  // Try to get shift_repost template, fall back to shift_notification, then hardcoded
  let templateMessage = await getRenderedTemplate("shift_repost", {
    shift,
    area,
    position: position ? { title: position.title } : undefined,
  });
  
  // If no shift_repost template, try shift_notification as fallback
  if (!templateMessage) {
    templateMessage = await getRenderedTemplate("shift_notification", {
      shift,
      area,
      position: position ? { title: position.title } : undefined,
    });
  }
  
  const message =
    templateMessage ||
    `[ShiftConnect] Shift available!\n${formatShiftDetails(shift, area)}${shift.bonusAmount ? ` - $${shift.bonusAmount} bonus!` : ''}\nReply YES ${shift.smsCode} to express interest.`;

  // Build status callback URL based on provider
  const statusCallback = webhookBaseUrl
    ? `${webhookBaseUrl}/api/webhooks/${settings.smsProvider}/status`
    : undefined;

  for (const employee of eligibleRecipients) {
    try {
      // Create message record
      const messageRecord = await storage.createMessage({
        employeeId: employee.id,
        direction: "outbound",
        content: message,
        status: "pending",
        messageType: "shift_notification",
        relatedShiftId: shift.id,
        threadId: randomUUID(),
      });

      // Send SMS using provider abstraction
      const result = await smsProvider.sendSMS(employee.phone, message, statusCallback);

      // Update message with result
      await storage.updateMessage(messageRecord.id, {
        providerMessageId: result.messageId || result.providerMessageId || null,
        smsProvider: settings.smsProvider,
        status: result.success ? "sent" : "failed",
        deliveryStatus: result.status || null,
        errorCode: result.errorCode || null,
        errorMessage: result.errorMessage || null,
        segments: result.segments || 1,
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
      }

      // Small delay to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`Failed to send repost notification to ${employee.name}:`, error);
      failed++;
    }
  }

  // Log audit event
  await logAuditEvent({
    action: "sms_sent",
    actor: null,
    targetType: "shift",
    targetId: shift.id,
    targetName: formatShiftDetails(shift, area),
    details: {
      type: "shift_repost",
      provider: settings.smsProvider,
      recipientCount: eligibleRecipients.length,
      sent,
      failed,
      bonusAmount: shift.bonusAmount,
    },
    ipAddress: undefined,
  });

  return { sent, failed };
}

/**
 * Send confirmation to employee when they are assigned to a shift
 */
export async function notifyShiftAssigned(
  shift: Shift,
  employee: Employee,
  area?: Area | null,
  webhookBaseUrl?: string
): Promise<SendSMSResult> {
  const settings = await getSMSSettings();

  // Check if notifications are enabled
  if (!settings.smsEnabled || !settings.notifyOnShiftClaimed) {
    return { success: false, errorMessage: "Notifications disabled" };
  }

  // Check if employee has opted in
  if (!employee.smsOptIn) {
    return { success: false, errorMessage: "Employee opted out of SMS" };
  }

  // Initialize SMS provider
  const initialized = await initializeSMSProvider();
  if (!initialized) {
    return { success: false, errorMessage: "SMS provider not initialized" };
  }

  // Look up position for template
  const position = await storage.getPosition(shift.positionId);
  
  // Try to get template, fall back to hardcoded message
  const templateMessage = await getRenderedTemplate("shift_confirmation", {
    shift,
    employee,
    area,
    position: position ? { title: position.title } : undefined,
  });
  const message =
    templateMessage ||
    `[ShiftConnect] Shift Confirmed!\nYou're scheduled for:\n${formatShiftDetails(shift, area)}\nQuestions? Contact your supervisor.`;

  const statusCallback = webhookBaseUrl
    ? `${webhookBaseUrl}/api/webhooks/${settings.smsProvider}/status`
    : undefined;

  try {
    // Create message record
    const messageRecord = await storage.createMessage({
      employeeId: employee.id,
      direction: "outbound",
      content: message,
      status: "pending",
      messageType: "shift_confirmation",
      relatedShiftId: shift.id,
      threadId: randomUUID(),
    });

    // Send SMS using provider abstraction with retry
    const result = await smsProvider.sendSMSWithRetry(employee.phone, message, statusCallback);

    // Update message with result
    await storage.updateMessage(messageRecord.id, {
      providerMessageId: result.messageId || result.providerMessageId || null,
      smsProvider: settings.smsProvider,
      status: result.success ? "sent" : "failed",
      deliveryStatus: result.status || null,
      errorCode: result.errorCode || null,
      errorMessage: result.errorMessage || null,
      segments: result.segments || 1,
    });

    // Log audit event
    await logAuditEvent({
      action: result.success ? "sms_sent" : "sms_failed",
      actor: null,
      targetType: "message",
      targetId: messageRecord.id,
      targetName: employee.name,
      details: {
        type: "shift_confirmation",
        provider: settings.smsProvider,
        shiftId: shift.id,
        messageId: result.messageId,
        errorCode: result.errorCode,
      },
      ipAddress: undefined,
    });

    return result;
  } catch (error) {
    console.error(`Failed to send confirmation to ${employee.name}:`, error);
    return { success: false, errorMessage: "Send failed" };
  }
}

/**
 * Send notification to employee when they are unassigned from a shift
 */
export async function notifyShiftUnassigned(
  shift: Shift,
  employee: Employee,
  area?: Area | null,
  webhookBaseUrl?: string
): Promise<SendSMSResult> {
  const settings = await getSMSSettings();

  // Check if notifications are enabled
  if (!settings.smsEnabled) {
    return { success: false, errorMessage: "Notifications disabled" };
  }

  // Check if employee has opted in
  if (!employee.smsOptIn) {
    return { success: false, errorMessage: "Employee opted out of SMS" };
  }

  // Initialize SMS provider
  const initialized = await initializeSMSProvider();
  if (!initialized) {
    return { success: false, errorMessage: "SMS provider not initialized" };
  }

  // Look up position for template
  const position = await storage.getPosition(shift.positionId);
  
  // Try to get template, fall back to hardcoded message
  const templateMessage = await getRenderedTemplate("shift_unassigned", {
    shift,
    employee,
    area,
    position: position ? { title: position.title } : undefined,
  });
  const message =
    templateMessage ||
    `[ShiftConnect] Shift Update\nYou have been unassigned from the shift on ${shift.date} at ${shift.location} (${shift.startTime}-${shift.endTime}).\nPlease contact your supervisor if you have questions.`;

  const statusCallback = webhookBaseUrl
    ? `${webhookBaseUrl}/api/webhooks/${settings.smsProvider}/status`
    : undefined;

  try {
    // Create message record
    const messageRecord = await storage.createMessage({
      employeeId: employee.id,
      direction: "outbound",
      content: message,
      status: "pending",
      messageType: "shift_unassigned",
      relatedShiftId: shift.id,
      threadId: randomUUID(),
    });

    // Send SMS using provider abstraction with retry
    const result = await smsProvider.sendSMSWithRetry(employee.phone, message, statusCallback);

    // Update message with result
    await storage.updateMessage(messageRecord.id, {
      providerMessageId: result.messageId || result.providerMessageId || null,
      smsProvider: settings.smsProvider,
      status: result.success ? "sent" : "failed",
      deliveryStatus: result.status || null,
      errorCode: result.errorCode || null,
      errorMessage: result.errorMessage || null,
      segments: result.segments || 1,
    });

    // Log audit event
    await logAuditEvent({
      action: result.success ? "sms_sent" : "sms_failed",
      actor: null,
      targetType: "message",
      targetId: messageRecord.id,
      targetName: employee.name,
      details: {
        type: "shift_unassigned",
        provider: settings.smsProvider,
        shiftId: shift.id,
        messageId: result.messageId,
        errorCode: result.errorCode,
      },
      ipAddress: undefined,
    });

    return result;
  } catch (error) {
    console.error(`Failed to send unassignment notification to ${employee.name}:`, error);
    return { success: false, errorMessage: "Send failed" };
  }
}

/**
 * Send shift reminder (typically called by a scheduled job)
 */
export async function sendShiftReminder(
  shift: Shift,
  employee: Employee,
  area?: Area | null,
  webhookBaseUrl?: string
): Promise<SendSMSResult> {
  const settings = await getSMSSettings();

  // Check if reminders are enabled
  if (!settings.smsEnabled || !settings.shiftReminderEnabled) {
    return { success: false, errorMessage: "Reminders disabled" };
  }

  // Check if employee has opted in
  if (!employee.smsOptIn) {
    return { success: false, errorMessage: "Employee opted out of SMS" };
  }

  // Initialize SMS provider
  const initialized = await initializeSMSProvider();
  if (!initialized) {
    return { success: false, errorMessage: "SMS provider not initialized" };
  }

  // Look up position for template
  const position = await storage.getPosition(shift.positionId);
  
  // Try to get template, fall back to hardcoded message
  const templateMessage = await getRenderedTemplate("shift_reminder", {
    shift,
    employee,
    area,
    position: position ? { title: position.title } : undefined,
  });
  const message =
    templateMessage ||
    `[ShiftConnect] Reminder: Your shift starts soon!\n${formatShiftDetails(shift, area)}\nPlease arrive on time.`;

  const statusCallback = webhookBaseUrl
    ? `${webhookBaseUrl}/api/webhooks/${settings.smsProvider}/status`
    : undefined;

  try {
    // Create message record
    const messageRecord = await storage.createMessage({
      employeeId: employee.id,
      direction: "outbound",
      content: message,
      status: "pending",
      messageType: "shift_reminder",
      relatedShiftId: shift.id,
      threadId: randomUUID(),
    });

    // Send SMS using provider abstraction with retry
    const result = await smsProvider.sendSMSWithRetry(employee.phone, message, statusCallback);

    // Update message with result
    await storage.updateMessage(messageRecord.id, {
      providerMessageId: result.messageId || result.providerMessageId || null,
      smsProvider: settings.smsProvider,
      status: result.success ? "sent" : "failed",
      deliveryStatus: result.status || null,
      errorCode: result.errorCode || null,
      errorMessage: result.errorMessage || null,
      segments: result.segments || 1,
    });

    return result;
  } catch (error) {
    console.error(`Failed to send reminder to ${employee.name}:`, error);
    return { success: false, errorMessage: "Send failed" };
  }
}

/**
 * Notify other interested employees when a shift they expressed interest in is filled
 */
export async function notifyShiftFilledToOthers(
  shift: Shift,
  assignedEmployeeId: string,
  webhookBaseUrl?: string
): Promise<{ sent: number; failed: number }> {
  const settings = await getSMSSettings();

  // Check if notifications are enabled
  if (!settings.smsEnabled) {
    return { sent: 0, failed: 0 };
  }

  // Initialize SMS provider
  const initialized = await initializeSMSProvider();
  if (!initialized) {
    console.log("SMS provider not initialized, skipping shift filled notifications");
    return { sent: 0, failed: 0 };
  }

  // Get all employees who expressed interest but weren't assigned
  const interests = await storage.getShiftInterests(shift.id);
  const area = await storage.getArea(shift.areaId);

  // Filter out the assigned employee and get employee objects
  const otherInterestedIds = interests
    .filter((i) => i.employeeId !== assignedEmployeeId)
    .map((i) => i.employeeId);

  if (otherInterestedIds.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const employees = await storage.getEmployees();
  const otherInterested = employees.filter(
    (e) => otherInterestedIds.includes(e.id) && e.smsOptIn && e.status === "active"
  );

  if (otherInterested.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  const statusCallback = webhookBaseUrl
    ? `${webhookBaseUrl}/api/webhooks/${settings.smsProvider}/status`
    : undefined;

  for (const employee of otherInterested) {
    // Compose message - no template needed, this is a system notification
    const message = `[ShiftConnect] Update: The shift on ${shift.date} (${shift.startTime}-${shift.endTime}) at ${shift.location}${area ? ` (${area.name})` : ""} has been filled.\n\nYou'll be notified of new available shifts. Reply SHIFTS to see current openings.`;

    try {
      // Create message record
      const messageRecord = await storage.createMessage({
        employeeId: employee.id,
        direction: "outbound",
        content: message,
        status: "pending",
        messageType: "general",
        relatedShiftId: shift.id,
        threadId: randomUUID(),
      });

      // Send SMS using provider abstraction
      const result = await smsProvider.sendSMS(employee.phone, message, statusCallback);

      // Update message with result
      await storage.updateMessage(messageRecord.id, {
        providerMessageId: result.messageId || result.providerMessageId || null,
        smsProvider: settings.smsProvider,
        status: result.success ? "sent" : "failed",
        deliveryStatus: result.status || null,
        errorCode: result.errorCode || null,
        errorMessage: result.errorMessage || null,
        segments: result.segments || 1,
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
      }

      // Small delay to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`Failed to send shift filled notification to ${employee.name}:`, error);
      failed++;
    }
  }

  // Log audit event
  if (sent > 0 || failed > 0) {
    await logAuditEvent({
      action: "sms_sent",
      actor: null,
      targetType: "shift",
      targetId: shift.id,
      targetName: formatShiftDetails(shift, area),
      details: {
        type: "shift_filled_notification",
        provider: settings.smsProvider,
        recipientCount: otherInterested.length,
        sent,
        failed,
      },
      ipAddress: undefined,
    });
  }

  return { sent, failed };
}

/**
 * Get the currently configured SMS provider type
 */
export async function getCurrentSMSProvider(): Promise<SMSProviderType | null> {
  const settings = await getSMSSettings();
  if (!settings.smsEnabled) return null;
  return settings.smsProvider;
}

/**
 * Check if SMS is configured and ready to use
 */
export async function isSMSConfigured(): Promise<boolean> {
  const settings = await getSMSSettings();
  if (!settings.smsEnabled) return false;

  if (settings.smsProvider === "ringcentral") {
    return !!(
      settings.ringcentralClientId &&
      settings.ringcentralClientSecret &&
      settings.ringcentralJwt &&
      settings.ringcentralFromNumber
    );
  }

  // Twilio
  return !!(settings.twilioAccountSid && settings.twilioAuthToken && settings.twilioFromNumber);
}

/**
 * Send confirmation to employee when they express interest in a shift
 */
export async function notifyShiftInterestConfirmation(
  shift: Shift,
  employee: Employee,
  area?: Area | null,
  webhookBaseUrl?: string
): Promise<SendSMSResult> {
  const settings = await getSMSSettings();

  // Check if notifications are enabled
  if (!settings.smsEnabled) {
    return { success: false, errorMessage: "Notifications disabled" };
  }

  // Check if employee has opted in
  if (!employee.smsOptIn) {
    return { success: false, errorMessage: "Employee opted out of SMS" };
  }

  // Initialize SMS provider
  const initialized = await initializeSMSProvider();
  if (!initialized) {
    return { success: false, errorMessage: "SMS provider not initialized" };
  }

  // Look up position for template
  const position = await storage.getPosition(shift.positionId);
  
  // Try to get template, fall back to hardcoded message
  const templateMessage = await getRenderedTemplate("shift_interest", {
    shift,
    employee,
    area,
    position: position ? { title: position.title } : undefined,
  });
  const message =
    templateMessage ||
    `[ShiftConnect] Interest Received!\nWe got your interest for:\n${formatShiftDetails(shift, area)}\nYou'll be notified if assigned.`;

  const statusCallback = webhookBaseUrl
    ? `${webhookBaseUrl}/api/webhooks/${settings.smsProvider}/status`
    : undefined;

  try {
    // Create message record
    const messageRecord = await storage.createMessage({
      employeeId: employee.id,
      direction: "outbound",
      content: message,
      status: "pending",
      messageType: "shift_interest",
      relatedShiftId: shift.id,
      threadId: randomUUID(),
    });

    // Send SMS using provider abstraction with retry
    const result = await smsProvider.sendSMSWithRetry(employee.phone, message, statusCallback);

    // Update message with result
    await storage.updateMessage(messageRecord.id, {
      providerMessageId: result.messageId || result.providerMessageId || null,
      smsProvider: settings.smsProvider,
      status: result.success ? "sent" : "failed",
      deliveryStatus: result.status || null,
      errorCode: result.errorCode || null,
      errorMessage: result.errorMessage || null,
      segments: result.segments || 1,
    });

    // Log audit event
    await logAuditEvent({
      action: result.success ? "sms_sent" : "sms_failed",
      actor: null,
      targetType: "message",
      targetId: messageRecord.id,
      targetName: employee.name,
      details: {
        type: "shift_interest_confirmation",
        provider: settings.smsProvider,
        shiftId: shift.id,
        messageId: result.messageId,
        errorCode: result.errorCode,
      },
      ipAddress: undefined,
    });

    return result;
  } catch (error) {
    console.error(`Failed to send interest confirmation to ${employee.name}:`, error);
    return { success: false, errorMessage: "Send failed" };
  }
}

export { getSMSSettings, initializeSMSProvider, isQuietHours };
