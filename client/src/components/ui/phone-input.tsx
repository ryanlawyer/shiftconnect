import { forwardRef, useState, useEffect } from "react";
import { Input } from "./input";
import { formatPhoneAsYouType, extractDigits, toE164 } from "@/lib/phoneUtils";
import { cn } from "@/lib/utils";

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: string;
  onChange?: (value: string) => void;
  onE164Change?: (e164Value: string) => void;
}

/**
 * Phone input component that accepts 10-digit input and auto-formats as (555) 123-4567
 * 
 * The component:
 * - Accepts any phone format as initial value (E.164, formatted, or raw digits)
 * - Shows formatted display as user types
 * - Emits E.164 format (+1XXXXXXXXXX) via onChange for storage
 * - Also provides onE164Change callback if you need the E.164 value separately
 */
const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value, onChange, onE164Change, placeholder = "(555) 123-4567", ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState("");

    useEffect(() => {
      if (value !== undefined) {
        const digits = extractDigits(value);
        setDisplayValue(formatPhoneAsYouType(digits));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      
      // Use extractDigits which properly handles leading "1" country code
      // and limits to 10 digits
      const digits = extractDigits(input);
      
      const formatted = formatPhoneAsYouType(digits);
      setDisplayValue(formatted);
      
      // Only emit E.164 format when we have exactly 10 digits
      // Otherwise emit empty string to indicate invalid/incomplete
      const e164 = digits.length === 10 ? toE164(digits) : "";
      
      onChange?.(e164);
      onE164Change?.(e164);
    };

    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="numeric"
        className={cn("font-mono", className)}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        {...props}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
