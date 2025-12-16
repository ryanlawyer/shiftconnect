import { Router } from "express";
import { storage } from "../storage";
import {
  smsProvider,
  type SendSMSResult,
  type DeliveryStatus,
  type SMSProviderType,
} from "../services/sms";
import { logAuditEvent, getClientIp } from "../audit";
import { randomUUID } from "crypto";
import { processShiftReminders, getScheduledReminderCount } from "../services/shiftReminderScheduler";
import { templateVariables, validateTemplate, previewTemplate, type TemplateCategory } from "../services/smsTemplates";
import { insertSmsTemplateSchema, type Employee, type Shift } from "@shared/schema";

// ============================================================
// SMS Command Parsing Types and Functions
// ============================================================

interface ParsedCommand {
  type: 'interest_yes' | 'interest_no' | 'confirm' | 'cancel' | 'status' |
        'shifts' | 'help' | 'stop' | 'start' | 'unknown';
  shiftCode?: string; // Optional specific shift reference
  originalMessage: string;
}

/**
 * Parse inbound SMS message to identify command
 */
function parseInboundCommand(body: string): ParsedCommand {
  const normalized = body.trim().toUpperCase();
  const words = normalized.split(/\s+/);

  // Check for YES/Y/INTERESTED with optional shift code
  if (/^(YES|Y|INTERESTED|I WANT IT|CLAIM)/.test(normalized)) {
    // Look for a shift code (6-char alphanumeric) in the message
    const shiftCodeMatch = body.match(/\b([A-Z0-9]{6})\b/i);
    const shiftCode = shiftCodeMatch ? shiftCodeMatch[1].toUpperCase() : undefined;
    return { type: 'interest_yes', shiftCode, originalMessage: body };
  }

  if (/^(NO|N|PASS|CAN'?T|DECLINE|NOT INTERESTED)/.test(normalized)) {
    return { type: 'interest_no', originalMessage: body };
  }

  if (/^CONFIRM/.test(normalized)) {
    return { type: 'confirm', originalMessage: body };
  }

  if (/^CANCEL/.test(normalized)) {
    return { type: 'cancel', originalMessage: body };
  }

  if (/^STATUS/.test(normalized)) {
    return { type: 'status', originalMessage: body };
  }

  if (/^SHIFTS?/.test(normalized)) {
    return { type: 'shifts', originalMessage: body };
  }

  if (/^HELP/.test(normalized)) {
    return { type: 'help', originalMessage: body };
  }

  if (/^(STOP|UNSUBSCRIBE)/.test(normalized)) {
    return { type: 'stop', originalMessage: body };
  }

  if (/^(START|SUBSCRIBE)/.test(normalized)) {
    return { type: 'start', originalMessage: body };
  }

  return { type: 'unknown', originalMessage: body };
}

/**
 * Format date for SMS display
 */
function formatDateForSms(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Handle YES command - express interest in a shift
 */
async function handleInterestYes(
  employee: Employee,
  shiftCode?: string,
  ipAddress?: string
): Promise<string> {
  let shift: Shift | undefined;

  if (shiftCode) {
    // Look up shift by SMS code
    shift = await storage.getShiftBySmsCode(shiftCode);
    if (!shift) {
      return `Sorry, we couldn't find a shift with code ${shiftCode}. Reply SHIFTS to see available shifts.`;
    }
  } else {
    // Find most recent shift notification sent to this employee
    const recentMessages = await storage.getEmployeeMessages(employee.id);
    const lastNotification = recentMessages
      .filter(m => m.messageType === 'shift_notification' && m.relatedShiftId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (lastNotification?.relatedShiftId) {
      shift = await storage.getShift(lastNotification.relatedShiftId);
    }
  }

  if (!shift) {
    return "Sorry, we couldn't find a shift to match your reply. Reply SHIFTS to see available shifts.";
  }

  if (shift.status !== 'available') {
    return `That shift has already been ${shift.status}. Reply SHIFTS to see other available shifts.`;
  }

  // Check if already interested
  const existingInterest = await storage.getShiftInterestByEmployeeAndShift(employee.id, shift.id);
  if (existingInterest) {
    return "You've already expressed interest in this shift. A supervisor will review your request soon.";
  }

  // Create interest record
  await storage.createShiftInterest({
    shiftId: shift.id,
    employeeId: employee.id,
  });

  // Log audit event
  await logAuditEvent({
    action: "shift_interest_via_sms",
    actor: null,
    targetType: "shift",
    targetId: shift.id,
    targetName: `${shift.date} ${shift.startTime}-${shift.endTime}`,
    details: { employeeId: employee.id, employeeName: employee.name, method: "sms" },
    ipAddress: ipAddress,
  });

  const area = await storage.getArea(shift.areaId);
  const dateFormatted = formatDateForSms(shift.date);
  return `Got it! You've expressed interest in the shift on ${dateFormatted} (${shift.startTime}-${shift.endTime}) at ${shift.location}${area ? ` (${area.name})` : ''}.\n\nYou'll be notified when assigned. Reply STATUS to see your requests.`;
}

/**
 * Handle NO command - decline interest in a shift
 */
async function handleInterestNo(
  employee: Employee,
  ipAddress?: string
): Promise<string> {
  // Find most recent shift notification sent to this employee
  const recentMessages = await storage.getEmployeeMessages(employee.id);
  const lastNotification = recentMessages
    .filter(m => m.messageType === 'shift_notification' && m.relatedShiftId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (lastNotification?.relatedShiftId) {
    const shift = await storage.getShift(lastNotification.relatedShiftId);
    if (shift) {
      await logAuditEvent({
        action: "shift_interest_declined_via_sms",
        actor: null,
        targetType: "shift",
        targetId: shift.id,
        targetName: `${shift.date} ${shift.startTime}-${shift.endTime}`,
        details: { employeeId: employee.id, employeeName: employee.name, method: "sms" },
        ipAddress: ipAddress,
      });
    }
  }

  return "No problem! We won't consider you for this shift. You'll still receive notifications for future shifts.";
}

/**
 * Handle STATUS command - show assigned shifts and pending interests
 */
async function handleStatus(employee: Employee): Promise<string> {
  const shifts = await storage.getShifts();

  // Get assigned shifts
  const assignedShifts = shifts
    .filter(s => s.assignedEmployeeId === employee.id && s.status === 'claimed')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  // Get pending interests
  const interests = await storage.getEmployeeShiftInterests(employee.id);
  const pendingInterests = interests
    .filter(i => i.shift && i.shift.status === 'available')
    .slice(0, 5);

  let response = "[ShiftConnect] Your Status:\n\n";

  if (assignedShifts.length > 0) {
    response += "ASSIGNED SHIFTS:\n";
    for (const shift of assignedShifts) {
      const dateFormatted = formatDateForSms(shift.date);
      response += `- ${dateFormatted} ${shift.startTime}-${shift.endTime} at ${shift.location}\n`;
    }
    response += "\n";
  }

  if (pendingInterests.length > 0) {
    response += "PENDING INTERESTS:\n";
    for (const interest of pendingInterests) {
      const shift = interest.shift;
      const dateFormatted = formatDateForSms(shift.date);
      response += `- ${dateFormatted} ${shift.startTime}-${shift.endTime} at ${shift.location}\n`;
    }
  }

  if (assignedShifts.length === 0 && pendingInterests.length === 0) {
    response += "No upcoming shifts or pending interests.\n\nReply SHIFTS to see available shifts.";
  }

  return response;
}

/**
 * Handle SHIFTS command - show available shifts for employee's areas
 */
async function handleShifts(employee: Employee): Promise<string> {
  const shifts = await storage.getShifts();
  const employeeAreas = await storage.getEmployeeAreas(employee.id);
  const employeeAreaIds = employeeAreas.map(area => area.id);

  // Get available shifts in employee's areas and matching their position
  const availableShifts = shifts
    .filter(s =>
      s.status === 'available' &&
      (employeeAreaIds.includes(s.areaId) || employeeAreaIds.length === 0) &&
      s.positionId === employee.positionId
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, 5);

  if (availableShifts.length === 0) {
    return "[ShiftConnect] No available shifts matching your position right now.\n\nYou'll be notified when new shifts are posted.";
  }

  let response = "[ShiftConnect] Available Shifts:\n\n";

  for (const shift of availableShifts) {
    const dateFormatted = formatDateForSms(shift.date);
    const area = await storage.getArea(shift.areaId);
    response += `${dateFormatted} ${shift.startTime}-${shift.endTime}\n`;
    response += `  ${shift.location}${area ? ` (${area.name})` : ''}\n`;
    response += `  Code: ${shift.smsCode || 'N/A'}\n\n`;
  }

  response += "Reply YES <code> to express interest.";
  return response;
}

/**
 * Handle CONFIRM command - acknowledge shift assignment
 */
async function handleConfirm(employee: Employee, ipAddress?: string): Promise<string> {
  const shifts = await storage.getShifts();

  // Find recently assigned shifts for this employee
  const assignedShifts = shifts
    .filter(s => s.assignedEmployeeId === employee.id && s.status === 'claimed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (assignedShifts.length === 0) {
    return "You don't have any pending shift assignments to confirm. Reply STATUS to see your shifts.";
  }

  const shift = assignedShifts[0];
  const dateFormatted = formatDateForSms(shift.date);

  await logAuditEvent({
    action: "shift_confirmed_via_sms",
    actor: null,
    targetType: "shift",
    targetId: shift.id,
    targetName: `${shift.date} ${shift.startTime}-${shift.endTime}`,
    details: { employeeId: employee.id, employeeName: employee.name },
    ipAddress: ipAddress,
  });

  return `Thanks for confirming! Your shift on ${dateFormatted} (${shift.startTime}-${shift.endTime}) at ${shift.location} is confirmed.\n\nPlease arrive 10 minutes early.`;
}

/**
 * Handle CANCEL command - withdraw interest or cancel assigned shift
 */
async function handleCancel(employee: Employee, ipAddress?: string): Promise<string> {
  // First check for pending interests
  const interests = await storage.getEmployeeShiftInterests(employee.id);
  const pendingInterest = interests
    .filter(i => i.shift && i.shift.status === 'available')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (pendingInterest) {
    // Delete the interest
    await storage.deleteShiftInterest(pendingInterest.shiftId, pendingInterest.employeeId);
    const shift = pendingInterest.shift;
    const dateFormatted = formatDateForSms(shift.date);

    await logAuditEvent({
      action: "shift_interest_cancelled_via_sms",
      actor: null,
      targetType: "shift",
      targetId: shift.id,
      targetName: `${shift.date} ${shift.startTime}-${shift.endTime}`,
      details: { employeeId: employee.id, employeeName: employee.name },
      ipAddress: ipAddress,
    });

    return `Your interest in the shift on ${dateFormatted} (${shift.startTime}-${shift.endTime}) has been withdrawn.`;
  }

  // Check for assigned shifts
  const shifts = await storage.getShifts();
  const assignedShift = shifts
    .filter(s => s.assignedEmployeeId === employee.id && s.status === 'claimed')
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  if (assignedShift) {
    // Unassign the shift
    await storage.updateShift(assignedShift.id, {
      assignedEmployeeId: null,
      status: 'available',
    });
    const dateFormatted = formatDateForSms(assignedShift.date);

    await logAuditEvent({
      action: "shift_cancelled_via_sms",
      actor: null,
      targetType: "shift",
      targetId: assignedShift.id,
      targetName: `${assignedShift.date} ${assignedShift.startTime}-${assignedShift.endTime}`,
      details: { employeeId: employee.id, employeeName: employee.name },
      ipAddress: ipAddress,
    });

    return `Your shift on ${dateFormatted} (${assignedShift.startTime}-${assignedShift.endTime}) has been cancelled. The shift is now available for others.\n\nPlease inform your supervisor if this cancellation was unexpected.`;
  }

  return "You don't have any shifts or pending interests to cancel. Reply STATUS to check your current status.";
}

const router = Router();

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

  // General settings
  smsEnabled: boolean;
  smsDailyLimit: number;
  smsRateLimitPerMinute: number;
  notifyOnNewShift: boolean;
  notifyOnShiftClaimed: boolean;
  shiftReminderEnabled: boolean;
  shiftReminderHours: number;
  notifyAdminOnClaim: boolean;
  smsQuietHoursStart: string;
  smsQuietHoursEnd: string;
  smsRespectQuietHours: boolean;
}

// Helper to get SMS settings from organization settings with env var fallbacks
async function getSMSSettings(): Promise<SMSSettings> {
  const settings = await storage.getSettings();
  const getValue = (key: string, defaultValue: string = ""): string => {
    const setting = settings.find(s => s.key === key);
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
  const provider = dbProvider || (hasRingCentralEnvVars ? "ringcentral" : "twilio");

  return {
    // Provider selection
    smsProvider: provider as SMSProviderType,

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

    // General settings - auto-enable if RingCentral env vars are configured
    smsEnabled: getValue("sms_enabled") === "true" || hasRingCentralEnvVars,
    smsDailyLimit: parseInt(getValue("sms_daily_limit", "1000")),
    smsRateLimitPerMinute: parseInt(getValue("sms_rate_limit_per_minute", "60")),
    notifyOnNewShift: getValue("notify_on_new_shift", "true") === "true",
    notifyOnShiftClaimed: getValue("notify_on_shift_claimed", "true") === "true",
    shiftReminderEnabled: getValue("shift_reminder_enabled", "true") === "true",
    shiftReminderHours: parseInt(getValue("shift_reminder_hours", "24")),
    notifyAdminOnClaim: getValue("notify_admin_on_claim", "false") === "true",
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

// Get base URL for webhooks
function getWebhookBaseUrl(req: any): string {
  // In production, this should be set via environment variable
  const protocol = req.secure ? "https" : "http";
  const host = req.get("host");
  return process.env.WEBHOOK_BASE_URL || `${protocol}://${host}`;
}

// === SMS Status Check ===
router.get("/status", async (req, res) => {
  const settings = await getSMSSettings();
  const initialized = smsProvider.isInitialized();

  // Check if the configured provider has valid credentials
  let configured = false;
  let fromNumber: string | null = null;

  if (settings.smsProvider === "ringcentral") {
    configured = !!(
      settings.ringcentralClientId &&
      settings.ringcentralClientSecret &&
      settings.ringcentralJwt &&
      settings.ringcentralFromNumber
    );
    fromNumber = settings.ringcentralFromNumber;
  } else {
    configured = !!(settings.twilioAccountSid && settings.twilioAuthToken && settings.twilioFromNumber);
    fromNumber = settings.twilioFromNumber;
  }

  res.json({
    enabled: settings.smsEnabled,
    provider: settings.smsProvider,
    configured,
    initialized,
    fromNumber: fromNumber ? `***${fromNumber.slice(-4)}` : null,
  });
});

// === Test SMS Credentials ===
router.post("/test", async (req, res) => {
  const user = req.user as any;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required", error: "Admin access required" });
  }

  const { testPhoneNumber } = req.body;

  if (!testPhoneNumber) {
    return res.status(400).json({ success: false, message: "Test phone number is required", error: "Test phone number is required" });
  }

  const settings = await getSMSSettings();

  // Check if provider is configured
  let configured = false;
  let providerName = settings.smsProvider;

  if (settings.smsProvider === "ringcentral") {
    configured = !!(
      settings.ringcentralClientId &&
      settings.ringcentralClientSecret &&
      settings.ringcentralJwt &&
      settings.ringcentralFromNumber
    );
  } else {
    configured = !!(settings.twilioAccountSid && settings.twilioAuthToken && settings.twilioFromNumber);
  }

  if (!configured) {
    return res.status(400).json({
      success: false,
      message: `${providerName} credentials are not fully configured`,
      error: `${providerName} credentials are not fully configured`,
      details: {
        provider: providerName,
        configured: false,
      },
    });
  }

  try {
    // Initialize SMS provider
    const initialized = await initializeSMSProvider();
    if (!initialized) {
      return res.status(500).json({
        success: false,
        message: "Failed to initialize SMS provider",
        error: "Failed to initialize SMS provider",
        details: {
          provider: providerName,
          initialized: false,
        },
      });
    }

    // Send test message
    const testMessage = `ShiftConnect Test: Your ${providerName} SMS integration is working correctly. Sent at ${new Date().toLocaleTimeString()}.`;
    const result = await smsProvider.sendSMS(testPhoneNumber, testMessage);

    if (result.success) {
      // Log the test
      await logAuditEvent({
        action: "sms_test",
        actor: user,
        targetType: "sms_provider",
        targetId: providerName,
        targetName: `${providerName} SMS Test`,
        details: {
          testPhone: `***${testPhoneNumber.slice(-4)}`,
          messageId: result.messageId,
          status: result.status,
        },
      });

      return res.json({
        success: true,
        message: `Test SMS sent successfully via ${providerName}`,
        details: {
          provider: providerName,
          messageId: result.messageId,
          status: result.status,
        },
      });
    } else {
      const errorMsg = result.errorMessage || "Failed to send test SMS";
      return res.status(400).json({
        success: false,
        message: errorMsg,
        error: errorMsg,
        details: {
          provider: providerName,
          errorCode: result.errorCode,
        },
      });
    }
  } catch (error: any) {
    console.error("SMS test error:", error);
    const errorMsg = error.message || "An error occurred while testing SMS";
    return res.status(500).json({
      success: false,
      message: errorMsg,
      error: errorMsg,
      details: {
        provider: providerName,
      },
    });
  }
});

// === Send Individual SMS ===
router.post("/send", async (req, res) => {
  console.log("[SMS Send] Request received:", { body: req.body, hasUser: !!req.user });
  
  const user = req.user as any;
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    console.log("[SMS Send] Access denied - user:", user?.role);
    return res.status(403).json({ error: "Access denied" });
  }

  const { employeeId, content, messageType = "general", relatedShiftId } = req.body;

  if (!employeeId || !content) {
    console.log("[SMS Send] Missing required fields");
    return res.status(400).json({ error: "Employee ID and content are required" });
  }

  console.log("[SMS Send] Processing for employee:", employeeId);
  
  const settings = await getSMSSettings();
  console.log("[SMS Send] Settings:", { smsEnabled: settings.smsEnabled, provider: settings.smsProvider });

  if (!settings.smsEnabled) {
    console.log("[SMS Send] SMS is disabled");
    return res.status(400).json({ error: "SMS is disabled" });
  }

  // Check quiet hours for non-urgent messages
  if (settings.smsRespectQuietHours && messageType !== "shift_reminder") {
    if (isQuietHours(settings.smsQuietHoursStart, settings.smsQuietHoursEnd)) {
      return res.status(400).json({ error: "Cannot send non-urgent SMS during quiet hours" });
    }
  }

  // Initialize SMS provider if needed
  const initialized = await initializeSMSProvider();
  if (!initialized) {
    return res.status(500).json({ error: "SMS provider not configured" });
  }

  // Get employee
  const employee = await storage.getEmployee(employeeId);
  if (!employee) {
    return res.status(404).json({ error: "Employee not found" });
  }

  if (!employee.smsOptIn) {
    return res.status(400).json({ error: "Employee has opted out of SMS" });
  }

  // Create message record
  const threadId = randomUUID();
  console.log("[SMS Send] Creating message record for employee:", employee.name);
  const message = await storage.createMessage({
    employeeId,
    direction: "outbound",
    content,
    status: "pending",
    messageType,
    relatedShiftId: relatedShiftId || null,
    threadId,
  });
  console.log("[SMS Send] Message record created:", message.id);

  // Get status callback URL based on provider
  const statusCallbackUrl = `${getWebhookBaseUrl(req)}/api/webhooks/${settings.smsProvider}/status`;

  // Send SMS using provider abstraction
  console.log("[SMS Send] Sending to phone:", employee.phone);
  const result = await smsProvider.sendSMSWithRetry(
    employee.phone,
    content,
    statusCallbackUrl
  );
  console.log("[SMS Send] Provider result:", { success: result.success, messageId: result.messageId, error: result.errorMessage });

  // Update message with result
  await storage.updateMessage(message.id, {
    providerMessageId: result.messageId || result.providerMessageId || null,
    smsProvider: settings.smsProvider,
    status: result.success ? "sent" : "failed",
    deliveryStatus: result.status as DeliveryStatus || null,
    errorCode: result.errorCode || null,
    errorMessage: result.errorMessage || null,
    segments: result.segments || 1,
  });

  // Audit log
  await logAuditEvent({
    action: "sms_sent",
    actor: user,
    targetType: "message",
    targetId: message.id,
    targetName: employee.name,
    details: {
      success: result.success,
      provider: settings.smsProvider,
      messageId: result.messageId,
      errorCode: result.errorCode,
      messageType,
    },
    ipAddress: getClientIp(req),
  });

  if (result.success) {
    res.json({
      success: true,
      messageId: message.id,
      providerMessageId: result.messageId,
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.errorMessage || "Failed to send SMS",
      errorCode: result.errorCode,
    });
  }
});

// === Bulk SMS ===
router.post("/bulk", async (req, res) => {
  const user = req.user as any;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { employeeIds, content, messageType = "bulk" } = req.body;

  if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
    return res.status(400).json({ error: "Employee IDs array is required" });
  }

  if (!content) {
    return res.status(400).json({ error: "Content is required" });
  }

  const settings = await getSMSSettings();

  if (!settings.smsEnabled) {
    return res.status(400).json({ error: "SMS is disabled" });
  }

  // Initialize SMS provider
  const initialized = await initializeSMSProvider();
  if (!initialized) {
    return res.status(500).json({ error: "SMS provider not configured" });
  }

  const results: { employeeId: string; success: boolean; error?: string }[] = [];
  const statusCallbackUrl = `${getWebhookBaseUrl(req)}/api/webhooks/${settings.smsProvider}/status`;

  for (const employeeId of employeeIds) {
    const employee = await storage.getEmployee(employeeId);

    if (!employee) {
      results.push({ employeeId, success: false, error: "Employee not found" });
      continue;
    }

    if (!employee.smsOptIn) {
      results.push({ employeeId, success: false, error: "Employee opted out" });
      continue;
    }

    // Create message record
    const message = await storage.createMessage({
      employeeId,
      direction: "outbound",
      content,
      status: "pending",
      messageType,
    });

    // Send SMS (with small delay to respect rate limits)
    await new Promise(resolve => setTimeout(resolve, 100));

    const result = await smsProvider.sendSMS(employee.phone, content, statusCallbackUrl);

    await storage.updateMessage(message.id, {
      providerMessageId: result.messageId || result.providerMessageId || null,
      smsProvider: settings.smsProvider,
      status: result.success ? "sent" : "failed",
      deliveryStatus: result.status as DeliveryStatus || null,
      errorCode: result.errorCode || null,
      errorMessage: result.errorMessage || null,
      segments: result.segments || 1,
    });

    results.push({
      employeeId,
      success: result.success,
      error: result.errorMessage,
    });
  }

  // Audit log
  await logAuditEvent({
    action: "sms_bulk_sent",
    actor: user,
    targetType: "message",
    targetId: undefined,
    targetName: `${employeeIds.length} recipients`,
    details: {
      totalRecipients: employeeIds.length,
      provider: settings.smsProvider,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    },
    ipAddress: getClientIp(req),
  });

  res.json({
    total: employeeIds.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  });
});

// === Twilio Status Webhook ===
router.post("/webhooks/twilio/status", async (req, res) => {
  const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

  if (!MessageSid) {
    return res.status(400).send("Missing MessageSid");
  }

  // Find message by provider message ID
  const message = await storage.getMessageByProviderMessageId(MessageSid);

  if (message) {
    // Map Twilio status to our status
    let status = message.status;
    if (MessageStatus === "delivered") {
      status = "delivered";
    } else if (MessageStatus === "failed" || MessageStatus === "undelivered") {
      status = "failed";
    } else if (MessageStatus === "sent") {
      status = "sent";
    }

    await storage.updateMessage(message.id, {
      status,
      deliveryStatus: MessageStatus as DeliveryStatus,
      deliveryTimestamp: new Date(),
      errorCode: ErrorCode || null,
      errorMessage: ErrorMessage || null,
    });
  }

  // Respond with empty TwiML
  res.type("text/xml");
  res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
});

// === RingCentral Status Webhook ===
router.post("/webhooks/ringcentral/status", async (req, res) => {
  // RingCentral sends event notifications in a different format
  const { body: eventBody, event } = req.body;

  // Handle validation token during subscription setup
  if (req.headers["validation-token"]) {
    res.set("Validation-Token", req.headers["validation-token"] as string);
    return res.status(200).send();
  }

  if (!eventBody) {
    return res.status(200).send("OK");
  }

  try {
    const messageId = eventBody.id || eventBody.messageId;
    const messageStatus = eventBody.messageStatus;

    if (messageId) {
      const message = await storage.getMessageByProviderMessageId(messageId);

      if (message) {
        // Map RingCentral status to our status
        let status = message.status;
        if (messageStatus === "Delivered") {
          status = "delivered";
        } else if (messageStatus === "DeliveryFailed" || messageStatus === "SendingFailed") {
          status = "failed";
        } else if (messageStatus === "Sent") {
          status = "sent";
        }

        await storage.updateMessage(message.id, {
          status,
          deliveryStatus: status as DeliveryStatus,
          deliveryTimestamp: new Date(),
          errorCode: eventBody.errorCode || null,
          errorMessage: eventBody.errorMessage || null,
        });
      }
    }
  } catch (error) {
    console.error("Error processing RingCentral status webhook:", error);
  }

  res.status(200).send("OK");
});

// === RingCentral Inbound Message Webhook ===
router.post("/webhooks/ringcentral/inbound", async (req, res) => {
  // Handle validation token during subscription setup
  if (req.headers["validation-token"]) {
    res.set("Validation-Token", req.headers["validation-token"] as string);
    return res.status(200).send();
  }

  const ipAddress = getClientIp(req);

  try {
    const eventBody = req.body.body || req.body;
    const fromNumber = eventBody.from?.phoneNumber || eventBody.from || "";
    const messageBody = eventBody.subject || eventBody.text || "";
    const messageId = eventBody.id || "";

    if (!fromNumber || !messageBody) {
      return res.status(200).send("OK");
    }

    // Find employee by phone number
    const employees = await storage.getEmployees();
    const employee = employees.find(e => {
      const normalizedEmployeePhone = e.phone.replace(/[^\d+]/g, "");
      const normalizedFrom = fromNumber.replace(/[^\d+]/g, "");
      return normalizedEmployeePhone === normalizedFrom ||
             normalizedEmployeePhone.endsWith(normalizedFrom.slice(-10)) ||
             normalizedFrom.endsWith(normalizedEmployeePhone.slice(-10));
    });

    if (!employee) {
      console.log("Inbound SMS from unknown number:", fromNumber);
      return res.status(200).send("OK");
    }

    // Parse the inbound command
    const parsedCommand = parseInboundCommand(messageBody);
    let responseMessage: string | null = null;

    // Handle each command type (same logic as Twilio)
    switch (parsedCommand.type) {
      case 'stop':
        await storage.updateEmployee(employee.id, { smsOptIn: false });
        await logAuditEvent({
          action: "sms_opt_out",
          actor: null,
          targetType: "employee",
          targetId: employee.id,
          targetName: employee.name,
          details: { method: "sms_reply", provider: "ringcentral" },
          ipAddress,
        });
        // RingCentral handles STOP automatically, but we still update our records
        break;

      case 'start':
        await storage.updateEmployee(employee.id, { smsOptIn: true });
        await logAuditEvent({
          action: "sms_opt_in",
          actor: null,
          targetType: "employee",
          targetId: employee.id,
          targetName: employee.name,
          details: { method: "sms_reply", provider: "ringcentral" },
          ipAddress,
        });
        break;

      case 'help':
        responseMessage = "[ShiftConnect] Commands:\n" +
          "YES - Express interest in a shift\n" +
          "YES <code> - Interest in specific shift\n" +
          "NO - Decline a shift\n" +
          "CONFIRM - Confirm assigned shift\n" +
          "CANCEL - Withdraw interest/cancel shift\n" +
          "STATUS - Your shifts & interests\n" +
          "SHIFTS - View available shifts\n" +
          "STOP - Unsubscribe\n" +
          "START - Subscribe";
        break;

      case 'status':
        responseMessage = await handleStatus(employee);
        break;

      case 'shifts':
        responseMessage = await handleShifts(employee);
        break;

      case 'interest_yes':
        responseMessage = await handleInterestYes(employee, parsedCommand.shiftCode, ipAddress);
        break;

      case 'interest_no':
        responseMessage = await handleInterestNo(employee, ipAddress);
        break;

      case 'confirm':
        responseMessage = await handleConfirm(employee, ipAddress);
        break;

      case 'cancel':
        responseMessage = await handleCancel(employee, ipAddress);
        break;

      case 'unknown':
      default:
        // Store inbound message for supervisor review
        await storage.createMessage({
          employeeId: employee.id,
          direction: "inbound",
          content: messageBody,
          status: "delivered",
          providerMessageId: messageId,
          smsProvider: "ringcentral",
          messageType: "general",
        });

        await logAuditEvent({
          action: "sms_inbound",
          actor: null,
          targetType: "message",
          targetId: undefined,
          targetName: employee.name,
          details: {
            from: fromNumber,
            body: messageBody.substring(0, 100),
            provider: "ringcentral",
          },
          ipAddress,
        });

        responseMessage = "Message received. A supervisor will respond shortly. Reply HELP for available commands.";
        break;
    }

    // If we have a response, send it back via the SMS provider
    if (responseMessage && parsedCommand.type !== 'stop') {
      await initializeSMSProvider();
      await smsProvider.sendSMS(fromNumber, responseMessage);
    }
  } catch (error) {
    console.error("Error processing RingCentral inbound webhook:", error);
  }

  res.status(200).send("OK");
});

// === Twilio Inbound Message Webhook ===
router.post("/webhooks/twilio/inbound", async (req, res) => {
  const inboundMessage = smsProvider.parseInboundMessage(req.body);
  const ipAddress = getClientIp(req);

  if (!inboundMessage) {
    res.type("text/xml");
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    return;
  }

  // Find employee by phone number
  const employees = await storage.getEmployees();
  const employee = employees.find(e => {
    // Normalize phone numbers for comparison
    const normalizedEmployeePhone = e.phone.replace(/[^\d+]/g, "");
    const normalizedFrom = inboundMessage.from.replace(/[^\d+]/g, "");
    return normalizedEmployeePhone === normalizedFrom ||
           normalizedEmployeePhone.endsWith(normalizedFrom.slice(-10)) ||
           normalizedFrom.endsWith(normalizedEmployeePhone.slice(-10));
  });

  if (!employee) {
    // Unknown sender - log and respond
    console.log("Inbound SMS from unknown number:", inboundMessage.from);
    res.type("text/xml");
    res.send(smsProvider.generateResponse("Sorry, we couldn't identify your number. Please contact your supervisor."));
    return;
  }

  // Parse the inbound command
  const parsedCommand = parseInboundCommand(inboundMessage.body);
  let responseMessage: string;

  // Handle each command type
  switch (parsedCommand.type) {
    case 'stop':
      await storage.updateEmployee(employee.id, { smsOptIn: false });
      await logAuditEvent({
        action: "sms_opt_out",
        actor: null,
        targetType: "employee",
        targetId: employee.id,
        targetName: employee.name,
        details: { method: "sms_reply" },
        ipAddress,
      });
      responseMessage = "You have been unsubscribed from SMS notifications. Reply START to re-subscribe.";
      break;

    case 'start':
      await storage.updateEmployee(employee.id, { smsOptIn: true });
      await logAuditEvent({
        action: "sms_opt_in",
        actor: null,
        targetType: "employee",
        targetId: employee.id,
        targetName: employee.name,
        details: { method: "sms_reply" },
        ipAddress,
      });
      responseMessage = "You have been subscribed to SMS notifications. Reply STOP to unsubscribe.";
      break;

    case 'help':
      responseMessage = "[ShiftConnect] Commands:\n" +
        "YES - Express interest in a shift\n" +
        "YES <code> - Interest in specific shift\n" +
        "NO - Decline a shift\n" +
        "CONFIRM - Confirm assigned shift\n" +
        "CANCEL - Withdraw interest/cancel shift\n" +
        "STATUS - Your shifts & interests\n" +
        "SHIFTS - View available shifts\n" +
        "STOP - Unsubscribe\n" +
        "START - Subscribe";
      break;

    case 'status':
      responseMessage = await handleStatus(employee);
      break;

    case 'shifts':
      responseMessage = await handleShifts(employee);
      break;

    case 'interest_yes':
      responseMessage = await handleInterestYes(employee, parsedCommand.shiftCode, ipAddress);
      break;

    case 'interest_no':
      responseMessage = await handleInterestNo(employee, ipAddress);
      break;

    case 'confirm':
      responseMessage = await handleConfirm(employee, ipAddress);
      break;

    case 'cancel':
      responseMessage = await handleCancel(employee, ipAddress);
      break;

    case 'unknown':
    default:
      // Store inbound message for supervisor review
      await storage.createMessage({
        employeeId: employee.id,
        direction: "inbound",
        content: inboundMessage.body,
        status: "delivered",
        providerMessageId: inboundMessage.messageId,
        smsProvider: "twilio",
        messageType: "general",
      });

      await logAuditEvent({
        action: "sms_inbound",
        actor: null,
        targetType: "message",
        targetId: undefined,
        targetName: employee.name,
        details: {
          from: inboundMessage.from,
          body: inboundMessage.body.substring(0, 100),
        },
        ipAddress,
      });

      responseMessage = "Message received. A supervisor will respond shortly. Reply HELP for available commands.";
      break;
  }

  res.type("text/xml");
  res.send(smsProvider.generateResponse(responseMessage));
});

// === Reminder Status and Manual Trigger ===
router.get("/reminders/status", async (req, res) => {
  const user = req.user as any;
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return res.status(403).json({ error: "Access denied" });
  }

  const settings = await getSMSSettings();

  res.json({
    enabled: settings.smsEnabled && settings.shiftReminderEnabled,
    hoursBeforeShift: settings.shiftReminderHours,
    scheduledReminders: getScheduledReminderCount(),
  });
});

router.post("/reminders/process", async (req, res) => {
  const user = req.user as any;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const webhookBaseUrl = getWebhookBaseUrl(req);
  const result = await processShiftReminders(webhookBaseUrl);

  res.json({
    success: true,
    ...result,
  });
});

// === SMS Templates ===
router.get("/templates", async (req, res) => {
  const user = req.user as any;
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return res.status(403).json({ error: "Access denied" });
  }

  const templates = await storage.getSmsTemplates();
  res.json(templates);
});

router.get("/templates/variables", async (req, res) => {
  const user = req.user as any;
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return res.status(403).json({ error: "Access denied" });
  }

  res.json(templateVariables);
});

