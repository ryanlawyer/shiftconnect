import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
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

// Employees
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  position: text("position").notNull(),
  status: text("status").notNull().default("active"), // active, inactive
  smsOptIn: boolean("sms_opt_in").default(true).notNull(),
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
  position: text("position").notNull(),
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

// Messages - SMS messages sent
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  direction: text("direction").notNull(), // inbound, outbound
  content: text("content").notNull(),
  status: text("status").notNull().default("sent"), // sent, delivered, failed
  twilioSid: text("twilio_sid"),
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
