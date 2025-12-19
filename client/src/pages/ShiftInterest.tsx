import { useState, useEffect } from "react";
import { useRoute, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShiftDetails {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  areaName?: string;
  positionTitle?: string;
  bonusAmount?: number;
  status: string;
  smsCode: string;
}

// Format phone number for display
const formatPhone = (value: string) => {
  let digits = value.replace(/\D/g, "");
  // Strip leading country code "1" if present (11 digits total)
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

export default function ShiftInterest() {
  const [, params] = useRoute("/shift/:smsCode");
  const smsCode = params?.smsCode || "";
  const searchString = useSearch();
  const [phone, setPhone] = useState("");
  const [phoneFromUrl, setPhoneFromUrl] = useState(false);
  const [step, setStep] = useState<"verify" | "confirm" | "submitting" | "confirmed" | "already" | "error">("verify");
  const { toast } = useToast();

  // Extract phone number from URL query parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(searchString);
    const phoneParam = urlParams.get("p");
    if (phoneParam) {
      const formatted = formatPhone(phoneParam);
      setPhone(formatted);
      setPhoneFromUrl(true);
    }
  }, [searchString]);

  const { data: shift, isLoading, error } = useQuery<ShiftDetails>({
    queryKey: ["/public/shift", smsCode],
    queryFn: async () => {
      const res = await fetch(`/public/shift/${smsCode}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Shift not found");
      }
      return res.json();
    },
    enabled: !!smsCode,
  });

  const expressInterestMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await fetch(`/public/shift/${smsCode}/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to express interest");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.alreadyInterested) {
        setStep("already");
      } else {
        setStep("confirmed");
        // Auto-close the window after 3 seconds
        setTimeout(() => {
          window.close();
        }, 3000);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      if (error.message.includes("verify") || error.message.includes("not found") || error.message.includes("not eligible")) {
        setStep("error");
        // Allow user to edit phone number after verification failure
        setPhoneFromUrl(false);
      } else {
        // For network/other errors, go back to verify step so user can retry
        setStep("verify");
      }
    },
  });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
    setPhoneFromUrl(false);
  };

  const handleInitialInterest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast({
        title: "Phone required",
        description: "Please enter your phone number to verify your identity.",
        variant: "destructive",
      });
      return;
    }
    // Move to confirmation step
    setStep("confirm");
  };

  const handleConfirm = () => {
    setStep("submitting");
    expressInterestMutation.mutate(phone.trim());
  };

  const handleGoBack = () => {
    setStep("verify");
    // Allow editing phone when going back
    setPhoneFromUrl(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" data-testid="loading-spinner" />
      </div>
    );
  }

  if (error || !shift) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle data-testid="text-error-title">Shift Not Found</CardTitle>
            <CardDescription data-testid="text-error-message">
              {error instanceof Error ? error.message : "This shift code is invalid or the shift is no longer available."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (shift.status !== "available") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <CardTitle data-testid="text-unavailable-title">Shift Unavailable</CardTitle>
            <CardDescription data-testid="text-unavailable-message">
              This shift has already been {shift.status}. Check your messages for other available shifts.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Shift details component used in multiple steps
  const ShiftDetailsCard = () => (
    <div className="bg-muted rounded-md p-4 space-y-3">
      {shift.positionTitle && (
        <div className="font-medium" data-testid="text-position">{shift.positionTitle}</div>
      )}
      <div className="flex items-center gap-2 text-sm">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span data-testid="text-shift-date">{shift.date}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span data-testid="text-shift-time">{shift.startTime} - {shift.endTime}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span data-testid="text-shift-location">{shift.location}{shift.areaName ? ` (${shift.areaName})` : ""}</span>
      </div>
      <div className="text-xs text-muted-foreground mt-2">
        Code: <span className="font-mono" data-testid="text-shift-code">{shift.smsCode}</span>
      </div>
    </div>
  );

  // Success state - interest confirmed
  if (step === "confirmed") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-500 mx-auto mb-2" />
            <CardTitle data-testid="text-success-title">Interest Confirmed</CardTitle>
            <CardDescription data-testid="text-success-message">
              Your interest in this shift has been recorded. You will receive an SMS confirmation shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ShiftDetailsCard />
            <p className="text-xs text-center text-muted-foreground">
              This window will close automatically...
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.close()}
              data-testid="button-close-window"
            >
              Close Window
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already expressed interest
  if (step === "already") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-blue-600 dark:text-blue-500 mx-auto mb-2" />
            <CardTitle data-testid="text-already-title">Already Interested</CardTitle>
            <CardDescription data-testid="text-already-message">
              You have already expressed interest in this shift. A supervisor will review your request soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.close()}
              data-testid="button-close-window"
            >
              Close Window
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (step === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle data-testid="text-error-title">Verification Failed</CardTitle>
            <CardDescription data-testid="text-error-message">
              We couldn't verify your phone number, or you are not eligible for this shift.
              Please contact your supervisor for assistance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setStep("verify")}
              data-testid="button-try-again"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirmation step - show details and ask for final confirmation
  if (step === "confirm" || step === "submitting") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-confirm-title">
              Confirm Your Interest
              {shift.bonusAmount && shift.bonusAmount > 0 && (
                <Badge variant="secondary" className="text-green-600 dark:text-green-400">
                  +${shift.bonusAmount} bonus
                </Badge>
              )}
            </CardTitle>
            <CardDescription data-testid="text-confirm-description">
              Please confirm you want to express interest in this shift
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ShiftDetailsCard />
            
            <div className="bg-muted/50 rounded-md p-3 border">
              <p className="text-sm text-muted-foreground">
                Confirming as: <span className="font-medium text-foreground">{phone}</span>
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                className="w-full"
                onClick={handleConfirm}
                disabled={step === "submitting"}
                data-testid="button-confirm-interest"
              >
                {step === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  "Confirm Interest"
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoBack}
                disabled={step === "submitting"}
                data-testid="button-go-back"
              >
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Initial verify step - phone number entry
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-page-title">
            Express Interest
            {shift.bonusAmount && shift.bonusAmount > 0 && (
              <Badge variant="secondary" className="text-green-600 dark:text-green-400">
                +${shift.bonusAmount} bonus
              </Badge>
            )}
          </CardTitle>
          <CardDescription data-testid="text-page-description">
            {phoneFromUrl 
              ? "Review your information and proceed to express interest"
              : "Verify your identity to express interest in this shift"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ShiftDetailsCard />

          <form onSubmit={handleInitialInterest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Your Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={handlePhoneChange}
                data-testid="input-phone"
                autoComplete="tel"
                readOnly={phoneFromUrl}
                className={phoneFromUrl ? "bg-muted" : ""}
              />
              <p className="text-xs text-muted-foreground">
                {phoneFromUrl 
                  ? "Your phone number has been pre-filled from the link."
                  : "Enter the phone number registered in the system to verify your identity."
                }
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full"
                data-testid="button-express-interest"
              >
                I'm Interested
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => window.close()}
                data-testid="button-cancel"
              >
                Not Interested
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
