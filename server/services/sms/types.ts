/**
 * SMS Provider Abstraction Types
 *
 * Defines common interfaces for SMS providers (Twilio, RingCentral, etc.)
 * allowing the application to switch between providers based on configuration.
 */

// Supported SMS provider types
export type SMSProviderType = "twilio" | "ringcentral";

// Provider configuration - contains credentials for all providers
export interface SMSProviderConfig {
  provider: SMSProviderType;
  fromNumber: string;

  // Twilio-specific configuration
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioMessagingServiceSid?: string;

  // RingCentral-specific configuration
  ringcentralClientId?: string;
  ringcentralClientSecret?: string;
  ringcentralServerUrl?: string;
  ringcentralJwt?: string;
}

// Result of sending an SMS
export interface SendSMSResult {
  success: boolean;
  messageId?: string; // Provider-agnostic message ID
  providerMessageId?: string; // Original provider-specific ID (Twilio SID, RC message ID)
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  segments?: number;
}

// Delivery status values (common across providers)
export type DeliveryStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "undelivered"
  | "failed"
  | "canceled";

// Inbound message from webhook
export interface InboundMessage {
  messageId: string;
  from: string;
  to: string;
  body: string;
  numMedia: number;
  mediaUrls?: string[];
  provider: SMSProviderType;
  rawPayload?: Record<string, unknown>;
}

// Parsed delivery status from webhook
export interface DeliveryStatusUpdate {
  messageId: string;
  status: DeliveryStatus;
  errorCode?: string;
  errorMessage?: string;
  timestamp?: Date;
  provider: SMSProviderType;
}

// Error classification for retry logic
export type ErrorType = "recoverable" | "permanent" | "rate_limit";

// Phone number validation result
export interface PhoneValidationResult {
  valid: boolean;
  formatted?: string;
  error?: string;
}

// Message status query result
export interface MessageStatusResult {
  status: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * SMS Provider Interface
 *
 * All SMS providers must implement this interface to ensure
 * consistent behavior across the application.
 */
export interface ISMSProvider {
  /** The type of this provider */
  readonly providerType: SMSProviderType;

  /**
   * Initialize the provider with configuration
   * @throws Error if configuration is invalid
   */
  initialize(config: SMSProviderConfig): void;

  /**
   * Check if the provider is initialized and ready to send messages
   */
  isInitialized(): boolean;

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Partial<SMSProviderConfig> | null;

  /**
   * Validate and format a phone number to E.164 format
   */
  validatePhoneNumber(phone: string): PhoneValidationResult;

  /**
   * Send an SMS message
   * @param to Recipient phone number
   * @param body Message content
   * @param statusCallback Optional webhook URL for delivery status updates
   */
  sendSMS(to: string, body: string, statusCallback?: string): Promise<SendSMSResult>;

  /**
   * Send SMS with automatic retry for recoverable errors
   * @param to Recipient phone number
   * @param body Message content
   * @param statusCallback Optional webhook URL for delivery status updates
   * @param maxRetries Maximum number of retry attempts (default: 3)
   * @param initialDelayMs Initial delay between retries in ms (default: 1000)
   */
  sendSMSWithRetry(
    to: string,
    body: string,
    statusCallback?: string,
    maxRetries?: number,
    initialDelayMs?: number
  ): Promise<SendSMSResult>;

  /**
   * Validate webhook signature/authenticity
   * @param signature Signature header from webhook request
   * @param url Full URL of the webhook endpoint
   * @param params Request body/parameters
   */
  validateWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, string>
  ): boolean;

  /**
   * Parse inbound message from webhook payload
   */
  parseInboundMessage(body: Record<string, string>): InboundMessage;

  /**
   * Parse delivery status update from webhook payload
   */
  parseDeliveryStatus(body: Record<string, string>): DeliveryStatusUpdate;

  /**
   * Generate response for inbound message webhook
   * (TwiML for Twilio, plain response for others)
   */
  generateResponse(message?: string): string;

  /**
   * Check if an error code indicates a recoverable error
   */
  isRecoverableError(errorCode: string | number): boolean;

  /**
   * Get message status by provider message ID
   */
  getMessageStatus(messageId: string): Promise<MessageStatusResult | null>;

  /**
   * Cleanup/dispose of provider resources
   */
  dispose?(): Promise<void>;
}

/**
 * SMS Provider Events
 * Used for subscription-based providers like RingCentral
 */
export interface SMSProviderEvents {
  onInboundMessage?: (message: InboundMessage) => void;
  onDeliveryStatus?: (status: DeliveryStatusUpdate) => void;
  onOptOut?: (phoneNumber: string, fromNumber: string) => void;
  onOptIn?: (phoneNumber: string, fromNumber: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Extended provider interface for subscription-based providers
 */
export interface ISubscriptionSMSProvider extends ISMSProvider {
  /**
   * Subscribe to SMS events (inbound, delivery status, opt-out)
   */
  subscribe(events: SMSProviderEvents): Promise<string>;

  /**
   * Unsubscribe from SMS events
   */
  unsubscribe(subscriptionId: string): Promise<void>;

  /**
   * Renew subscription (for providers with expiring subscriptions)
   */
  renewSubscription(subscriptionId: string): Promise<void>;

  /**
   * Check subscription status
   */
  getSubscriptionStatus(subscriptionId: string): Promise<{
    active: boolean;
    expiresAt?: Date;
  }>;
}
