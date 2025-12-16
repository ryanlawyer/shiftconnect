/**
 * RingCentral SMS Provider Implementation
 *
 * Implements the ISMSProvider interface for RingCentral's messaging API.
 */

import { SDK } from "@ringcentral/sdk";
import type {
  ISMSProvider,
  ISubscriptionSMSProvider,
  SMSProviderConfig,
  SMSProviderType,
  SendSMSResult,
  InboundMessage,
  DeliveryStatusUpdate,
  DeliveryStatus,
  PhoneValidationResult,
  MessageStatusResult,
  ErrorType,
  SMSProviderEvents,
} from "./types";

// Known RingCentral error codes and their classification
const RINGCENTRAL_ERROR_CODES: Record<string, ErrorType> = {
  // Recoverable errors (retry)
  "CMN-301": "rate_limit", // Request rate exceeded
  "CMN-302": "rate_limit", // Unknown rate limit
  "MSG-240": "recoverable", // Sending SMS is temporarily unavailable
  "MSG-245": "recoverable", // Recipient phone is temporarily unavailable

  // Permanent errors (don't retry)
  "MSG-241": "permanent", // Outbound SMS is disabled
  "MSG-242": "permanent", // Invalid recipient phone number
  "MSG-243": "permanent", // Phone number not in service
  "MSG-244": "permanent", // Recipient opted out
  "MSG-246": "permanent", // Recipient spam filter
  "MSG-247": "permanent", // Message text is empty
  "MSG-304": "permanent", // Invalid extension
  "MSG-324": "permanent", // Phone not capable of SMS
  "MSG-331": "permanent", // Invalid caller ID
  "MSG-402": "permanent", // Message sending failed
};

// Map RingCentral message status to common DeliveryStatus
const STATUS_MAP: Record<string, DeliveryStatus> = {
  Queued: "queued",
  Sent: "sent",
  Delivered: "delivered",
  DeliveryFailed: "failed",
  SendingFailed: "failed",
  Received: "delivered",
};

// RingCentral API response types
interface RCMessageResponse {
  id: string;
  uri: string;
  to: Array<{ phoneNumber: string; messageStatus?: string }>;
  from: { phoneNumber: string };
  type: string;
  creationTime: string;
  readStatus: string;
  priority: string;
  attachments?: Array<{ id: string; uri: string; type: string; contentType: string }>;
  direction: string;
  availability: string;
  subject?: string;
  messageStatus: string;
  smsSendingAttemptsCount?: number;
  conversationId?: string;
  lastModifiedTime?: string;
}

interface RCSubscriptionResponse {
  id: string;
  uri: string;
  eventFilters: string[];
  expirationTime: string;
  expiresIn: number;
  status: string;
  deliveryMode: {
    transportType: string;
    address?: string;
  };
}

export class RingCentralProvider implements ISMSProvider, ISubscriptionSMSProvider {
  readonly providerType: SMSProviderType = "ringcentral";

  private sdk: SDK | null = null;
  private platform: ReturnType<SDK["platform"]> | null = null;
  private config: SMSProviderConfig | null = null;
  private initialized = false;
  private subscriptions: Map<string, SMSProviderEvents> = new Map();

  /**
   * Initialize the RingCentral SDK with credentials
   */
  initialize(config: SMSProviderConfig): void {
    if (!config.ringcentralClientId || !config.ringcentralClientSecret || !config.fromNumber) {
      throw new Error(
        "Missing required RingCentral configuration: clientId, clientSecret, and fromNumber are required"
      );
    }

    if (!config.ringcentralJwt) {
      throw new Error("Missing RingCentral JWT token for authentication");
    }

    this.config = config;

    // Initialize the SDK
    this.sdk = new SDK({
      server: config.ringcentralServerUrl || "https://platform.ringcentral.com",
      clientId: config.ringcentralClientId,
      clientSecret: config.ringcentralClientSecret,
    });

    this.platform = this.sdk.platform();
    
    // Mark as initialized - actual auth will happen on first API call via ensureAuthenticated
    this.initialized = true;
  }
  
  /**
   * Initialize and authenticate - async version for explicit auth
   */
  async initializeAsync(config: SMSProviderConfig): Promise<boolean> {
    this.initialize(config);
    return this.ensureAuthenticated();
  }

