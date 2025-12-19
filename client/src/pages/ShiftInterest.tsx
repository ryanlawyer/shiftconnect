import { useState } from "react";
import { useRoute } from "wouter";
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

export default function ShiftInterest() {
  const [, params] = useRoute("/shift/:smsCode");
  const smsCode = params?.smsCode || "";
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"verify" | "confirmed" | "already" | "error">("verify");
  const { toast } = useToast();

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
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast({
        title: "Phone required",
        description: "Please enter your phone number to verify your identity.",
        variant: "destructive",
      });
      return;
    }
    expressInterestMutation.mutate(phone.trim());
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
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

  if (step === "confirmed") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-500 mx-auto mb-2" />
            <CardTitle data-testid="text-success-title">Interest Submitted</CardTitle>
            <CardDescription data-testid="text-success-message">
              Your interest in this shift has been recorded. You will be notified via SMS if you are assigned.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-md p-4 space-y-2">
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
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
        </Card>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle data-testid="text-error-title">Verification Failed</CardTitle>
            <CardDescription data-testid="text-error-message">
              We couldn't find your phone number in our system, or you are not eligible for this shift.
              Please contact your supervisor for assistance.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

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
            Verify your identity to express interest in this shift
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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

          <form onSubmit={handleSubmit} className="space-y-4">
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
              />
              <p className="text-xs text-muted-foreground">
                Enter the phone number registered in the system to verify your identity.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={expressInterestMutation.isPending}
              data-testid="button-express-interest"
            >
              {expressInterestMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "I'm Interested"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
