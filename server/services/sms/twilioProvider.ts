/**
 * Twilio SMS Provider Implementation
 *
 * Implements the ISMSProvider interface for Twilio's messaging API.
 */

import Twilio from "twilio";
import type { MessageInstance } from "twilio/lib/rest/api/v2010/account/message";
import type {
  ISMSProvider,
  SMSProviderConfig,
  SMSProviderType,
  SendSMSResult,
  InboundMessage,
  DeliveryStatusUpdate,
  DeliveryStatus,
  PhoneValidationResult,
  MessageStatusResult,
  ErrorType,
} from "./types";

// Known Twilio error codes and their classification
const TWILIO_ERROR_CODES: Record<number, ErrorType> = {
  // Recoverable errors (retry)
  20429: "rate_limit", // Too many requests
  30001: "recoverable", // Queue overflow
  30002: "recoverable", // Account suspended (might be temporary)
  30003: "recoverable", // Unreachable destination handset
  30006: "recoverable", // Landline or unreachable carrier
  30007: "recoverable", // Carrier violation

  // Permanent errors (don't retry)
  21211: "permanent", // Invalid 'To' phone number
  21212: "permanent", // Invalid 'From' phone number
  21408: "permanent", // Permission not enabled
  21610: "permanent", // Unsubscribed recipient (STOP)
  21614: "permanent", // 'To' number not verified
  30004: "permanent", // Message blocked
  30005: "permanent", // Unknown destination handset
  30008: "permanent", // Unknown error
};

// Map Twilio status to common DeliveryStatus
const STATUS_MAP: Record<string, DeliveryStatus> = {
  queued: "queued",
  sending: "sending",
  sent: "sent",
  delivered: "delivered",
  undelivered: "undelivered",
  failed: "failed",
  canceled: "canceled",
};

export class TwilioProvider implements ISMSProvider {
  readonly providerType: SMSProviderType = "twilio";

  private client: Twilio.Twilio | null = null;
  private config: SMSProviderConfig | null = null;
  private initialized = false;

  /**
   * Initialize the Twilio client with credentials
   */
  initialize(config: SMSProviderConfig): void {
    if (!config.twilioAccountSid || !config.twilioAuthToken || !config.fromNumber) {
      throw new Error("Missing required Twilio configuration: accountSid, authToken, and fromNumber are required");
    }

    this.config = config;
    this.client = Twilio(config.twilioAccountSid, config.twilioAuthToken);
    this.initialized = true;
  }

  /**
   * Check if the service is initialized and ready
   */
  isInitialized(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Partial<SMSProviderConfig> | null {
    if (!this.config) return null;
    return {
      provider: this.providerType,
      fromNumber: this.config.fromNumber,
      twilioMessagingServiceSid: this.config.twilioMessagingServiceSid,
    };
  }

  /**
   * Validate E.164 phone number format
   */
  validatePhoneNumber(phone: string): PhoneValidationResult {
    // Remove all non-numeric characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, "");

    // Add + if not present and starts with country code
    if (!cleaned.startsWith("+")) {
      // Assume US number if 10 digits
      if (cleaned.length === 10) {
        cleaned = "+1" + cleaned;
      } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
        cleaned = "+" + cleaned;
      } else {
        cleaned = "+" + cleaned;
      }
    }

    // E.164 validation: + followed by 1-15 digits
    const e164Regex = /^\+[1-9]\d{1,14}$/;

    if (!e164Regex.test(cleaned)) {
      return {
        valid: false,
        error: "Phone number must be in E.164 format (e.g., +15551234567)",
      };
    }

    return { valid: true, formatted: cleaned };
  }

