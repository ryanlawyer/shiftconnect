import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Roles - granular access control
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: json("permissions").$type<string[]>().notNull().default([]),
  isSystem: boolean("is_system").default(false).notNull(),
});

export const insertRoleSchema = createInsertSchema(roles, {
  permissions: z.array(z.string()),
  isSystem: z.boolean().optional(),
}).omit({ id: true });
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("employee"),
  roleId: varchar("role_id").references(() => roles.id),
  employeeId: varchar("employee_id"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Areas - organizational units like "Emergency Department", "ICU", "Lab"
export const areas = pgTable("areas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  smsEnabled: boolean("sms_enabled").default(true).notNull(),
});

export const insertAreaSchema = createInsertSchema(areas).omit({ id: true });
export type InsertArea = z.infer<typeof insertAreaSchema>;
export type Area = typeof areas.$inferSelect;

// Positions
export const positions = pgTable("positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
});

export const insertPositionSchema = createInsertSchema(positions).omit({ id: true });
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positions.$inferSelect;

// Employees
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  positionId: varchar("position_id").notNull().references(() => positions.id),
  role: text("role").notNull().default("employee"), // admin, supervisor, employee
  roleId: varchar("role_id").references(() => roles.id),
  status: text("status").notNull().default("active"), // active, inactive
  smsOptIn: boolean("sms_opt_in").default(true).notNull(),
  // Web access fields
  webAccessEnabled: boolean("web_access_enabled").default(false).notNull(),
  username: text("username"),
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

// Employee-Area assignments (many-to-many)
export const employeeAreas = pgTable("employee_areas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  areaId: varchar("area_id").notNull().references(() => areas.id),
});

export const insertEmployeeAreaSchema = createInsertSchema(employeeAreas).omit({ id: true });
export type InsertEmployeeArea = z.infer<typeof insertEmployeeAreaSchema>;
export type EmployeeArea = typeof employeeAreas.$inferSelect;

// Shifts - work shifts that need to be filled
export const shifts = pgTable("shifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  positionId: varchar("position_id").notNull().references(() => positions.id),
  areaId: varchar("area_id").notNull().references(() => areas.id),
  location: text("location").notNull(),
  date: text("date").notNull(), // formatted date string
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  requirements: text("requirements"),
  postedById: varchar("posted_by_id").references(() => users.id),
  postedByName: text("posted_by_name").notNull(),
  status: text("status").notNull().default("available"), // available, claimed, expired
  assignedEmployeeId: varchar("assigned_employee_id").references(() => employees.id),
  smsCode: text("sms_code"), // Short 6-char code for SMS replies (e.g., "ABC123")
  bonusAmount: integer("bonus_amount"), // Optional bonus amount in dollars (e.g., 50 for $50 bonus)
  notifyAllAreas: boolean("notify_all_areas").default(false), // When true, notify employees from all areas
  lastNotifiedAt: timestamp("last_notified_at"), // When SMS notifications were last sent for this shift
  notificationCount: integer("notification_count").default(0), // Number of employees notified in last notification
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertShiftSchema = createInsertSchema(shifts).omit({ id: true, createdAt: true });
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shifts.$inferSelect;

// Shift interest - employees expressing interest in shifts
export const shiftInterests = pgTable("shift_interests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shiftId: varchar("shift_id").notNull().references(() => shifts.id),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertShiftInterestSchema = createInsertSchema(shiftInterests).omit({ id: true, createdAt: true });
export type InsertShiftInterest = z.infer<typeof insertShiftInterestSchema>;
export type ShiftInterest = typeof shiftInterests.$inferSelect;

// Shift Templates - reusable shift configurations
export const shiftTemplates = pgTable("shift_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  positionId: varchar("position_id").notNull().references(() => positions.id),
  areaId: varchar("area_id").notNull().references(() => areas.id),
  location: text("location").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  requirements: text("requirements"),
  bonusAmount: integer("bonus_amount"),
  notifyAllAreas: boolean("notify_all_areas").default(false),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertShiftTemplateSchema = createInsertSchema(shiftTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShiftTemplate = z.infer<typeof insertShiftTemplateSchema>;
export type ShiftTemplate = typeof shiftTemplates.$inferSelect;

// Messages - SMS messages sent
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  direction: text("direction").notNull(), // inbound, outbound
  content: text("content").notNull(),
  status: text("status").notNull().default("pending"), // pending, queued, sent, delivered, undelivered, failed
  // Provider-agnostic message tracking
  providerMessageId: text("provider_message_id"), // Message ID from provider (Twilio SID, RingCentral ID, etc.)
  smsProvider: text("sms_provider").default("twilio"), // twilio, ringcentral
  // Legacy field for backwards compatibility (will be removed in future)
  twilioSid: text("twilio_sid"),
  // Delivery tracking fields
  deliveryStatus: text("delivery_status"), // queued, sent, delivered, undelivered, failed, canceled
  deliveryTimestamp: timestamp("delivery_timestamp"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  segments: integer("segments").default(1), // Number of SMS segments
  // Threading support
  threadId: varchar("thread_id"),
  inReplyTo: varchar("in_reply_to"),
  // Message type for categorization
  messageType: text("message_type").default("general"), // general, shift_notification, shift_reminder, shift_confirmation, bulk, system
  // Related entity (for shift notifications)
  relatedShiftId: varchar("related_shift_id").references(() => shifts.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Trainings - training materials/announcements
export const trainings = pgTable("trainings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // video, document, quiz
  dueDate: text("due_date"),
  required: boolean("required").default(false).notNull(),
  completedCount: integer("completed_count").default(0).notNull(),
  totalAssigned: integer("total_assigned").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTrainingSchema = createInsertSchema(trainings).omit({ id: true, createdAt: true });
export type InsertTraining = z.infer<typeof insertTrainingSchema>;
export type Training = typeof trainings.$inferSelect;

// Audit Logs - track critical actions
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(), // role_change, shift_deletion, force_assignment, user_created, etc.
  actorId: varchar("actor_id").references(() => users.id),
  actorName: text("actor_name").notNull(),
  targetType: text("target_type").notNull(), // user, employee, shift, role
  targetId: varchar("target_id"),
  targetName: text("target_name"),
  details: json("details").$type<Record<string, unknown>>(), // before/after values, additional context
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Organization Settings - configurable system settings
export const organizationSettings = pgTable("organization_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrganizationSettingSchema = createInsertSchema(organizationSettings).omit({ id: true, updatedAt: true });
export type InsertOrganizationSetting = z.infer<typeof insertOrganizationSettingSchema>;
export type OrganizationSetting = typeof organizationSettings.$inferSelect;

// SMS Templates - reusable message templates with variable substitution
export const smsTemplates = pgTable("sms_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"), // general, shift_notification, shift_reminder, shift_confirmation, bulk
  content: text("content").notNull(), // Template with {{variable}} placeholders
  isSystem: boolean("is_system").default(false).notNull(), // System templates can't be deleted
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSmsTemplateSchema = createInsertSchema(smsTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSmsTemplate = z.infer<typeof insertSmsTemplateSchema>;
export type SmsTemplate = typeof smsTemplates.$inferSelect;