router.get("/templates/:id", async (req, res) => {
  const user = req.user as any;
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return res.status(403).json({ error: "Access denied" });
  }

  const template = await storage.getSmsTemplate(req.params.id);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }

  res.json(template);
});

router.post("/templates", async (req, res) => {
  const user = req.user as any;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const result = insertSmsTemplateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  // Validate template syntax
  const validation = validateTemplate(result.data.content, result.data.category as TemplateCategory);
  if (!validation.valid) {
    return res.status(400).json({
      error: "Template validation failed",
      errors: validation.errors,
    });
  }

  const template = await storage.createSmsTemplate(result.data);
  res.status(201).json(template);
});

router.patch("/templates/:id", async (req, res) => {
  const user = req.user as any;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const existing = await storage.getSmsTemplate(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "Template not found" });
  }

  // If updating content, validate it
  if (req.body.content) {
    const category = req.body.category || existing.category;
    const validation = validateTemplate(req.body.content, category as TemplateCategory);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Template validation failed",
        errors: validation.errors,
      });
    }
  }

  const template = await storage.updateSmsTemplate(req.params.id, req.body);
  res.json(template);
});

router.delete("/templates/:id", async (req, res) => {
  const user = req.user as any;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const template = await storage.getSmsTemplate(req.params.id);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }

  if (template.isSystem) {
    return res.status(400).json({ error: "Cannot delete system templates" });
  }

  const success = await storage.deleteSmsTemplate(req.params.id);
  if (!success) {
    return res.status(500).json({ error: "Failed to delete template" });
  }

  res.json({ success: true });
});

