/**
 * SMS Provider Module
 *
 * Provides a unified interface for SMS messaging that supports
 * multiple providers (Twilio, RingCentral) based on configuration.
 *
 * Usage:
 * ```typescript
 * import { smsProvider, type SMSProviderType } from './services/sms';
 *
 * // Initialize with Twilio
 * smsProvider.initialize({
 *   provider: 'twilio',
 *   fromNumber: '+15551234567',
 *   twilioAccountSid: 'AC...',
 *   twilioAuthToken: '...',
 * });
 *
 * // Or initialize with RingCentral
 * smsProvider.initialize({
 *   provider: 'ringcentral',
 *   fromNumber: '+15551234567',
 *   ringcentralClientId: '...',
 *   ringcentralClientSecret: '...',
 *   ringcentralJwt: '...',
 * });
 *
 * // Send SMS (works with either provider)
 * const result = await smsProvider.sendSMS('+15559876543', 'Hello!');
 * ```
 */

// Export types
export type {
  SMSProviderType,
  SMSProviderConfig,
  SendSMSResult,
  DeliveryStatus,
  InboundMessage,
  DeliveryStatusUpdate,
  ErrorType,
  PhoneValidationResult,
  MessageStatusResult,
  ISMSProvider,
  ISubscriptionSMSProvider,
  SMSProviderEvents,
} from "./types";

// Export provider factory (singleton)
export { smsProvider, SMSProviderFactory } from "./provider";

// Export individual providers for direct use if needed
export { TwilioProvider } from "./twilioProvider";
export { RingCentralProvider } from "./ringcentralProvider";
