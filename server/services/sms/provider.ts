/**
 * SMS Provider Factory
 *
 * Creates and manages SMS providers based on configuration.
 * Allows switching between Twilio and RingCentral at runtime.
 */

import type {
  ISMSProvider,
  SMSProviderConfig,
  SMSProviderType,
  SendSMSResult,
  InboundMessage,
  DeliveryStatusUpdate,
  PhoneValidationResult,
  MessageStatusResult,
} from "./types";
import { TwilioProvider } from "./twilioProvider";
import { RingCentralProvider } from "./ringcentralProvider";

/**
 * SMS Provider Factory
 *
 * Manages the lifecycle of SMS providers and provides a unified
 * interface for sending messages regardless of the underlying provider.
 */
class SMSProviderFactory {
  private currentProvider: ISMSProvider | null = null;
  private currentProviderType: SMSProviderType | null = null;
  private config: SMSProviderConfig | null = null;

  /**
   * Initialize the SMS provider based on configuration
   * @param config Provider configuration including credentials
   * @returns The initialized provider instance
   */
  initialize(config: SMSProviderConfig): ISMSProvider {
    // If provider type changed or not initialized, create new provider
    if (this.currentProviderType !== config.provider || !this.currentProvider) {
      // Dispose of existing provider if switching
      if (this.currentProvider?.dispose) {
        this.currentProvider.dispose().catch(console.error);
      }

      // Create the appropriate provider based on config
      if (config.provider === "ringcentral") {
        this.currentProvider = new RingCentralProvider();
      } else {
        // Default to Twilio
        this.currentProvider = new TwilioProvider();
      }

      this.currentProviderType = config.provider;
    }

    // Initialize the provider with config
    this.currentProvider.initialize(config);
    this.config = config;

    return this.currentProvider;
  }

  /**
   * Get the current provider instance
   */
  getProvider(): ISMSProvider | null {
    return this.currentProvider;
  }

  /**
   * Get the current provider type
   */
  getProviderType(): SMSProviderType | null {
    return this.currentProviderType;
  }

  /**
   * Check if a provider is initialized and ready
   */
  isInitialized(): boolean {
    return this.currentProvider?.isInitialized() ?? false;
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Partial<SMSProviderConfig> | null {
    return this.currentProvider?.getConfig() ?? null;
  }

  // Convenience methods that delegate to the current provider

  /**
   * Send an SMS message using the current provider
   */
  async sendSMS(to: string, body: string, statusCallback?: string): Promise<SendSMSResult> {
    if (!this.currentProvider) {
      return {
        success: false,
        errorCode: "NO_PROVIDER",
        errorMessage: "No SMS provider initialized",
      };
    }
    return this.currentProvider.sendSMS(to, body, statusCallback);
  }

  /**
   * Send SMS with retry using the current provider
   */
  async sendSMSWithRetry(
    to: string,
    body: string,
    statusCallback?: string,
    maxRetries?: number,
    initialDelayMs?: number
  ): Promise<SendSMSResult> {
    if (!this.currentProvider) {
      return {
        success: false,
        errorCode: "NO_PROVIDER",
        errorMessage: "No SMS provider initialized",
      };
    }
    return this.currentProvider.sendSMSWithRetry(to, body, statusCallback, maxRetries, initialDelayMs);
  }

  /**
   * Validate phone number using the current provider
   */
  validatePhoneNumber(phone: string): PhoneValidationResult {
    if (!this.currentProvider) {
      return { valid: false, error: "No SMS provider initialized" };
    }
    return this.currentProvider.validatePhoneNumber(phone);
  }

  /**
   * Validate webhook signature using the current provider
   */
  validateWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, string>
  ): boolean {
    if (!this.currentProvider) return false;
    return this.currentProvider.validateWebhookSignature(signature, url, params);
  }

  /**
   * Parse inbound message using the current provider
   */
  parseInboundMessage(body: Record<string, string>): InboundMessage | null {
    if (!this.currentProvider) return null;
    return this.currentProvider.parseInboundMessage(body);
  }

  /**
   * Parse delivery status using the current provider
   */
  parseDeliveryStatus(body: Record<string, string>): DeliveryStatusUpdate | null {
    if (!this.currentProvider) return null;
    return this.currentProvider.parseDeliveryStatus(body);
  }

  /**
   * Generate webhook response using the current provider
   */
  generateResponse(message?: string): string {
    if (!this.currentProvider) return "";
    return this.currentProvider.generateResponse(message);
  }

  /**
   * Check if error is recoverable using the current provider
   */
  isRecoverableError(errorCode: string | number): boolean {
    if (!this.currentProvider) return false;
    return this.currentProvider.isRecoverableError(errorCode);
  }

  /**
   * Get message status using the current provider
   */
  async getMessageStatus(messageId: string): Promise<MessageStatusResult | null> {
    if (!this.currentProvider) return null;
    return this.currentProvider.getMessageStatus(messageId);
  }

  /**
   * Dispose of the current provider and cleanup resources
   */
  async dispose(): Promise<void> {
    if (this.currentProvider?.dispose) {
      await this.currentProvider.dispose();
    }
    this.currentProvider = null;
    this.currentProviderType = null;
    this.config = null;
  }
}

// Export singleton instance
export const smsProvider = new SMSProviderFactory();

// Export class for testing
export { SMSProviderFactory };