router.post("/templates/:id/preview", async (req, res) => {
  const user = req.user as any;
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return res.status(403).json({ error: "Access denied" });
  }

  const template = await storage.getSmsTemplate(req.params.id);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }

  const preview = previewTemplate(template.content, template.category as TemplateCategory);
  res.json({
    original: template.content,
    preview,
    category: template.category,
  });
});

router.post("/templates/validate", async (req, res) => {
  const user = req.user as any;
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return res.status(403).json({ error: "Access denied" });
  }

  const { content, category } = req.body;
  if (!content || !category) {
    return res.status(400).json({ error: "Content and category are required" });
  }

  const validation = validateTemplate(content, category as TemplateCategory);
  const preview = previewTemplate(content, category as TemplateCategory);

  res.json({
    ...validation,
    preview,
  });
});

// === Analytics ===
router.get("/analytics", async (req, res) => {
  const user = req.user as any;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const messages = await storage.getMessages();

  // Calculate metrics
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const outboundMessages = messages.filter(m => m.direction === "outbound");
  const inboundMessages = messages.filter(m => m.direction === "inbound");

  const todayMessages = outboundMessages.filter(m => new Date(m.createdAt) >= today);
  const thisWeekMessages = outboundMessages.filter(m => new Date(m.createdAt) >= thisWeekStart);
  const thisMonthMessages = outboundMessages.filter(m => new Date(m.createdAt) >= thisMonthStart);

  const deliveredMessages = outboundMessages.filter(m => m.deliveryStatus === "delivered");
  const failedMessages = outboundMessages.filter(m => m.status === "failed");

  // Calculate segments (cost approximation)
  const totalSegments = outboundMessages.reduce((sum, m) => sum + (m.segments || 1), 0);
  const thisMonthSegments = thisMonthMessages.reduce((sum, m) => sum + (m.segments || 1), 0);

  res.json({
    totals: {
      sent: outboundMessages.length,
      received: inboundMessages.length,
      delivered: deliveredMessages.length,
      failed: failedMessages.length,
      segments: totalSegments,
    },
    today: {
      sent: todayMessages.length,
      segments: todayMessages.reduce((sum, m) => sum + (m.segments || 1), 0),
    },
    thisWeek: {
      sent: thisWeekMessages.length,
      segments: thisWeekMessages.reduce((sum, m) => sum + (m.segments || 1), 0),
    },
    thisMonth: {
      sent: thisMonthMessages.length,
      segments: thisMonthSegments,
    },
    rates: {
      deliveryRate: outboundMessages.length > 0
        ? Math.round((deliveredMessages.length / outboundMessages.length) * 100)
        : 0,
      failureRate: outboundMessages.length > 0
        ? Math.round((failedMessages.length / outboundMessages.length) * 100)
        : 0,
    },
    byType: {
      general: outboundMessages.filter(m => m.messageType === "general").length,
      shiftNotification: outboundMessages.filter(m => m.messageType === "shift_notification").length,
      shiftReminder: outboundMessages.filter(m => m.messageType === "shift_reminder").length,
      shiftConfirmation: outboundMessages.filter(m => m.messageType === "shift_confirmation").length,
      bulk: outboundMessages.filter(m => m.messageType === "bulk").length,
    },
  });
});

