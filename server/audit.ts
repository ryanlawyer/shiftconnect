import { storage } from "./storage";
import type { User } from "@shared/schema";

export type AuditAction =
  | "role_created"
  | "role_updated"
  | "role_deleted"
  | "shift_created"
  | "shift_deleted"
  | "shift_assigned"
  | "force_assignment"
  | "user_created"
  | "user_password_reset"
  | "employee_created"
  | "employee_updated"
  | "employee_deleted"
  | "area_created"
  | "area_updated"
  | "area_deleted"
  | "position_created"
  | "position_updated"
  | "position_deleted"
  // SMS actions
  | "sms_sent"
  | "sms_bulk_sent"
  | "sms_delivered"
  | "sms_failed"
  | "sms_inbound"
  | "sms_opt_in"
  | "sms_opt_out"
  // SMS shift interest actions
  | "shift_interest_via_sms"
  | "shift_interest_declined_via_sms"
  | "shift_confirmed_via_sms"
  | "shift_interest_cancelled_via_sms"
  | "shift_cancelled_via_sms"
  | "sms_test"
  | "setting_updated"
  // RingCentral configuration actions
  | "ringcentral_credentials_import"
  | "ringcentral_jwt_selected";

export type TargetType = "role" | "shift" | "user" | "employee" | "area" | "position" | "message" | "setting" | "sms_provider";

interface AuditLogParams {
  action: AuditAction;
  actor: User | null;
  targetType: TargetType;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAuditEvent({
  action,
  actor,
  targetType,
  targetId,
  targetName,
  details,
  ipAddress,
}: AuditLogParams) {
  try {
    await storage.createAuditLog({
      action,
      actorId: actor?.id ?? null,
      actorName: actor?.username ?? "System",
      targetType,
      targetId: targetId ?? null,
      targetName: targetName ?? null,
      details: details ?? null,
      ipAddress: ipAddress ?? null,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

// Helper to get IP from request
export function getClientIp(req: any): string | undefined {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip
  );
}
