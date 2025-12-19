import { db } from "./db";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import {
  type User, type InsertUser,
  type Role, type InsertRole,
  type Area, type InsertArea,
  type Position, type InsertPosition,
  type Employee, type InsertEmployee,
  type EmployeeArea, type InsertEmployeeArea,
  type Shift, type InsertShift,
  type ShiftInterest, type InsertShiftInterest,
  type Message, type InsertMessage,
  type Training, type InsertTraining,
  type AuditLog, type InsertAuditLog,
  type OrganizationSetting,
  type SmsTemplate, type InsertSmsTemplate,
  type ShiftTemplate, type InsertShiftTemplate,
  users, roles, areas, positions, employees, employeeAreas,
  shifts, shiftInterests, messages, trainings, auditLogs,
  organizationSettings, smsTemplates, shiftTemplates,
} from "@shared/schema";
import { ROLE_PERMISSIONS } from "@shared/permissions";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pg from "pg";
import { scryptSync, randomBytes } from "crypto";
import type { IStorage } from "./storage";

const { Pool } = pg;

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    const PgStore = connectPg(session);
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    this.sessionStore = new PgStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async initialize(): Promise<void> {
    const existingRoles = await db.select().from(roles);
    if (existingRoles.length === 0) {
      const defaultRoles: InsertRole[] = [
        { name: "Admin", description: "Full system access", permissions: ROLE_PERMISSIONS.admin as unknown as string[], isSystem: true },
        { name: "Supervisor", description: "Manage shifts and employees", permissions: ROLE_PERMISSIONS.supervisor as unknown as string[], isSystem: true },
        { name: "Employee", description: "View and claim shifts", permissions: ROLE_PERMISSIONS.employee as unknown as string[], isSystem: true },
      ];
      for (const role of defaultRoles) {
        await this.createRole(role);
      }
    } else {
      // Update existing roles to use new permission format
      for (const role of existingRoles) {
        const roleKey = role.name.toLowerCase() as keyof typeof ROLE_PERMISSIONS;
        if (ROLE_PERMISSIONS[roleKey]) {
          await db.update(roles).set({ permissions: ROLE_PERMISSIONS[roleKey] as unknown as string[] }).where(eq(roles.id, role.id));
        }
      }
    }

    const allRoles = await db.select().from(roles);
    const adminRole = allRoles.find(r => r.name === "Admin");

    const existingPositions = await db.select().from(positions);
    let adminPosition = existingPositions.find(p => p.title === "Administrator");
    if (!adminPosition) {
      adminPosition = await this.createPosition({ title: "Administrator", description: "Facility administrator" });
    }

    const existingUsers = await db.select().from(users).where(eq(users.username, "pmorrison"));
    if (existingUsers.length === 0) {
      const adminEmployee = await this.createEmployee({
        name: "Patricia Morrison",
        phone: "+15559001001",
        email: "pmorrison@facility.com",
        positionId: adminPosition.id,
        role: "admin",
        roleId: adminRole?.id ?? null,
        status: "active",
        smsOptIn: true,
      });

      const salt = randomBytes(16).toString("hex");
      const hashedPassword = scryptSync("admin123", salt, 64).toString("hex") + "." + salt;
      await db.insert(users).values({
        username: "pmorrison",
        password: hashedPassword,
        role: "admin",
        roleId: adminRole?.id ?? null,
        employeeId: adminEmployee.id,
      });
    }

    // Create default SMS templates if they don't exist
    const existingTemplates = await db.select().from(smsTemplates);
    if (existingTemplates.length === 0) {
      const defaultTemplates: InsertSmsTemplate[] = [
        {
          name: "New Shift Available",
          description: "Sent when a new open shift is posted",
          category: "shift_notification",
          content: "ShiftConnect: {{shiftType}} shift available on {{date}} from {{startTime}} to {{endTime}} at {{location}}{{area}}. Code: {{smsCode}}.\n\nTap to claim: {{appUrl}}/shift/{{smsCode}}\n\nOr reply YES {{smsCode}}",
          isSystem: true,
          isActive: true,
        },
        {
          name: "Shift Reminder",
          description: "Sent as a reminder before assigned shift",
          category: "shift_reminder",
          content: "ShiftConnect Reminder: You have a shift on {{date}} from {{startTime}} to {{endTime}} at {{location}}. Please confirm your attendance.",
          isSystem: true,
          isActive: true,
        },
        {
          name: "Shift Confirmation",
          description: "Sent when an employee is assigned to a shift",
          category: "shift_confirmation",
          content: "ShiftConnect: You have been assigned to the {{shiftType}} shift on {{date}} from {{startTime}} to {{endTime}} at {{location}}. Thank you!",
          isSystem: true,
          isActive: true,
        },
        {
          name: "Shift Interest Received",
          description: "Confirmation when employee expresses interest in a shift",
          category: "shift_interest",
          content: "ShiftConnect: Your interest in the {{date}} shift at {{location}} has been received. You will be notified if you are assigned.",
          isSystem: true,
          isActive: true,
        },
        {
          name: "Shift Cancelled",
          description: "Sent when a shift is cancelled",
          category: "shift_cancellation",
          content: "ShiftConnect: The shift on {{date}} from {{startTime}} to {{endTime}} at {{location}} has been cancelled. We apologize for any inconvenience.",
          isSystem: true,
          isActive: true,
        },
        {
          name: "Bulk Notification",
          description: "General template for bulk messages",
          category: "bulk",
          content: "ShiftConnect: {{message}}",
          isSystem: true,
          isActive: true,
        },
        {
          name: "Training Reminder",
          description: "Sent as a reminder for upcoming training",
          category: "training_reminder",
          content: "ShiftConnect: Reminder - You have {{trainingTitle}} training scheduled for {{date}} at {{time}}. Location: {{location}}.",
          isSystem: true,
          isActive: true,
        },
        {
          name: "Welcome Message",
          description: "Sent when a new employee is added to the system",
          category: "welcome",
          content: "Welcome to ShiftConnect, {{employeeName}}! You are now set up to receive shift notifications. Reply STOP to opt out at any time.",
          isSystem: true,
          isActive: true,
        },
        {
          name: "Shift Reposted",
          description: "Sent when a shift is reposted (optionally with bonus)",
          category: "shift_repost",
          content: "ShiftConnect: {{shiftType}} shift available on {{date}} from {{startTime}} to {{endTime}} at {{location}}{{area}}. {{bonus}} Code: {{smsCode}}.\n\nTap to claim: {{appUrl}}/shift/{{smsCode}}\n\nOr reply YES {{smsCode}}",
          isSystem: true,
          isActive: true,
        },
      ];
      for (const template of defaultTemplates) {
        await this.createSmsTemplate(template);
      }
    }

    // Ensure shift_repost template exists (for existing databases)
    const repostTemplate = await db.select().from(smsTemplates).where(eq(smsTemplates.category, "shift_repost"));
    if (repostTemplate.length === 0) {
      await this.createSmsTemplate({
        name: "Shift Reposted",
        description: "Sent when a shift is reposted (optionally with bonus)",
        category: "shift_repost",
        content: "ShiftConnect: {{shiftType}} shift available on {{date}} from {{startTime}} to {{endTime}} at {{location}}{{area}}. {{bonus}} Code: {{smsCode}}.\n\nTap to claim: {{appUrl}}/shift/{{smsCode}}\n\nOr reply YES {{smsCode}}",
        isSystem: true,
        isActive: true,
      });
    }

    // Backfill SMS codes for existing shifts that don't have them
    await this.backfillShiftSmsCodes();
  }

  private async backfillShiftSmsCodes(): Promise<void> {
    const allShifts = await db.select().from(shifts);
    const shiftsWithoutCodes = allShifts.filter(s => !s.smsCode);
    
    if (shiftsWithoutCodes.length > 0) {
      console.log(`Backfilling SMS codes for ${shiftsWithoutCodes.length} shifts`);
      for (const shift of shiftsWithoutCodes) {
        const newCode = await this.generateUniqueSmsCode();
        await db.update(shifts).set({ smsCode: newCode }).where(eq(shifts.id, shift.id));
      }
      console.log(`SMS code backfill complete`);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getUserByEmployeeId(employeeId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.employeeId, employeeId));
    return result[0];
  }

  async getRoles(): Promise<Role[]> {
    return db.select().from(roles);
  }

  async getRole(id: string): Promise<Role | undefined> {
    const result = await db.select().from(roles).where(eq(roles.id, id));
    return result[0];
  }

  async createRole(insertRole: InsertRole): Promise<Role> {
    const result = await db.insert(roles).values(insertRole).returning();
    return result[0];
  }

  async updateRole(id: string, updates: Partial<InsertRole>): Promise<Role | undefined> {
    const result = await db.update(roles).set(updates).where(eq(roles.id, id)).returning();
    return result[0];
  }

  async deleteRole(id: string): Promise<boolean> {
    const role = await this.getRole(id);
    if (role?.isSystem) return false;
    const result = await db.delete(roles).where(eq(roles.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAreas(): Promise<Area[]> {
    return db.select().from(areas);
  }

  async getArea(id: string): Promise<Area | undefined> {
    const result = await db.select().from(areas).where(eq(areas.id, id));
    return result[0];
  }

  async createArea(insertArea: InsertArea): Promise<Area> {
    const result = await db.insert(areas).values(insertArea).returning();
    return result[0];
  }

  async updateArea(id: string, updates: Partial<InsertArea>): Promise<Area | undefined> {
    const result = await db.update(areas).set(updates).where(eq(areas.id, id)).returning();
    return result[0];
  }

  async deleteArea(id: string, reassignToId?: string): Promise<boolean> {
    if (reassignToId) {
      const targetArea = await this.getArea(reassignToId);
      if (!targetArea) return false;

      await db.update(shifts).set({ areaId: reassignToId }).where(eq(shifts.areaId, id));

      const oldAssignments = await db.select().from(employeeAreas).where(eq(employeeAreas.areaId, id));
      for (const assignment of oldAssignments) {
        const alreadyHasTarget = await db.select().from(employeeAreas)
          .where(and(eq(employeeAreas.employeeId, assignment.employeeId), eq(employeeAreas.areaId, reassignToId)));
        if (alreadyHasTarget.length === 0) {
          await db.insert(employeeAreas).values({ employeeId: assignment.employeeId, areaId: reassignToId });
        }
      }
    }
    await db.delete(employeeAreas).where(eq(employeeAreas.areaId, id));
    const result = await db.delete(areas).where(eq(areas.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getPositions(): Promise<Position[]> {
    return db.select().from(positions);
  }

  async getPosition(id: string): Promise<Position | undefined> {
    const result = await db.select().from(positions).where(eq(positions.id, id));
    return result[0];
  }

  async createPosition(insertPosition: InsertPosition): Promise<Position> {
    const result = await db.insert(positions).values(insertPosition).returning();
    return result[0];
  }

  async updatePosition(id: string, updates: Partial<InsertPosition>): Promise<Position | undefined> {
    const result = await db.update(positions).set(updates).where(eq(positions.id, id)).returning();
    return result[0];
  }

  async deletePosition(id: string, reassignToId?: string): Promise<boolean> {
    if (reassignToId) {
      const targetPosition = await this.getPosition(reassignToId);
      if (!targetPosition) return false;
      await db.update(employees).set({ positionId: reassignToId }).where(eq(employees.positionId, id));
      await db.update(shifts).set({ positionId: reassignToId }).where(eq(shifts.positionId, id));
    }
    const result = await db.delete(positions).where(eq(positions.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getEmployees(): Promise<Employee[]> {
    // Exclude soft-deleted employees
    return db.select().from(employees).where(
      sql`${employees.status} != 'deleted' OR ${employees.status} IS NULL`
    );
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const result = await db.select().from(employees).where(eq(employees.id, id));
    return result[0];
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const result = await db.insert(employees).values(insertEmployee).returning();
    return result[0];
  }

  async updateEmployee(id: string, updates: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const result = await db.update(employees).set(updates).where(eq(employees.id, id)).returning();
    return result[0];
  }

  async deleteEmployee(id: string): Promise<boolean> {
    // Soft delete: set status to 'deleted' and disable web access
    // Auth system checks employee status to prevent login for deleted employees
    const result = await db.update(employees)
      .set({ 
        status: 'deleted',
        webAccessEnabled: false 
      })
      .where(eq(employees.id, id))
      .returning();
    
    return result.length > 0;
  }

  async getEmployeeAreas(employeeId: string): Promise<Area[]> {
    const assignments = await db.select().from(employeeAreas).where(eq(employeeAreas.employeeId, employeeId));
    if (assignments.length === 0) return [];
    const areaIds = assignments.map(a => a.areaId);
    return db.select().from(areas).where(inArray(areas.id, areaIds));
  }

  async getAreaEmployees(areaId: string): Promise<Employee[]> {
    const assignments = await db.select().from(employeeAreas).where(eq(employeeAreas.areaId, areaId));
    if (assignments.length === 0) return [];
    const employeeIds = assignments.map(a => a.employeeId);
    return db.select().from(employees)
      .where(and(inArray(employees.id, employeeIds), eq(employees.status, "active"), eq(employees.smsOptIn, true)));
  }

  async assignEmployeeToArea(assignment: InsertEmployeeArea): Promise<EmployeeArea> {
    const existing = await db.select().from(employeeAreas)
      .where(and(eq(employeeAreas.employeeId, assignment.employeeId), eq(employeeAreas.areaId, assignment.areaId)));
    if (existing.length > 0) return existing[0];
    const result = await db.insert(employeeAreas).values(assignment).returning();
    return result[0];
  }

  async removeEmployeeFromArea(employeeId: string, areaId: string): Promise<boolean> {
    const result = await db.delete(employeeAreas)
      .where(and(eq(employeeAreas.employeeId, employeeId), eq(employeeAreas.areaId, areaId)));
    return (result.rowCount ?? 0) > 0;
  }

  async setEmployeeAreas(employeeId: string, areaIds: string[]): Promise<void> {
    await db.delete(employeeAreas).where(eq(employeeAreas.employeeId, employeeId));
    for (const areaId of areaIds) {
      await this.assignEmployeeToArea({ employeeId, areaId });
    }
  }

  async getShifts(): Promise<Shift[]> {
    return db.select().from(shifts).orderBy(desc(shifts.createdAt));
  }

  async getShift(id: string): Promise<Shift | undefined> {
    const result = await db.select().from(shifts).where(eq(shifts.id, id));
    return result[0];
  }

  async getShiftBySmsCode(smsCode: string): Promise<Shift | undefined> {
    // Case-insensitive lookup for SMS codes
    const result = await db.select().from(shifts).where(
      sql`UPPER(${shifts.smsCode}) = UPPER(${smsCode})`
    );
    return result[0];
  }

  async getShiftsByArea(areaId: string): Promise<Shift[]> {
    return db.select().from(shifts).where(eq(shifts.areaId, areaId));
  }

  private generateSmsCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding I, O, 0, 1 to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private async generateUniqueSmsCode(): Promise<string> {
    let code = this.generateSmsCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await this.getShiftBySmsCode(code);
      if (!existing) {
        return code;
      }
      code = this.generateSmsCode();
      attempts++;
    }
    // Fallback: append timestamp
    return code + Date.now().toString(36).slice(-2).toUpperCase();
  }

  async createShift(insertShift: InsertShift): Promise<Shift> {
    // Generate SMS code if not provided
    const smsCode = insertShift.smsCode || await this.generateUniqueSmsCode();
    const result = await db.insert(shifts).values({ ...insertShift, smsCode }).returning();
    return result[0];
  }

  async updateShift(id: string, updates: Partial<InsertShift>): Promise<Shift | undefined> {
    const result = await db.update(shifts).set(updates).where(eq(shifts.id, id)).returning();
    return result[0];
  }

  async deleteShift(id: string): Promise<boolean> {
    // First, remove the foreign key reference from messages
    await db.update(messages).set({ relatedShiftId: null }).where(eq(messages.relatedShiftId, id));
    // Then delete shift interests
    await db.delete(shiftInterests).where(eq(shiftInterests.shiftId, id));
    // Finally delete the shift
    const result = await db.delete(shifts).where(eq(shifts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getShiftInterests(shiftId: string): Promise<(ShiftInterest & { employee: Employee })[]> {
    const interests = await db.select().from(shiftInterests).where(eq(shiftInterests.shiftId, shiftId));
    const result: (ShiftInterest & { employee: Employee })[] = [];
    for (const interest of interests) {
      const employee = await this.getEmployee(interest.employeeId);
      if (employee) {
        result.push({ ...interest, employee });
      }
    }
    return result;
  }

  async getShiftInterestByEmployeeAndShift(employeeId: string, shiftId: string): Promise<ShiftInterest | undefined> {
    const result = await db.select().from(shiftInterests)
      .where(and(eq(shiftInterests.employeeId, employeeId), eq(shiftInterests.shiftId, shiftId)));
    return result[0];
  }

  async getEmployeeShiftInterests(employeeId: string): Promise<(ShiftInterest & { shift: Shift })[]> {
    const interests = await db.select().from(shiftInterests).where(eq(shiftInterests.employeeId, employeeId));
    const result: (ShiftInterest & { shift: Shift })[] = [];
    for (const interest of interests) {
      const shift = await this.getShift(interest.shiftId);
      if (shift) {
        result.push({ ...interest, shift });
      }
    }
    return result;
  }

  async createShiftInterest(interest: InsertShiftInterest): Promise<ShiftInterest> {
    const result = await db.insert(shiftInterests).values(interest).returning();
    return result[0];
  }

  async deleteShiftInterest(shiftId: string, employeeId: string): Promise<boolean> {
    const result = await db.delete(shiftInterests)
      .where(and(eq(shiftInterests.shiftId, shiftId), eq(shiftInterests.employeeId, employeeId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getMessages(filters?: { employeeId?: string; messageType?: string; relatedShiftId?: string }): Promise<Message[]> {
    const conditions = [];
    if (filters?.employeeId) {
      conditions.push(eq(messages.employeeId, filters.employeeId));
    }
    if (filters?.messageType) {
      conditions.push(eq(messages.messageType, filters.messageType));
    }
    if (filters?.relatedShiftId) {
      conditions.push(eq(messages.relatedShiftId, filters.relatedShiftId));
    }
    
    if (conditions.length > 0) {
      return db.select().from(messages).where(and(...conditions)).orderBy(desc(messages.createdAt));
    }
    return db.select().from(messages).orderBy(desc(messages.createdAt));
  }

  async getEmployeeMessages(employeeId: string): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.employeeId, employeeId)).orderBy(desc(messages.createdAt));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(message).returning();
    return result[0];
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined> {
    const result = await db.update(messages).set(updates).where(eq(messages.id, id)).returning();
    return result[0];
  }

  async getMessageByTwilioSid(twilioSid: string): Promise<Message | undefined> {
    const result = await db.select().from(messages).where(eq(messages.twilioSid, twilioSid));
    return result[0];
  }

  async getMessageByProviderMessageId(providerMessageId: string): Promise<Message | undefined> {
    const result = await db.select().from(messages).where(eq(messages.providerMessageId, providerMessageId));
    return result[0];
  }

  async getMessageThread(threadId: string): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.threadId, threadId)).orderBy(messages.createdAt);
  }

  async getTrainings(): Promise<Training[]> {
    return db.select().from(trainings);
  }

  async getTraining(id: string): Promise<Training | undefined> {
    const result = await db.select().from(trainings).where(eq(trainings.id, id));
    return result[0];
  }

  async createTraining(training: InsertTraining): Promise<Training> {
    const result = await db.insert(trainings).values(training).returning();
    return result[0];
  }

  async updateTraining(id: string, updates: Partial<InsertTraining>): Promise<Training | undefined> {
    const result = await db.update(trainings).set(updates).where(eq(trainings.id, id)).returning();
    return result[0];
  }

  async deleteTraining(id: string): Promise<boolean> {
    const result = await db.delete(trainings).where(eq(trainings.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAuditLogs(options?: { limit?: number; offset?: number; action?: string; actorId?: string; targetType?: string }): Promise<AuditLog[]> {
    const conditions = [];
    if (options?.action) {
      conditions.push(eq(auditLogs.action, options.action));
    }
    if (options?.actorId) {
      conditions.push(eq(auditLogs.actorId, options.actorId));
    }
    if (options?.targetType) {
      conditions.push(eq(auditLogs.targetType, options.targetType));
    }
    
    let query;
    if (conditions.length > 0) {
      query = db.select().from(auditLogs).where(and(...conditions)).orderBy(desc(auditLogs.createdAt));
    } else {
      query = db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
    }
    
    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }
    return query;
  }

  async getAuditLog(id: string): Promise<AuditLog | undefined> {
    const result = await db.select().from(auditLogs).where(eq(auditLogs.id, id));
    return result[0];
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0];
  }

  async getSettings(): Promise<OrganizationSetting[]> {
    return db.select().from(organizationSettings);
  }

  async getSetting(key: string): Promise<OrganizationSetting | undefined> {
    const result = await db.select().from(organizationSettings).where(eq(organizationSettings.key, key));
    return result[0];
  }

  async setSetting(key: string, value: string, description?: string): Promise<OrganizationSetting> {
    const existing = await this.getSetting(key);
    if (existing) {
      const result = await db.update(organizationSettings)
        .set({ value, description: description ?? existing.description, updatedAt: new Date() })
        .where(eq(organizationSettings.key, key))
        .returning();
      return result[0];
    }
    const result = await db.insert(organizationSettings).values({ key, value, description }).returning();
    return result[0];
  }

  async getSmsTemplates(): Promise<SmsTemplate[]> {
    return db.select().from(smsTemplates);
  }

  async getSmsTemplate(id: string): Promise<SmsTemplate | undefined> {
    const result = await db.select().from(smsTemplates).where(eq(smsTemplates.id, id));
    return result[0];
  }

  async getSmsTemplateByCategory(category: string): Promise<SmsTemplate | undefined> {
    const result = await db.select().from(smsTemplates)
      .where(and(eq(smsTemplates.category, category), eq(smsTemplates.isActive, true)));
    return result[0];
  }

  async createSmsTemplate(template: InsertSmsTemplate): Promise<SmsTemplate> {
    const result = await db.insert(smsTemplates).values(template).returning();
    return result[0];
  }

  async updateSmsTemplate(id: string, updates: Partial<InsertSmsTemplate>): Promise<SmsTemplate | undefined> {
    const result = await db.update(smsTemplates).set({ ...updates, updatedAt: new Date() })
      .where(eq(smsTemplates.id, id)).returning();
    return result[0];
  }

  async deleteSmsTemplate(id: string): Promise<boolean> {
    const template = await this.getSmsTemplate(id);
    if (template?.isSystem) return false;
    const result = await db.delete(smsTemplates).where(eq(smsTemplates.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Shift Templates
  async getShiftTemplates(): Promise<ShiftTemplate[]> {
    return db.select().from(shiftTemplates);
  }

  async getShiftTemplate(id: string): Promise<ShiftTemplate | undefined> {
    const result = await db.select().from(shiftTemplates).where(eq(shiftTemplates.id, id));
    return result[0];
  }

  async createShiftTemplate(template: InsertShiftTemplate): Promise<ShiftTemplate> {
    const result = await db.insert(shiftTemplates).values(template).returning();
    return result[0];
  }

  async updateShiftTemplate(id: string, updates: Partial<InsertShiftTemplate>): Promise<ShiftTemplate | undefined> {
    const result = await db.update(shiftTemplates).set({ ...updates, updatedAt: new Date() })
      .where(eq(shiftTemplates.id, id)).returning();
    return result[0];
  }

  async deleteShiftTemplate(id: string): Promise<boolean> {
    const result = await db.delete(shiftTemplates).where(eq(shiftTemplates.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}