// === Conversations ===

// Get all conversations (grouped by employee)
router.get("/conversations", async (req, res) => {
  const user = req.user as any;
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return res.status(403).json({ error: "Access denied" });
  }

  const messages = await storage.getMessages();
  const employees = await storage.getEmployees();

  // Group messages by employee and get conversation summaries
  const conversationMap = new Map<string, {
    employeeId: string;
    employee: any;
    lastMessage: any;
    messageCount: number;
    unreadCount: number;
  }>();

  for (const message of messages) {
    const existing = conversationMap.get(message.employeeId);
    const employee = employees.find(e => e.id === message.employeeId);

    if (!existing) {
      conversationMap.set(message.employeeId, {
        employeeId: message.employeeId,
        employee: employee || null,
        lastMessage: message,
        messageCount: 1,
        unreadCount: message.direction === "inbound" && message.status !== "read" ? 1 : 0,
      });
    } else {
      existing.messageCount++;
      if (message.direction === "inbound" && message.status !== "read") {
        existing.unreadCount++;
      }
      // Keep the most recent message
      if (new Date(message.createdAt) > new Date(existing.lastMessage.createdAt)) {
        existing.lastMessage = message;
      }
    }
  }

  // Convert to array and sort by last message date
  const conversations = Array.from(conversationMap.values())
    .filter(c => c.employee) // Only include conversations with valid employees
    .sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());

  res.json(conversations);
});

