/**
 * Phone number formatting utilities
 * Handles conversion between user-friendly display format and E.164 storage format
 */

/**
 * Strips all non-digit characters from a phone number
 */
export function stripPhoneFormatting(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Formats a phone number for display as (555) 123-4567
 * Accepts various input formats including E.164 (+15551234567) or raw digits
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  
  // Strip all non-digits
  let digits = stripPhoneFormatting(phone);
  
  // Remove leading 1 if present (country code)
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  
  // If not exactly 10 digits, return original
  if (digits.length !== 10) {
    return phone;
  }
  
  // Format as (XXX) XXX-XXXX
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Formats a phone number for display as user types (partial formatting)
 * This provides real-time formatting feedback
 */
export function formatPhoneAsYouType(digits: string): string {
  // Only work with digits
  const cleaned = digits.replace(/\D/g, "");
  
  // Limit to 10 digits
  const limited = cleaned.slice(0, 10);
  
  if (limited.length === 0) return "";
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

/**
 * Converts a phone number to E.164 format (+1XXXXXXXXXX)
 * Used for storage and SMS sending
 */
export function toE164(phone: string | null | undefined): string {
  if (!phone) return "";
  
  // Strip all non-digits
  let digits = stripPhoneFormatting(phone);
  
  // Remove leading 1 if present
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  
  // If not exactly 10 digits, return as-is (may already be formatted or invalid)
  if (digits.length !== 10) {
    // If it already starts with +, return as-is
    if (phone.startsWith("+")) {
      return phone;
    }
    return phone;
  }
  
  // Return in E.164 format
  return `+1${digits}`;
}

/**
 * Validates that a phone number has exactly 10 digits (after stripping formatting)
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return false;
  
  let digits = stripPhoneFormatting(phone);
  
  // Remove leading 1 if present
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  
  return digits.length === 10;
}

/**
 * Extracts just the 10 digits from any phone format
 */
export function extractDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  
  let digits = stripPhoneFormatting(phone);
  
  // Remove leading 1 if present
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  
  return digits.slice(0, 10);
}