  /**
   * Send an SMS message
   */
  async sendSMS(
    to: string,
    body: string,
    statusCallback?: string
  ): Promise<SendSMSResult> {
    if (!this.client || !this.config) {
      return {
        success: false,
        errorCode: "NOT_INITIALIZED",
        errorMessage: "Twilio provider not initialized",
      };
    }

    // Validate phone number
    const validation = this.validatePhoneNumber(to);
    if (!validation.valid) {
      return {
        success: false,
        errorCode: "INVALID_PHONE",
        errorMessage: validation.error,
      };
    }

    try {
      const messageOptions: {
        to: string;
        body: string;
        from?: string;
        messagingServiceSid?: string;
        statusCallback?: string;
      } = {
        to: validation.formatted!,
        body,
      };

      // Use messaging service if configured, otherwise use from number
      if (this.config.twilioMessagingServiceSid) {
        messageOptions.messagingServiceSid = this.config.twilioMessagingServiceSid;
      } else {
        messageOptions.from = this.config.fromNumber;
      }

      // Add status callback URL if provided
      if (statusCallback) {
        messageOptions.statusCallback = statusCallback;
      }

      const message: MessageInstance = await this.client.messages.create(messageOptions);

      return {
        success: true,
        messageId: message.sid,
        providerMessageId: message.sid,
        status: message.status,
        segments: message.numSegments ? parseInt(message.numSegments) : 1,
      };
    } catch (error: unknown) {
      const twilioError = this.classifyError(error);
      return {
        success: false,
        errorCode: twilioError.code.toString(),
        errorMessage: twilioError.message,
      };
    }
  }

  /**
   * Send SMS with retry logic for recoverable errors
   */
  async sendSMSWithRetry(
    to: string,
    body: string,
    statusCallback?: string,
    maxRetries = 3,
    initialDelayMs = 1000
  ): Promise<SendSMSResult> {
    let lastResult: SendSMSResult | null = null;
    let delay = initialDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.sendSMS(to, body, statusCallback);
      lastResult = result;

      if (result.success) {
        return result;
      }

      // Check if error is recoverable
      const errorCode = parseInt(result.errorCode || "0");
      const errorType = TWILIO_ERROR_CODES[errorCode] || "permanent";

      if (errorType === "permanent") {
        // Don't retry permanent errors
        return result;
      }

      if (attempt < maxRetries) {
        // Wait before retrying with exponential backoff
        await this.sleep(delay);
        delay *= 2; // Exponential backoff
      }
    }

    return lastResult!;
  }

  /**
   * Parse and validate Twilio webhook signature
   */
  validateWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, string>
  ): boolean {
    if (!this.config?.twilioAuthToken) return false;

    return Twilio.validateRequest(
      this.config.twilioAuthToken,
      signature,
      url,
      params
    );
  }

  /**
   * Parse inbound message from webhook
   */
  parseInboundMessage(body: Record<string, string>): InboundMessage {
    const message: InboundMessage = {
      messageId: body.MessageSid || body.SmsSid,
      from: body.From,
      to: body.To,
      body: body.Body || "",
      numMedia: parseInt(body.NumMedia || "0"),
      provider: this.providerType,
      rawPayload: body,
    };

    // Extract media URLs if present
    if (message.numMedia > 0) {
      message.mediaUrls = [];
      for (let i = 0; i < message.numMedia; i++) {
        const mediaUrl = body[`MediaUrl${i}`];
        if (mediaUrl) {
          message.mediaUrls.push(mediaUrl);
        }
      }
    }

    return message;
  }

  /**
   * Parse delivery status from webhook
   */
  parseDeliveryStatus(body: Record<string, string>): DeliveryStatusUpdate {
    const rawStatus = body.MessageStatus || body.SmsStatus || "unknown";
    return {
      messageId: body.MessageSid || body.SmsSid,
      status: STATUS_MAP[rawStatus] || "failed",
      errorCode: body.ErrorCode,
      errorMessage: body.ErrorMessage,
      provider: this.providerType,
    };
  }

  /**
   * Generate TwiML response for inbound messages
   */
  generateResponse(message?: string): string {
    if (!message) {
      return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    }

    // Escape XML special characters
    const escaped = message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

    return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
  }

  /**
   * Check if an error is recoverable
   */
  isRecoverableError(errorCode: string | number): boolean {
    const code = typeof errorCode === "string" ? parseInt(errorCode) : errorCode;
    const type = TWILIO_ERROR_CODES[code];
    return type === "recoverable" || type === "rate_limit";
  }

  /**
   * Get message by SID (for checking status)
   */
  async getMessageStatus(messageSid: string): Promise<MessageStatusResult | null> {
    if (!this.client) return null;

    try {
      const message = await this.client.messages(messageSid).fetch();
      return {
        status: message.status,
        errorCode: message.errorCode?.toString(),
        errorMessage: message.errorMessage || undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Classify Twilio error
   */
  private classifyError(error: unknown): { code: number; message: string; type: ErrorType } {
    const err = error as { code?: number; message?: string };
    const code = err.code || 0;
    const message = err.message || "Unknown error";
    const type = TWILIO_ERROR_CODES[code] || "permanent";

    return { code, message, type };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