// Get conversation with specific employee
router.get("/conversations/:employeeId", async (req, res) => {
  const user = req.user as any;
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return res.status(403).json({ error: "Access denied" });
  }

  const { employeeId } = req.params;
  const employee = await storage.getEmployee(employeeId);

  if (!employee) {
    return res.status(404).json({ error: "Employee not found" });
  }

  const messages = await storage.getEmployeeMessages(employeeId);

  // Sort messages by date (oldest first for chat view)
  const sortedMessages = messages.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  res.json({
    employee,
    messages: sortedMessages,
  });
});

// Mark messages as read
router.post("/conversations/:employeeId/read", async (req, res) => {
  const user = req.user as any;
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return res.status(403).json({ error: "Access denied" });
  }

  const { employeeId } = req.params;
  const messages = await storage.getEmployeeMessages(employeeId);

  // Mark all inbound messages as read
  let updatedCount = 0;
  for (const message of messages) {
    if (message.direction === "inbound" && message.status !== "read") {
      await storage.updateMessage(message.id, { status: "read" });
      updatedCount++;
    }
  }

  res.json({ success: true, updatedCount });
});

export default router;

// Export helper functions for use in other routes
export { getSMSSettings, initializeSMSProvider, isQuietHours, getWebhookBaseUrl };