  /**
   * Async authentication (called from initialize)
   */
  private async authenticateAsync(): Promise<void> {
    if (!this.platform || !this.config?.ringcentralJwt) return;

    try {
      await this.platform.login({ jwt: this.config.ringcentralJwt });
      this.initialized = true;
      console.log("RingCentral provider initialized successfully");
    } catch (error) {
      console.error("RingCentral authentication failed:", error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Ensure platform is authenticated before making API calls
   */
  private async ensureAuthenticated(): Promise<boolean> {
    if (!this.platform) return false;

    try {
      const loggedIn = await this.platform.loggedIn();
      if (!loggedIn && this.config?.ringcentralJwt) {
        await this.platform.login({ jwt: this.config.ringcentralJwt });
      }
      this.initialized = true;
      return true;
    } catch {
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if the service is initialized and ready
   */
  isInitialized(): boolean {
    return this.initialized && this.sdk !== null;
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Partial<SMSProviderConfig> | null {
    if (!this.config) return null;
    return {
      provider: this.providerType,
      fromNumber: this.config.fromNumber,
      ringcentralServerUrl: this.config.ringcentralServerUrl,
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
    _statusCallback?: string // RingCentral uses subscription-based status updates
  ): Promise<SendSMSResult> {
    if (!this.platform || !this.config) {
      return {
        success: false,
        errorCode: "NOT_INITIALIZED",
        errorMessage: "RingCentral provider not initialized",
      };
    }

    // Ensure we're authenticated
    const isAuth = await this.ensureAuthenticated();
    if (!isAuth) {
      return {
        success: false,
        errorCode: "AUTH_FAILED",
        errorMessage: "RingCentral authentication failed",
      };
    }

    // Validate and format recipient phone number
    const toValidation = this.validatePhoneNumber(to);
    if (!toValidation.valid) {
      return {
        success: false,
        errorCode: "INVALID_PHONE",
        errorMessage: toValidation.error,
      };
    }

    // Validate and format the from number (must be E.164)
    const fromValidation = this.validatePhoneNumber(this.config.fromNumber);
    if (!fromValidation.valid) {
      console.error("RingCentral: Invalid from number format:", this.config.fromNumber);
      return {
        success: false,
        errorCode: "INVALID_FROM_NUMBER",
        errorMessage: `From number must be in E.164 format: ${fromValidation.error}`,
      };
    }

    try {
      console.log(`RingCentral: Sending SMS from ${fromValidation.formatted} to ${toValidation.formatted}`);
      
      const response = await this.platform.post("/restapi/v1.0/account/~/extension/~/sms", {
        from: { phoneNumber: fromValidation.formatted },
        to: [{ phoneNumber: toValidation.formatted }],
        text: body,
      });

      const data = (await response.json()) as RCMessageResponse;

      // Check for delivery status in response
      const recipientStatus = data.to?.[0]?.messageStatus;
      const messageStatus = recipientStatus || data.messageStatus;
      
      console.log(`RingCentral: SMS sent, messageId=${data.id}, status=${messageStatus}`);

      return {
        success: messageStatus !== "SendingFailed" && messageStatus !== "DeliveryFailed",
        messageId: data.id,
        providerMessageId: data.id,
        status: STATUS_MAP[messageStatus] || messageStatus,
        segments: 1, // RingCentral doesn't return segment count directly
      };
    } catch (error: unknown) {
      const rcError = this.classifyError(error);
      console.error(`RingCentral: SMS send failed - code=${rcError.code}, message=${rcError.message}`);
      return {
        success: false,
        errorCode: rcError.code,
        errorMessage: rcError.message,
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
      const errorType = RINGCENTRAL_ERROR_CODES[result.errorCode || ""] || "permanent";

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
   * Validate webhook - RingCentral uses validation token during subscription
   * For incoming webhooks, verify the subscription ID matches
   */
  validateWebhookSignature(
    _signature: string,
    _url: string,
    params: Record<string, string>
  ): boolean {
    // RingCentral webhooks include validation token during setup
    // For regular webhooks, we verify the subscription ID
    const subscriptionId = params.subscriptionId;
    if (subscriptionId && this.subscriptions.has(subscriptionId)) {
      return true;
    }

    // Also accept if we have any active subscriptions and this looks like a valid payload
    if (params.event || params.body) {
      return true;
    }

    return false;
  }

  /**
   * Parse inbound message from webhook payload
   */
  parseInboundMessage(body: Record<string, string>): InboundMessage {
    // RingCentral webhook payload structure is different
    const payload = body.body ? JSON.parse(body.body as string) : body;

    return {
      messageId: payload.id || payload.uuid || "",
      from: payload.from?.phoneNumber || payload.from || "",
      to: payload.to?.[0]?.phoneNumber || payload.to || "",
      body: payload.subject || payload.text || "",
      numMedia: payload.attachments?.length || 0,
      mediaUrls: payload.attachments?.map((a: { uri: string }) => a.uri) || [],
      provider: this.providerType,
      rawPayload: body,
    };
  }

  /**
   * Parse delivery status from webhook payload
   */
  parseDeliveryStatus(body: Record<string, string>): DeliveryStatusUpdate {
    const payload = body.body ? JSON.parse(body.body as string) : body;

    const rawStatus = payload.messageStatus || payload.status || "unknown";

    return {
      messageId: payload.id || payload.messageId || "",
      status: STATUS_MAP[rawStatus] || "failed",
      errorCode: payload.errorCode,
      errorMessage: payload.errorMessage,
      timestamp: payload.lastModifiedTime ? new Date(payload.lastModifiedTime) : undefined,
      provider: this.providerType,
    };
  }

  /**
   * Generate response for inbound message webhook
   * RingCentral just expects HTTP 200, no special format needed
   */
  generateResponse(message?: string): string {
    // RingCentral doesn't use TwiML - just return plain text or empty
    return message || "OK";
  }

  /**
   * Check if an error is recoverable
   */
  isRecoverableError(errorCode: string | number): boolean {
    const code = String(errorCode);
    const type = RINGCENTRAL_ERROR_CODES[code];
    return type === "recoverable" || type === "rate_limit";
  }

  /**
   * Get message status by ID
   */
  async getMessageStatus(messageId: string): Promise<MessageStatusResult | null> {
    if (!this.platform) return null;

    const isAuth = await this.ensureAuthenticated();
    if (!isAuth) return null;

    try {
      const response = await this.platform.get(
        `/restapi/v1.0/account/~/extension/~/message-store/${messageId}`
      );
      const data = (await response.json()) as RCMessageResponse;

      return {
        status: STATUS_MAP[data.messageStatus] || data.messageStatus,
        errorCode: undefined,
        errorMessage: undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Subscribe to SMS events via webhooks
   */
  async subscribe(events: SMSProviderEvents): Promise<string> {
    if (!this.platform) {
      throw new Error("RingCentral provider not initialized");
    }

    const isAuth = await this.ensureAuthenticated();
    if (!isAuth) {
      throw new Error("RingCentral authentication failed");
    }

    // Define event filters based on what events are requested
    const eventFilters: string[] = [];

    if (events.onInboundMessage) {
      eventFilters.push("/restapi/v1.0/account/~/extension/~/message-store/instant?type=SMS");
    }

    if (events.onDeliveryStatus) {
      eventFilters.push("/restapi/v1.0/account/~/extension/~/message-store");
    }

    if (events.onOptOut || events.onOptIn) {
      eventFilters.push("/restapi/v2/accounts/~/sms/consents");
    }

    if (eventFilters.length === 0) {
      throw new Error("No event handlers provided for subscription");
    }

    try {
      const response = await this.platform.post("/restapi/v1.0/subscription", {
        eventFilters,
        deliveryMode: {
          transportType: "WebHook",
          // Address will be set by the caller or use PubNub for real-time
        },
      });

      const data = (await response.json()) as RCSubscriptionResponse;
      const subscriptionId = data.id;

      // Store the event handlers
      this.subscriptions.set(subscriptionId, events);

      return subscriptionId;
    } catch (error) {
      console.error("Failed to create RingCentral subscription:", error);
      throw error;
    }
  }

  /**
   * Unsubscribe from SMS events
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    if (!this.platform) return;

    const isAuth = await this.ensureAuthenticated();
    if (!isAuth) return;

    try {
      await this.platform.delete(`/restapi/v1.0/subscription/${subscriptionId}`);
      this.subscriptions.delete(subscriptionId);
    } catch (error) {
      console.error("Failed to delete RingCentral subscription:", error);
    }
  }

  /**
   * Renew subscription before it expires
   */
  async renewSubscription(subscriptionId: string): Promise<void> {
    if (!this.platform) return;

    const isAuth = await this.ensureAuthenticated();
    if (!isAuth) return;

    try {
      await this.platform.post(`/restapi/v1.0/subscription/${subscriptionId}/renew`);
    } catch (error) {
      console.error("Failed to renew RingCentral subscription:", error);
      throw error;
    }
  }

  /**
   * Check subscription status
   */
  async getSubscriptionStatus(subscriptionId: string): Promise<{
    active: boolean;
    expiresAt?: Date;
  }> {
    if (!this.platform) {
      return { active: false };
    }

    const isAuth = await this.ensureAuthenticated();
    if (!isAuth) {
      return { active: false };
    }

    try {
      const response = await this.platform.get(`/restapi/v1.0/subscription/${subscriptionId}`);
      const data = (await response.json()) as RCSubscriptionResponse;

      return {
        active: data.status === "Active",
        expiresAt: data.expirationTime ? new Date(data.expirationTime) : undefined,
      };
    } catch {
      return { active: false };
    }
  }

  /**
   * Handle incoming webhook event and dispatch to appropriate handler
   */
  handleWebhookEvent(subscriptionId: string, event: Record<string, unknown>): void {
    const handlers = this.subscriptions.get(subscriptionId);
    if (!handlers) return;

    const eventType = event.event as string;
    const body = event.body as Record<string, unknown>;

    try {
      // Determine event type and call appropriate handler
      if (eventType?.includes("message-store/instant") && handlers.onInboundMessage) {
        const message = this.parseInboundMessage(body as Record<string, string>);
        handlers.onInboundMessage(message);
      } else if (eventType?.includes("message-store") && handlers.onDeliveryStatus) {
        const status = this.parseDeliveryStatus(body as Record<string, string>);
        handlers.onDeliveryStatus(status);
      } else if (eventType?.includes("sms/consents")) {
        const records = (body.records as Array<{ optStatus: string; to: string; from: string }>) || [];
        for (const record of records) {
          if (record.optStatus === "OptOut" && handlers.onOptOut) {
            handlers.onOptOut(record.to, record.from);
          } else if (record.optStatus === "OptIn" && handlers.onOptIn) {
            handlers.onOptIn(record.to, record.from);
          }
        }
      }
    } catch (error) {
      if (handlers.onError) {
        handlers.onError(error as Error);
      }
    }
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    // Unsubscribe from all subscriptions
    const subscriptionIds = Array.from(this.subscriptions.keys());
    for (const subscriptionId of subscriptionIds) {
      await this.unsubscribe(subscriptionId);
    }

    // Logout from platform
    if (this.platform) {
      try {
        await this.platform.logout();
      } catch {
        // Ignore logout errors during disposal
      }
    }

    this.sdk = null;
    this.platform = null;
    this.initialized = false;
  }

  /**
   * Classify RingCentral error
   */
  private classifyError(error: unknown): { code: string; message: string; type: ErrorType } {
    // RingCentral SDK may throw errors in different formats
    const err = error as {
      response?: { 
        data?: { errorCode?: string; message?: string };
        json?: () => Promise<{ errorCode?: string; message?: string }>;
        status?: number;
      };
      message?: string;
      apiError?: {
        errorCode?: string;
        message?: string;
      };
    };

    let code = "UNKNOWN";
    let message = "Unknown error";

    // Try multiple ways to extract error info from RingCentral SDK
    if (err.apiError?.errorCode) {
      code = err.apiError.errorCode;
      message = err.apiError.message || message;
    } else if (err.response?.data?.errorCode) {
      code = err.response.data.errorCode;
      message = err.response.data.message || message;
    } else if (err.message) {
      message = err.message;
      // Check for rate limit in message
      if (err.message.includes("429") || err.message.toLowerCase().includes("rate limit")) {
        code = "CMN-301";
      }
      // Check for auth errors
      if (err.message.includes("401") || err.message.toLowerCase().includes("unauthorized")) {
        code = "AUTH_FAILED";
      }
    }
    
    // Log full error for debugging
    console.error("RingCentral error details:", JSON.stringify({
      code,
      message,
      rawError: err.message,
      responseStatus: err.response?.status,
    }));

    const type = RINGCENTRAL_ERROR_CODES[code] || "permanent";

    return { code, message, type };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
