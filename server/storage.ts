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
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { randomUUID, scryptSync, randomBytes } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getUserByEmployeeId(employeeId: string): Promise<User | undefined>;

  sessionStore: session.Store;

  // Roles
  getRoles(): Promise<Role[]>;
  getRole(id: string): Promise<Role | undefined>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: string, role: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: string): Promise<boolean>;

  // Areas

  // Areas
  getAreas(): Promise<Area[]>;
  getArea(id: string): Promise<Area | undefined>;
  createArea(area: InsertArea): Promise<Area>;
  updateArea(id: string, area: Partial<InsertArea>): Promise<Area | undefined>;
  deleteArea(id: string, reassignToId?: string): Promise<boolean>;

  // Positions
  getPositions(): Promise<Position[]>;
  getPosition(id: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePosition(id: string, position: Partial<InsertPosition>): Promise<Position | undefined>;
  deletePosition(id: string, reassignToId?: string): Promise<boolean>;

  // Employees
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<boolean>;

  // Employee-Area assignments
  getEmployeeAreas(employeeId: string): Promise<Area[]>;
  getAreaEmployees(areaId: string): Promise<Employee[]>;
  assignEmployeeToArea(assignment: InsertEmployeeArea): Promise<EmployeeArea>;
  removeEmployeeFromArea(employeeId: string, areaId: string): Promise<boolean>;
  setEmployeeAreas(employeeId: string, areaIds: string[]): Promise<void>;

  // Shifts
  getShifts(): Promise<Shift[]>;
  getShift(id: string): Promise<Shift | undefined>;
  getShiftBySmsCode(smsCode: string): Promise<Shift | undefined>;
  getShiftsByArea(areaId: string): Promise<Shift[]>;
  createShift(shift: InsertShift): Promise<Shift>;
  updateShift(id: string, shift: Partial<InsertShift>): Promise<Shift | undefined>;
  deleteShift(id: string): Promise<boolean>;

  // Shift interests
  getShiftInterests(shiftId: string): Promise<(ShiftInterest & { employee: Employee })[]>;
  getShiftInterestByEmployeeAndShift(employeeId: string, shiftId: string): Promise<ShiftInterest | undefined>;
  getEmployeeShiftInterests(employeeId: string): Promise<(ShiftInterest & { shift: Shift })[]>;
  createShiftInterest(interest: InsertShiftInterest): Promise<ShiftInterest>;
  deleteShiftInterest(shiftId: string, employeeId: string): Promise<boolean>;

  // Messages
  getMessages(filters?: { employeeId?: string; messageType?: string; relatedShiftId?: string }): Promise<Message[]>;
  getEmployeeMessages(employeeId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined>;
  getMessageByTwilioSid(twilioSid: string): Promise<Message | undefined>;
  getMessageByProviderMessageId(providerMessageId: string): Promise<Message | undefined>;
  getMessageThread(threadId: string): Promise<Message[]>;

  // Trainings
  getTrainings(): Promise<Training[]>;
  getTraining(id: string): Promise<Training | undefined>;
  createTraining(training: InsertTraining): Promise<Training>;
  updateTraining(id: string, training: Partial<InsertTraining>): Promise<Training | undefined>;
  deleteTraining(id: string): Promise<boolean>;

  // Audit Logs
  getAuditLogs(options?: { limit?: number; offset?: number; action?: string; actorId?: string; targetType?: string }): Promise<AuditLog[]>;
  getAuditLog(id: string): Promise<AuditLog | undefined>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Organization Settings
  getSettings(): Promise<OrganizationSetting[]>;
  getSetting(key: string): Promise<OrganizationSetting | undefined>;
  setSetting(key: string, value: string, description?: string): Promise<OrganizationSetting>;

  // SMS Templates
  getSmsTemplates(): Promise<SmsTemplate[]>;
  getSmsTemplate(id: string): Promise<SmsTemplate | undefined>;
  getSmsTemplateByCategory(category: string): Promise<SmsTemplate | undefined>;
  createSmsTemplate(template: InsertSmsTemplate): Promise<SmsTemplate>;
  updateSmsTemplate(id: string, template: Partial<InsertSmsTemplate>): Promise<SmsTemplate | undefined>;
  deleteSmsTemplate(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private roles: Map<string, Role>;
  private areas: Map<string, Area>;
  private positions: Map<string, Position>;
  private employees: Map<string, Employee>;
  private employeeAreas: Map<string, EmployeeArea>;
  private shifts: Map<string, Shift>;
  private shiftInterests: Map<string, ShiftInterest>;
  private messages: Map<string, Message>;
  private trainings: Map<string, Training>;
  private auditLogs: Map<string, AuditLog>;
  private organizationSettings: Map<string, OrganizationSetting>;
  private smsTemplates: Map<string, SmsTemplate>;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.roles = new Map();
    this.areas = new Map();
    this.positions = new Map();
    this.employees = new Map();
    this.employeeAreas = new Map();
    this.shifts = new Map();
    this.shiftInterests = new Map();
    this.messages = new Map();
    this.trainings = new Map();
    this.auditLogs = new Map();
    this.organizationSettings = new Map();
    this.smsTemplates = new Map();
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });

    // Initialize minimal data (admin user only, no seed data)
    this.initializeMinimalData();
  }

  private initializeMinimalData(): void {
    // Create default roles
    const defaultRoles: Role[] = [
      { id: "role-admin", name: "Admin", description: "Full system access", permissions: ["manage_shifts", "view_shifts", "manage_employees", "view_reports", "export_reports", "view_audit_log", "manage_settings"], isSystem: true },
      { id: "role-supervisor", name: "Supervisor", description: "Manage shifts and employees", permissions: ["manage_shifts", "view_shifts", "manage_employees", "view_reports", "export_reports", "view_audit_log"], isSystem: true },
      { id: "role-employee", name: "Employee", description: "View and claim shifts", permissions: ["view_shifts"], isSystem: true },
    ];
    defaultRoles.forEach(r => this.roles.set(r.id, r));

    // Create admin position
    const adminPosition: Position = { id: "pos-admin", title: "Administrator", description: "Facility administrator" };
    this.positions.set(adminPosition.id, adminPosition);

    // Create pmorrison admin employee
    const adminEmployee: Employee = {
      id: "emp-admin-1",
      name: "Patricia Morrison",
      phone: "+15559001001",
      email: "pmorrison@facility.com",
      positionId: "pos-admin",
      role: "admin",
      roleId: "role-admin",
      status: "active",
      smsOptIn: true,
    };
    this.employees.set(adminEmployee.id, adminEmployee);

    // Create pmorrison user account (password: admin123)
    const salt = randomBytes(16).toString("hex");
    const hashedPassword = scryptSync("admin123", salt, 64).toString("hex") + "." + salt;
    const adminUser: User = {
      id: "user-admin-1",
      username: "pmorrison",
      password: hashedPassword,
      role: "admin",
      roleId: "role-admin",
      employeeId: "emp-admin-1",
    };
    this.users.set(adminUser.id, adminUser);
  }

  // Generate unique SMS code for seed data (uses provided Set to track)
  private generateSeedSmsCode(usedCodes: Set<string>): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      attempts++;
    } while (usedCodes.has(code) && attempts < 100);
    usedCodes.add(code);
    return code;
  }

  private initializeSeedData(): void {
    // === AREAS (2 programs: ICF with 5 homes, Waiver with 15 homes) ===
    const sampleAreas: Area[] = [
      { id: "area-icf", name: "ICF", description: "Intermediate Care Facility - 5 homes serving individuals with developmental disabilities", smsEnabled: true },
      { id: "area-waiver", name: "Waiver", description: "Home and Community Based Waiver Services - 15 homes", smsEnabled: true },
    ];
    sampleAreas.forEach(a => this.areas.set(a.id, a));

    // === POSITIONS ===
    const samplePositions: Position[] = [
      { id: "pos-admin", title: "Administrator", description: "Facility administrator" },
      { id: "pos-asst-admin", title: "Assistant Administrator", description: "Assistant to the administrator" },
      { id: "pos-hr", title: "HR Director", description: "Human Resources Director" },
      { id: "pos-sup-icf", title: "ICF Program Supervisor", description: "Supervisor for ICF program" },
      { id: "pos-sup-waiver", title: "Waiver Program Supervisor", description: "Supervisor for Waiver program" },
      { id: "pos-dsp", title: "DSP", description: "Direct Support Professional" },
      { id: "pos-cna", title: "CNA", description: "Certified Nursing Assistant" },
      { id: "pos-med", title: "Med Tech", description: "Medication Technician" },
    ];
    samplePositions.forEach(p => this.positions.set(p.id, p));

    // === EMPLOYEES ===
    // 100 residents / 8 per shift = 12.5 staff needed per shift minimum
    // 24/7 coverage = 3 shifts × 12.5 = ~38 staff minimum, but with days off need ~55-60 DSPs
    // Plus supervisors, CNAs, Med Techs, and Admin

    // === ROLES ===
    const sampleRoles: Role[] = [
      { id: "role-admin", name: "Admin", description: "Full system access", permissions: ["manage_shifts", "view_shifts", "manage_employees", "view_reports", "export_reports", "view_audit_log", "manage_settings"], isSystem: true },
      { id: "role-supervisor", name: "Supervisor", description: "Manage shifts and employees", permissions: ["manage_shifts", "view_shifts", "manage_employees", "view_reports", "export_reports", "view_audit_log"], isSystem: true },
      { id: "role-employee", name: "Employee", description: "View and claim shifts", permissions: ["view_shifts"], isSystem: true },
    ];
    sampleRoles.forEach(r => this.roles.set(r.id, r));

    const sampleEmployees: any[] = [
      // Admin Staff (3) - Full access
      { id: "emp-admin-1", name: "Patricia Morrison", phone: "+15559001001", email: "pmorrison@facility.com", positionId: "pos-admin", role: "admin", status: "active", smsOptIn: true },
      { id: "emp-admin-2", name: "Robert Chen", phone: "+15559001002", email: "rchen@facility.com", positionId: "pos-asst-admin", role: "admin", status: "active", smsOptIn: true },
      { id: "emp-admin-3", name: "Diana Reeves", phone: "+15559001003", email: "dreeves@facility.com", positionId: "pos-hr", role: "admin", status: "active", smsOptIn: true },

      // ICF Program Supervisors (3)
      { id: "emp-sup-icf-1", name: "Marcus Johnson", phone: "+15559002001", email: "mjohnson@facility.com", positionId: "pos-sup-icf", role: "supervisor", status: "active", smsOptIn: true },
      { id: "emp-sup-icf-2", name: "Angela Martinez", phone: "+15559002002", email: "amartinez@facility.com", positionId: "pos-sup-icf", role: "supervisor", status: "active", smsOptIn: true },
      { id: "emp-sup-icf-3", name: "Kevin O'Brien", phone: "+15559002003", email: "kobrien@facility.com", positionId: "pos-sup-icf", role: "supervisor", status: "active", smsOptIn: true },

      // Waiver Program Supervisors (4)
      { id: "emp-sup-waiver-1", name: "Lisa Thompson", phone: "+15559003001", email: "lthompson@facility.com", positionId: "pos-sup-waiver", role: "supervisor", status: "active", smsOptIn: true },
      { id: "emp-sup-waiver-2", name: "David Williams", phone: "+15559003002", email: "dwilliams@facility.com", positionId: "pos-sup-waiver", role: "supervisor", status: "active", smsOptIn: true },
      { id: "emp-sup-waiver-3", name: "Michelle Garcia", phone: "+15559003003", email: "mgarcia@facility.com", positionId: "pos-sup-waiver", role: "supervisor", status: "active", smsOptIn: true },
      { id: "emp-sup-waiver-4", name: "James Brown", phone: "+15559003004", email: "jbrown@facility.com", positionId: "pos-sup-waiver", role: "supervisor", status: "active", smsOptIn: true },

      // ICF DSPs (18 - covering 5 homes, ~25 residents)
      { id: "emp-dsp-icf-1", name: "Sarah Mitchell", phone: "+15559101001", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-2", name: "Michael Davis", phone: "+15559101002", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-3", name: "Jennifer Wilson", phone: "+15559101003", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-4", name: "Christopher Moore", phone: "+15559101004", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-5", name: "Amanda Taylor", phone: "+15559101005", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-6", name: "Joshua Anderson", phone: "+15559101006", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-7", name: "Ashley Thomas", phone: "+15559101007", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-8", name: "Matthew Jackson", phone: "+15559101008", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-9", name: "Brittany White", phone: "+15559101009", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-10", name: "Daniel Harris", phone: "+15559101010", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-11", name: "Stephanie Martin", phone: "+15559101011", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-12", name: "Ryan Thompson", phone: "+15559101012", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-13", name: "Nicole Garcia", phone: "+15559101013", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-14", name: "Brandon Martinez", phone: "+15559101014", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-15", name: "Megan Robinson", phone: "+15559101015", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-16", name: "Tyler Clark", phone: "+15559101016", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-17", name: "Kayla Rodriguez", phone: "+15559101017", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-icf-18", name: "Justin Lewis", phone: "+15559101018", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },

      // Waiver DSPs (35 - covering 15 homes, ~75 residents)
      { id: "emp-dsp-waiver-1", name: "Emily Walker", phone: "+15559201001", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-2", name: "Jacob Hall", phone: "+15559201002", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-3", name: "Samantha Allen", phone: "+15559201003", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-4", name: "Andrew Young", phone: "+15559201004", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-5", name: "Rachel Hernandez", phone: "+15559201005", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-6", name: "Nathan King", phone: "+15559201006", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-7", name: "Lauren Wright", phone: "+15559201007", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-8", name: "Zachary Lopez", phone: "+15559201008", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-9", name: "Hannah Hill", phone: "+15559201009", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-10", name: "Ethan Scott", phone: "+15559201010", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-11", name: "Olivia Green", phone: "+15559201011", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-12", name: "Dylan Adams", phone: "+15559201012", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-13", name: "Alexis Baker", phone: "+15559201013", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-14", name: "Cameron Nelson", phone: "+15559201014", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-15", name: "Madison Carter", phone: "+15559201015", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-16", name: "Logan Mitchell", phone: "+15559201016", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-17", name: "Taylor Perez", phone: "+15559201017", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-18", name: "Jordan Roberts", phone: "+15559201018", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-19", name: "Morgan Turner", phone: "+15559201019", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-20", name: "Alyssa Phillips", phone: "+15559201020", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-21", name: "Austin Campbell", phone: "+15559201021", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-22", name: "Paige Parker", phone: "+15559201022", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-23", name: "Blake Evans", phone: "+15559201023", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-24", name: "Chloe Edwards", phone: "+15559201024", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-25", name: "Connor Collins", phone: "+15559201025", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-26", name: "Grace Stewart", phone: "+15559201026", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-27", name: "Ian Sanchez", phone: "+15559201027", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-28", name: "Julia Morris", phone: "+15559201028", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-29", name: "Kyle Rogers", phone: "+15559201029", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-30", name: "Leah Reed", phone: "+15559201030", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-31", name: "Mason Cook", phone: "+15559201031", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-32", name: "Natalie Morgan", phone: "+15559201032", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-33", name: "Owen Bell", phone: "+15559201033", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-34", name: "Peyton Murphy", phone: "+15559201034", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-dsp-waiver-35", name: "Quinn Bailey", phone: "+15559201035", email: null, positionId: "pos-dsp", role: "employee", status: "active", smsOptIn: true },

      // CNAs (5 - Float between programs)
      { id: "emp-cna-1", name: "Rebecca Rivera", phone: "+15559301001", email: null, positionId: "pos-cna", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-cna-2", name: "Sean Cooper", phone: "+15559301002", email: null, positionId: "pos-cna", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-cna-3", name: "Tiffany Richardson", phone: "+15559301003", email: null, positionId: "pos-cna", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-cna-4", name: "Victor Cox", phone: "+15559301004", email: null, positionId: "pos-cna", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-cna-5", name: "Whitney Howard", phone: "+15559301005", email: null, positionId: "pos-cna", role: "employee", status: "active", smsOptIn: true },

      // Med Techs (4)
      { id: "emp-med-1", name: "Xavier Ward", phone: "+15559401001", email: "xward@facility.com", positionId: "pos-med", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-med-2", name: "Yolanda Torres", phone: "+15559401002", email: "ytorres@facility.com", positionId: "pos-med", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-med-3", name: "Zach Peterson", phone: "+15559401003", email: "zpeterson@facility.com", positionId: "pos-med", role: "employee", status: "active", smsOptIn: true },
      { id: "emp-med-4", name: "Amy Gray", phone: "+15559401004", email: "agray@facility.com", positionId: "pos-med", role: "employee", status: "active", smsOptIn: true },

      // Inactive employees (2)
      { id: "emp-inactive-1", name: "Brian Ramirez", phone: "+15559501001", email: null, positionId: "pos-dsp", role: "employee", status: "inactive", smsOptIn: false },
      { id: "emp-inactive-2", name: "Christina James", phone: "+15559501002", email: null, positionId: "pos-dsp", role: "employee", status: "inactive", smsOptIn: false },
    ];
    sampleEmployees.forEach(e => {
      const roleId = e.role === 'admin' ? 'role-admin' : (e.role === 'supervisor' ? 'role-supervisor' : 'role-employee');
      this.employees.set(e.id, { ...e, roleId } as Employee);
    });

    // === EMPLOYEE-AREA ASSIGNMENTS ===
    const areaAssignments: EmployeeArea[] = [
      // Admin - assigned to both areas
      { id: "ea-admin-1a", employeeId: "emp-admin-1", areaId: "area-icf" },
      { id: "ea-admin-1b", employeeId: "emp-admin-1", areaId: "area-waiver" },
      { id: "ea-admin-2a", employeeId: "emp-admin-2", areaId: "area-icf" },
      { id: "ea-admin-2b", employeeId: "emp-admin-2", areaId: "area-waiver" },
      { id: "ea-admin-3a", employeeId: "emp-admin-3", areaId: "area-icf" },
      { id: "ea-admin-3b", employeeId: "emp-admin-3", areaId: "area-waiver" },

      // ICF Supervisors - ICF only
      { id: "ea-sup-icf-1", employeeId: "emp-sup-icf-1", areaId: "area-icf" },
      { id: "ea-sup-icf-2", employeeId: "emp-sup-icf-2", areaId: "area-icf" },
      { id: "ea-sup-icf-3", employeeId: "emp-sup-icf-3", areaId: "area-icf" },

      // Waiver Supervisors - Waiver only
      { id: "ea-sup-waiver-1", employeeId: "emp-sup-waiver-1", areaId: "area-waiver" },
      { id: "ea-sup-waiver-2", employeeId: "emp-sup-waiver-2", areaId: "area-waiver" },
      { id: "ea-sup-waiver-3", employeeId: "emp-sup-waiver-3", areaId: "area-waiver" },
      { id: "ea-sup-waiver-4", employeeId: "emp-sup-waiver-4", areaId: "area-waiver" },

      // ICF DSPs - ICF only
      ...Array.from({ length: 18 }, (_, i) => ({
        id: `ea-dsp-icf-${i + 1}`,
        employeeId: `emp-dsp-icf-${i + 1}`,
        areaId: "area-icf",
      })),

      // Waiver DSPs - Waiver only
      ...Array.from({ length: 35 }, (_, i) => ({
        id: `ea-dsp-waiver-${i + 1}`,
        employeeId: `emp-dsp-waiver-${i + 1}`,
        areaId: "area-waiver",
      })),

      // CNAs - both areas (can float)
      { id: "ea-cna-1a", employeeId: "emp-cna-1", areaId: "area-icf" },
      { id: "ea-cna-1b", employeeId: "emp-cna-1", areaId: "area-waiver" },
      { id: "ea-cna-2a", employeeId: "emp-cna-2", areaId: "area-icf" },
      { id: "ea-cna-2b", employeeId: "emp-cna-2", areaId: "area-waiver" },
      { id: "ea-cna-3a", employeeId: "emp-cna-3", areaId: "area-icf" },
      { id: "ea-cna-3b", employeeId: "emp-cna-3", areaId: "area-waiver" },
      { id: "ea-cna-4a", employeeId: "emp-cna-4", areaId: "area-icf" },
      { id: "ea-cna-4b", employeeId: "emp-cna-4", areaId: "area-waiver" },
      { id: "ea-cna-5a", employeeId: "emp-cna-5", areaId: "area-icf" },
      { id: "ea-cna-5b", employeeId: "emp-cna-5", areaId: "area-waiver" },

      // Med Techs - both areas
      { id: "ea-med-1a", employeeId: "emp-med-1", areaId: "area-icf" },
      { id: "ea-med-1b", employeeId: "emp-med-1", areaId: "area-waiver" },
      { id: "ea-med-2a", employeeId: "emp-med-2", areaId: "area-icf" },
      { id: "ea-med-2b", employeeId: "emp-med-2", areaId: "area-waiver" },
      { id: "ea-med-3a", employeeId: "emp-med-3", areaId: "area-icf" },
      { id: "ea-med-3b", employeeId: "emp-med-3", areaId: "area-waiver" },
      { id: "ea-med-4a", employeeId: "emp-med-4", areaId: "area-icf" },
      { id: "ea-med-4b", employeeId: "emp-med-4", areaId: "area-waiver" },
    ];
    areaAssignments.forEach(ea => this.employeeAreas.set(ea.id, ea));

    // === SHIFTS (6 weeks of data) ===
    // ICF Homes: icfhome1-5, Waiver Homes: waiverhome1-15
    const icfHomes = ["ICF Home 1", "ICF Home 2", "ICF Home 3", "ICF Home 4", "ICF Home 5"];
    const waiverHomes = Array.from({ length: 15 }, (_, i) => `Waiver Home ${i + 1}`);

    const shiftTimes = [
      { start: "07:00", end: "15:00", name: "Day" },
      { start: "15:00", end: "23:00", name: "Evening" },
      { start: "23:00", end: "07:00", name: "Night" },
    ];

    const supervisorNames = [
      "Marcus Johnson", "Angela Martinez", "Kevin O'Brien",
      "Lisa Thompson", "David Williams", "Michelle Garcia", "James Brown"
    ];

    // Generate dates for 6 weeks (past 3 weeks + future 3 weeks)
    const today = new Date();
    const shifts: Shift[] = [];
    let shiftIndex = 0;
    const usedSmsCodes = new Set<string>(); // Track used SMS codes during seed generation

    // Past 3 weeks + current week + future 2 weeks = 6 weeks
    for (let weekOffset = -3; weekOffset <= 2; weekOffset++) {
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const shiftDate = new Date(today);
        shiftDate.setDate(today.getDate() + (weekOffset * 7) + dayOffset - today.getDay());

        const dateStr = shiftDate.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric"
        });

        // Determine if this is past, current, or future
        const isPast = shiftDate < today;
        const isToday = shiftDate.toDateString() === today.toDateString();

        // Generate shifts for a subset of homes each day (simulate realistic coverage gaps)
        // ICF: 2-3 shifts per day needing coverage
        const icfShiftsNeeded = Math.floor(Math.random() * 2) + 2;
        const shuffledIcfHomes = [...icfHomes].sort(() => Math.random() - 0.5);

        for (let i = 0; i < icfShiftsNeeded; i++) {
          const home = shuffledIcfHomes[i];
          const shift = shiftTimes[Math.floor(Math.random() * shiftTimes.length)];
          const postedBy = supervisorNames[Math.floor(Math.random() * 3)]; // ICF supervisors

          // Determine status
          let status: "available" | "claimed" | "expired" = "available";
          let assignedEmployeeId: string | null = null;

          if (isPast) {
            // Past shifts: 80% claimed, 20% expired
            if (Math.random() < 0.8) {
              status = "claimed";
              // Assign to random ICF DSP
              const dspIndex = Math.floor(Math.random() * 18) + 1;
              assignedEmployeeId = `emp-dsp-icf-${dspIndex}`;
            } else {
              status = "expired";
            }
          } else if (!isToday && Math.random() < 0.3) {
            // Future shifts: 30% already claimed
            status = "claimed";
            const dspIndex = Math.floor(Math.random() * 18) + 1;
            assignedEmployeeId = `emp-dsp-icf-${dspIndex}`;
          }

          const createdAt = new Date(shiftDate);
          createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 7) - 1);

          shifts.push({
            id: `shift-icf-${++shiftIndex}`,
            positionId: "pos-dsp",
            areaId: "area-icf",
            location: home,
            date: dateStr,
            startTime: shift.start,
            endTime: shift.end,
            requirements: Math.random() < 0.3 ? "Must have behavioral support training" : null,
            postedById: null,
            postedByName: postedBy,
            status,
            assignedEmployeeId,
            smsCode: this.generateSeedSmsCode(usedSmsCodes),
            createdAt,
          });
        }

        // Waiver: 5-8 shifts per day needing coverage
        const waiverShiftsNeeded = Math.floor(Math.random() * 4) + 5;
        const shuffledWaiverHomes = [...waiverHomes].sort(() => Math.random() - 0.5);

        for (let i = 0; i < waiverShiftsNeeded; i++) {
          const home = shuffledWaiverHomes[i];
          const shift = shiftTimes[Math.floor(Math.random() * shiftTimes.length)];
          const postedBy = supervisorNames[3 + Math.floor(Math.random() * 4)]; // Waiver supervisors

          let status: "available" | "claimed" | "expired" = "available";
          let assignedEmployeeId: string | null = null;

          if (isPast) {
            if (Math.random() < 0.75) {
              status = "claimed";
              const dspIndex = Math.floor(Math.random() * 35) + 1;
              assignedEmployeeId = `emp-dsp-waiver-${dspIndex}`;
            } else {
              status = "expired";
            }
          } else if (!isToday && Math.random() < 0.25) {
            status = "claimed";
            const dspIndex = Math.floor(Math.random() * 35) + 1;
            assignedEmployeeId = `emp-dsp-waiver-${dspIndex}`;
          }

          const createdAt = new Date(shiftDate);
          createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 7) - 1);

          shifts.push({
            id: `shift-waiver-${++shiftIndex}`,
            positionId: "pos-dsp",
            areaId: "area-waiver",
            location: home,
            date: dateStr,
            startTime: shift.start,
            endTime: shift.end,
            requirements: Math.random() < 0.2 ? "CPR certification required" : null,
            postedById: null,
            postedByName: postedBy,
            status,
            assignedEmployeeId,
            smsCode: this.generateSeedSmsCode(usedSmsCodes),
            createdAt,
          });
        }
      }
    }
    shifts.forEach(s => this.shifts.set(s.id, s));

    // === SHIFT INTERESTS (for available shifts) ===
    const availableShifts = shifts.filter(s => s.status === "available");
    let interestIndex = 0;

    availableShifts.forEach(shift => {
      // 30-70% of available shifts have 1-4 interested employees
      if (Math.random() < 0.5) {
        const numInterested = Math.floor(Math.random() * 4) + 1;
        const isIcf = shift.areaId === "area-icf";
        const maxDsp = isIcf ? 18 : 35;
        const prefix = isIcf ? "emp-dsp-icf-" : "emp-dsp-waiver-";

        const interestedDsps = new Set<number>();
        while (interestedDsps.size < numInterested) {
          interestedDsps.add(Math.floor(Math.random() * maxDsp) + 1);
        }

        interestedDsps.forEach(dspNum => {
          const interestCreatedAt = new Date(shift.createdAt);
          interestCreatedAt.setHours(interestCreatedAt.getHours() + Math.floor(Math.random() * 48));

          const interest: ShiftInterest = {
            id: `interest-${++interestIndex}`,
            shiftId: shift.id,
            employeeId: `${prefix}${dspNum}`,
            createdAt: interestCreatedAt,
          };
          this.shiftInterests.set(interest.id, interest);
        });
      }
    });

    // === USERS ===
    // Create a user account for every employee
    // Username format: first initial + lastname (e.g., "Patricia Morrison" -> "pmorrison")
    // Password: "password" for all accounts
    const salt = randomBytes(16).toString("hex");
    const buf = scryptSync("password", salt, 64) as Buffer;
    const hashedPassword = `${buf.toString("hex")}.${salt}`;

    this.employees.forEach(employee => {
      // Create username from name: first initial + lastname (lowercase)
      const nameParts = employee.name.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts[nameParts.length - 1] || "";
      const baseUsername = (firstName.charAt(0) + lastName).toLowerCase();

      // Handle duplicates (simple append)
      let uniqueUsername = baseUsername;
      let counter = 1;
      while (Array.from(this.users.values()).some(u => u.username === uniqueUsername)) {
        uniqueUsername = `${baseUsername}${counter++}`;
      }

      const userId = randomUUID();
      const user: User = {
        id: userId,
        username: uniqueUsername,
        password: hashedPassword,
        role: employee.role,
        roleId: employee.roleId,
        employeeId: employee.id,
      };
      this.users.set(userId, user);
    });

    // === DEFAULT ORGANIZATION SETTINGS ===
    const defaultSettings: { key: string; value: string; description: string }[] = [
      { key: "urgent_shift_threshold_hours", value: "48", description: "Hours before shift start to consider it urgent (shown on dashboard)" },
      // Twilio SMS settings
      { key: "twilio_account_sid", value: "", description: "Twilio Account SID" },
      { key: "twilio_auth_token", value: "", description: "Twilio Auth Token (stored securely)" },
      { key: "twilio_from_number", value: "", description: "Twilio phone number for sending SMS" },
      { key: "twilio_messaging_service_sid", value: "", description: "Optional Twilio Messaging Service SID for high-volume sending" },
      { key: "sms_enabled", value: "false", description: "Master toggle for SMS functionality" },
      { key: "sms_daily_limit", value: "1000", description: "Maximum SMS messages per day" },
      { key: "sms_rate_limit_per_minute", value: "60", description: "Maximum SMS messages per minute" },
      // SMS notification settings
      { key: "notify_on_new_shift", value: "true", description: "Send SMS when new shifts are posted" },
      { key: "notify_on_shift_claimed", value: "true", description: "Send confirmation when shift is claimed" },
      { key: "shift_reminder_enabled", value: "true", description: "Send reminder before shifts" },
      { key: "shift_reminder_hours", value: "24", description: "Hours before shift to send reminder" },
      { key: "notify_admin_on_claim", value: "false", description: "Notify admin when shifts are claimed" },
      // SMS shift interest settings
      { key: "sms_shift_interest_enabled", value: "true", description: "Allow employees to express shift interest via SMS" },
      { key: "sms_auto_assign_single_interest", value: "false", description: "Auto-assign shifts when only one employee expresses interest" },
      { key: "sms_interest_window_hours", value: "24", description: "Hours to wait for interests before escalating" },
      { key: "sms_notify_filled_to_others", value: "true", description: "Notify other interested employees when shift is filled" },
      // Quiet hours
      { key: "sms_quiet_hours_start", value: "22:00", description: "Start of quiet hours (no SMS)" },
      { key: "sms_quiet_hours_end", value: "07:00", description: "End of quiet hours" },
      { key: "sms_respect_quiet_hours", value: "true", description: "Respect quiet hours for non-urgent messages" },
    ];
    defaultSettings.forEach(s => {
      const id = randomUUID();
      this.organizationSettings.set(id, {
        id,
        key: s.key,
        value: s.value,
        description: s.description,
        updatedAt: new Date(),
      });
    });

    // === DEFAULT SMS TEMPLATES ===
    const defaultTemplates: Array<{
      name: string;
      description: string;
      category: string;
      content: string;
      isSystem: boolean;
    }> = [
      {
        name: "New Shift Available",
        description: "Notification sent to eligible employees when a new shift is posted. Includes SMS code and reply instructions.",
        category: "shift_notification",
        content: "[ShiftConnect] New Shift Available!\n\nDate: {{date}}\nTime: {{startTime}} - {{endTime}}\nLocation: {{location}}{{area}}\nCode: {{smsCode}}\n\nReply YES to express interest or NO to pass.\n\nReply STOP to unsubscribe.",
        isSystem: true,
      },
      {
        name: "Shift Confirmation",
        description: "Confirmation sent when an employee is assigned to a shift. Includes CONFIRM instruction.",
        category: "shift_confirmation",
        content: "[ShiftConnect] Shift Assigned!\n\nHi {{employeeName}},\n\nYou've been assigned:\nDate: {{date}}\nTime: {{startTime}} - {{endTime}}\nLocation: {{location}}{{area}}\n\nReply CONFIRM to acknowledge or CANCEL if you can no longer work.\n\nPlease arrive 10 minutes early.\n\nReply STOP to unsubscribe.",
        isSystem: true,
      },
      {
        name: "Shift Reminder",
        description: "Reminder sent to employees before their scheduled shift starts.",
        category: "shift_reminder",
        content: "[ShiftConnect] Shift Reminder\n\nHi {{employeeName}},\n\nYour shift is coming up!\nDate: {{date}}\nTime: {{startTime}} - {{endTime}}\nLocation: {{location}}{{area}}\n\nPlease arrive on time and ready to work.\n\nReply STOP to unsubscribe.",
        isSystem: true,
      },
      {
        name: "General Message",
        description: "General purpose message template for direct communication with employees.",
        category: "general",
        content: "[ShiftConnect]\n\nHi {{employeeName}},\n\n{{message}}\n\nReply STOP to unsubscribe.",
        isSystem: true,
      },
      {
        name: "Bulk Announcement",
        description: "Template for sending announcements to multiple employees at once.",
        category: "bulk",
        content: "[ShiftConnect] Announcement\n\n{{message}}\n\nThis message was sent to all team members.\n\nReply STOP to unsubscribe.",
        isSystem: true,
      },
    ];
    const now = new Date();
    defaultTemplates.forEach(t => {
      const id = randomUUID();
      this.smsTemplates.set(id, {
        id,
        name: t.name,
        description: t.description,
        category: t.category,
        content: t.content,
        isSystem: t.isSystem,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      role: "employee",
      roleId: null, // Default
      employeeId: null
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    let updatedUser: User = { ...user, ...updates };

    if (updates.password) {
      const SALT_LENGTH = 32;
      const salt = randomBytes(SALT_LENGTH).toString("hex");
      const hashedPassword = scryptSync(updates.password, salt, 64).toString("hex");
      updatedUser.password = `${hashedPassword}.${salt}`;
    }

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getUserByEmployeeId(employeeId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.employeeId === employeeId,
    );
  }

  // Areas
  async getAreas(): Promise<Area[]> {
    return Array.from(this.areas.values());
  }

  async getArea(id: string): Promise<Area | undefined> {
    return this.areas.get(id);
  }

  async createArea(insertArea: InsertArea): Promise<Area> {
    const id = randomUUID();
    const area: Area = {
      id,
      name: insertArea.name,
      description: insertArea.description ?? null,
      smsEnabled: insertArea.smsEnabled ?? true,
    };
    this.areas.set(id, area);
    return area;
  }

  async updateArea(id: string, updates: Partial<InsertArea>): Promise<Area | undefined> {
    const area = this.areas.get(id);
    if (!area) return undefined;
    const updated = { ...area, ...updates };
    this.areas.set(id, updated);
    return updated;
  }

  async deleteArea(id: string, reassignToId?: string): Promise<boolean> {
    if (reassignToId) {
      if (!this.areas.has(reassignToId)) return false;

      // Reassign shifts
      Array.from(this.shifts.values())
        .filter(s => s.areaId === id)
        .forEach(s => {
          this.shifts.set(s.id, { ...s, areaId: reassignToId });
        });

      // Reassign employee areas
      // This is trickier because unique (employeeId, areaId) constraint
      const oldAssignments = Array.from(this.employeeAreas.values()).filter(ea => ea.areaId === id);

      for (const assignment of oldAssignments) {
        // Check if employee already has the target area
        const alreadyHasTarget = Array.from(this.employeeAreas.values())
          .some(ea => ea.employeeId === assignment.employeeId && ea.areaId === reassignToId);

        if (!alreadyHasTarget) {
          // If they don't have it, give it to them
          const newAssignment: EmployeeArea = {
            id: randomUUID(),
            employeeId: assignment.employeeId,
            areaId: reassignToId
          };
          this.employeeAreas.set(newAssignment.id, newAssignment);
        }
        // Always delete the old assignment
        this.employeeAreas.delete(assignment.id);
      }
    } else {
      // If no reassignment, we just cascade delete assignments? 
      // Or leave orphaned shifts? The user asked for safeguards.
      // For now, simple delete logic:
      Array.from(this.employeeAreas.values())
        .filter(ea => ea.areaId === id)
        .forEach(ea => this.employeeAreas.delete(ea.id));
    }
    return this.areas.delete(id);
  }

  // Roles
  async getRoles(): Promise<Role[]> {
    return Array.from(this.roles.values());
  }

  async getRole(id: string): Promise<Role | undefined> {
    return this.roles.get(id);
  }

  async createRole(insertRole: InsertRole): Promise<Role> {
    const id = randomUUID();
    const role: Role = {
      id,
      name: insertRole.name,
      description: insertRole.description ?? null,
      permissions: (insertRole.permissions as string[]) ?? [],
      isSystem: insertRole.isSystem ?? false,
    };
    this.roles.set(id, role);
    return role;
  }

  async updateRole(id: string, updates: Partial<InsertRole>): Promise<Role | undefined> {
    const role = this.roles.get(id);
    if (!role) return undefined;
    const updated: Role = {
      ...role,
      ...updates,
      permissions: (updates.permissions as string[]) ?? role.permissions,
    };
    this.roles.set(id, updated);
    return updated;
  }

  async deleteRole(id: string): Promise<boolean> {
    const role = this.roles.get(id);
    if (role?.isSystem) return false;
    return this.roles.delete(id);
  }

  // Positions
  async getPositions(): Promise<Position[]> {
    return Array.from(this.positions.values());
  }

  async getPosition(id: string): Promise<Position | undefined> {
    return this.positions.get(id);
  }

  async createPosition(insertPosition: InsertPosition): Promise<Position> {
    const id = randomUUID();
    const position: Position = {
      id,
      title: insertPosition.title,
      description: insertPosition.description ?? null,
    };
    this.positions.set(id, position);
    return position;
  }

  async updatePosition(id: string, updates: Partial<InsertPosition>): Promise<Position | undefined> {
    const position = this.positions.get(id);
    if (!position) return undefined;
    const updated = { ...position, ...updates };
    this.positions.set(id, updated);
    return updated;
  }

  async deletePosition(id: string, reassignToId?: string): Promise<boolean> {
    if (reassignToId) {
      if (!this.positions.has(reassignToId)) return false;

      // Reassign employees
      Array.from(this.employees.values())
        .filter(e => e.positionId === id)
        .forEach(e => {
          this.employees.set(e.id, { ...e, positionId: reassignToId });
        });

      // Reassign shifts (style/position requirement)
      Array.from(this.shifts.values())
        .filter(s => s.positionId === id)
        .forEach(s => {
          this.shifts.set(s.id, { ...s, positionId: reassignToId });
        });
    }
    return this.positions.delete(id);
  }

  // Employees
  async getEmployees(): Promise<Employee[]> {
    return Array.from(this.employees.values());
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    return this.employees.get(id);
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const id = randomUUID();
    const employee: Employee = {
      id,
      name: insertEmployee.name,
      phone: insertEmployee.phone,
      email: insertEmployee.email ?? null,
      positionId: insertEmployee.positionId,
      role: insertEmployee.role ?? "employee",
      roleId: insertEmployee.roleId ?? null,
      status: insertEmployee.status ?? "active",
      smsOptIn: insertEmployee.smsOptIn ?? true,
    };
    this.employees.set(id, employee);
    return employee;
  }

  async updateEmployee(id: string, updates: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const employee = this.employees.get(id);
    if (!employee) return undefined;
    const updated = { ...employee, ...updates };
    this.employees.set(id, updated);
    return updated;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    // Also remove area assignments
    Array.from(this.employeeAreas.values())
      .filter(ea => ea.employeeId === id)
      .forEach(ea => this.employeeAreas.delete(ea.id));
    return this.employees.delete(id);
  }

  // Employee-Area assignments
  async getEmployeeAreas(employeeId: string): Promise<Area[]> {
    const areaIds = Array.from(this.employeeAreas.values())
      .filter(ea => ea.employeeId === employeeId)
      .map(ea => ea.areaId);
    return Array.from(this.areas.values()).filter(a => areaIds.includes(a.id));
  }

  async getAreaEmployees(areaId: string): Promise<Employee[]> {
    const employeeIds = Array.from(this.employeeAreas.values())
      .filter(ea => ea.areaId === areaId)
      .map(ea => ea.employeeId);
    return Array.from(this.employees.values())
      .filter(e => employeeIds.includes(e.id) && e.status === "active" && e.smsOptIn);
  }

  async assignEmployeeToArea(assignment: InsertEmployeeArea): Promise<EmployeeArea> {
    // Check if already exists
    const existing = Array.from(this.employeeAreas.values())
      .find(ea => ea.employeeId === assignment.employeeId && ea.areaId === assignment.areaId);
    if (existing) return existing;

    const id = randomUUID();
    const employeeArea: EmployeeArea = { ...assignment, id };
    this.employeeAreas.set(id, employeeArea);
    return employeeArea;
  }

  async removeEmployeeFromArea(employeeId: string, areaId: string): Promise<boolean> {
    const entry = Array.from(this.employeeAreas.entries())
      .find(([_, ea]) => ea.employeeId === employeeId && ea.areaId === areaId);
    if (entry) {
      this.employeeAreas.delete(entry[0]);
      return true;
    }
    return false;
  }

  async setEmployeeAreas(employeeId: string, areaIds: string[]): Promise<void> {
    // Remove all existing
    Array.from(this.employeeAreas.entries())
      .filter(([_, ea]) => ea.employeeId === employeeId)
      .forEach(([key]) => this.employeeAreas.delete(key));
    // Add new ones
    for (const areaId of areaIds) {
      await this.assignEmployeeToArea({ employeeId, areaId });
    }
  }

  // Shifts
  async getShifts(): Promise<Shift[]> {
    return Array.from(this.shifts.values()).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getShift(id: string): Promise<Shift | undefined> {
    return this.shifts.get(id);
  }

  async getShiftBySmsCode(smsCode: string): Promise<Shift | undefined> {
    return Array.from(this.shifts.values()).find(s => s.smsCode === smsCode);
  }

  async getShiftsByArea(areaId: string): Promise<Shift[]> {
    return Array.from(this.shifts.values()).filter(s => s.areaId === areaId);
  }

  // Generate unique 6-character SMS code
  private generateSmsCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars O/0/I/1/L
    let code: string;
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      attempts++;
    } while (this.getShiftBySmsCodeSync(code) && attempts < 100);
    return code;
  }

  private getShiftBySmsCodeSync(smsCode: string): Shift | undefined {
    return Array.from(this.shifts.values()).find(s => s.smsCode === smsCode);
  }

  async createShift(insertShift: InsertShift): Promise<Shift> {
    const id = randomUUID();
    const smsCode = this.generateSmsCode();
    const shift: Shift = {
      id,
      positionId: insertShift.positionId,
      areaId: insertShift.areaId,
      location: insertShift.location,
      date: insertShift.date,
      startTime: insertShift.startTime,
      endTime: insertShift.endTime,
      requirements: insertShift.requirements ?? null,
      postedById: insertShift.postedById ?? null,
      postedByName: insertShift.postedByName,
      status: insertShift.status ?? "available",
      assignedEmployeeId: insertShift.assignedEmployeeId ?? null,
      smsCode,
      createdAt: new Date(),
    };
    this.shifts.set(id, shift);
    return shift;
  }

  async updateShift(id: string, updates: Partial<InsertShift>): Promise<Shift | undefined> {
    const shift = this.shifts.get(id);
    if (!shift) return undefined;
    const updated = { ...shift, ...updates };
    this.shifts.set(id, updated);
    return updated;
  }

  async deleteShift(id: string): Promise<boolean> {
    // Also remove interests
    Array.from(this.shiftInterests.values())
      .filter(si => si.shiftId === id)
      .forEach(si => this.shiftInterests.delete(si.id));
    return this.shifts.delete(id);
  }

  // Shift interests
  async getShiftInterests(shiftId: string): Promise<(ShiftInterest & { employee: Employee })[]> {
    const interests = Array.from(this.shiftInterests.values()).filter(si => si.shiftId === shiftId);
    return interests.map(si => {
      const employee = this.employees.get(si.employeeId);
      return { ...si, employee: employee! };
    }).filter(si => si.employee);
  }

  async getShiftInterestByEmployeeAndShift(employeeId: string, shiftId: string): Promise<ShiftInterest | undefined> {
    return Array.from(this.shiftInterests.values())
      .find(si => si.employeeId === employeeId && si.shiftId === shiftId);
  }

  async getEmployeeShiftInterests(employeeId: string): Promise<(ShiftInterest & { shift: Shift })[]> {
    const interests = Array.from(this.shiftInterests.values()).filter(si => si.employeeId === employeeId);
    return interests.map(si => {
      const shift = this.shifts.get(si.shiftId);
      return { ...si, shift: shift! };
    }).filter(si => si.shift);
  }

  async createShiftInterest(interest: InsertShiftInterest): Promise<ShiftInterest> {
    // Check if already exists
    const existing = Array.from(this.shiftInterests.values())
      .find(si => si.shiftId === interest.shiftId && si.employeeId === interest.employeeId);
    if (existing) return existing;

    const id = randomUUID();
    const shiftInterest: ShiftInterest = { ...interest, id, createdAt: new Date() };
    this.shiftInterests.set(id, shiftInterest);
    return shiftInterest;
  }

  async deleteShiftInterest(shiftId: string, employeeId: string): Promise<boolean> {
    const entry = Array.from(this.shiftInterests.entries())
      .find(([_, si]) => si.shiftId === shiftId && si.employeeId === employeeId);
    if (entry) {
      this.shiftInterests.delete(entry[0]);
      return true;
    }
    return false;
  }

  // Messages
  async getMessages(filters?: { employeeId?: string; messageType?: string; relatedShiftId?: string }): Promise<Message[]> {
    let messages = Array.from(this.messages.values());

    if (filters) {
      if (filters.employeeId) {
        messages = messages.filter(m => m.employeeId === filters.employeeId);
      }
      if (filters.messageType) {
        messages = messages.filter(m => m.messageType === filters.messageType);
      }
      if (filters.relatedShiftId) {
        messages = messages.filter(m => m.relatedShiftId === filters.relatedShiftId);
      }
    }

    return messages.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getEmployeeMessages(employeeId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(m => m.employeeId === employeeId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      id,
      employeeId: insertMessage.employeeId,
      direction: insertMessage.direction,
      content: insertMessage.content,
      status: insertMessage.status ?? "pending",
      // Provider-agnostic message tracking
      providerMessageId: insertMessage.providerMessageId ?? null,
      smsProvider: insertMessage.smsProvider ?? "twilio",
      // Legacy field for backwards compatibility
      twilioSid: insertMessage.twilioSid ?? null,
      // Delivery tracking
      deliveryStatus: insertMessage.deliveryStatus ?? null,
      deliveryTimestamp: insertMessage.deliveryTimestamp ?? null,
      errorCode: insertMessage.errorCode ?? null,
      errorMessage: insertMessage.errorMessage ?? null,
      segments: insertMessage.segments ?? 1,
      // Threading
      threadId: insertMessage.threadId ?? null,
      inReplyTo: insertMessage.inReplyTo ?? null,
      // Categorization
      messageType: insertMessage.messageType ?? "general",
      relatedShiftId: insertMessage.relatedShiftId ?? null,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;
    const updated = { ...message, ...updates };
    this.messages.set(id, updated);
    return updated;
  }

  async getMessageByTwilioSid(twilioSid: string): Promise<Message | undefined> {
    return Array.from(this.messages.values()).find(m => m.twilioSid === twilioSid);
  }

  async getMessageByProviderMessageId(providerMessageId: string): Promise<Message | undefined> {
    // Search by providerMessageId first, fall back to twilioSid for backwards compatibility
    return Array.from(this.messages.values()).find(
      m => m.providerMessageId === providerMessageId || m.twilioSid === providerMessageId
    );
  }

  async getMessageThread(threadId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(m => m.threadId === threadId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  // Trainings
  async getTrainings(): Promise<Training[]> {
    return Array.from(this.trainings.values());
  }

  async getTraining(id: string): Promise<Training | undefined> {
    return this.trainings.get(id);
  }

  async createTraining(insertTraining: InsertTraining): Promise<Training> {
    const id = randomUUID();
    const training: Training = {
      id,
      title: insertTraining.title,
      description: insertTraining.description ?? null,
      type: insertTraining.type,
      dueDate: insertTraining.dueDate ?? null,
      required: insertTraining.required ?? false,
      completedCount: insertTraining.completedCount ?? 0,
      totalAssigned: insertTraining.totalAssigned ?? 0,
      createdAt: new Date(),
    };
    this.trainings.set(id, training);
    return training;
  }

  async updateTraining(id: string, updates: Partial<InsertTraining>): Promise<Training | undefined> {
    const training = this.trainings.get(id);
    if (!training) return undefined;
    const updated = { ...training, ...updates };
    this.trainings.set(id, updated);
    return updated;
  }

  async deleteTraining(id: string): Promise<boolean> {
    return this.trainings.delete(id);
  }

  // Audit Logs
  async getAuditLogs(options?: { limit?: number; offset?: number; action?: string; actorId?: string; targetType?: string }): Promise<AuditLog[]> {
    let logs = Array.from(this.auditLogs.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (options?.action) {
      logs = logs.filter(l => l.action === options.action);
    }
    if (options?.actorId) {
      logs = logs.filter(l => l.actorId === options.actorId);
    }
    if (options?.targetType) {
      logs = logs.filter(l => l.targetType === options.targetType);
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    return logs.slice(offset, offset + limit);
  }

  async getAuditLog(id: string): Promise<AuditLog | undefined> {
    return this.auditLogs.get(id);
  }

  async createAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const log: AuditLog = {
      id,
      action: insertLog.action,
      actorId: insertLog.actorId ?? null,
      actorName: insertLog.actorName,
      targetType: insertLog.targetType,
      targetId: insertLog.targetId ?? null,
      targetName: insertLog.targetName ?? null,
      details: insertLog.details ?? null,
      ipAddress: insertLog.ipAddress ?? null,
      createdAt: new Date(),
    };
    this.auditLogs.set(id, log);
    return log;
  }

  // Organization Settings
  async getSettings(): Promise<OrganizationSetting[]> {
    return Array.from(this.organizationSettings.values());
  }

  async getSetting(key: string): Promise<OrganizationSetting | undefined> {
    return Array.from(this.organizationSettings.values()).find(s => s.key === key);
  }

  async setSetting(key: string, value: string, description?: string): Promise<OrganizationSetting> {
    const existing = await this.getSetting(key);
    if (existing) {
      const updated: OrganizationSetting = {
        ...existing,
        value,
        description: description ?? existing.description,
        updatedAt: new Date(),
      };
      this.organizationSettings.set(existing.id, updated);
      return updated;
    }

    const id = randomUUID();
    const setting: OrganizationSetting = {
      id,
      key,
      value,
      description: description ?? null,
      updatedAt: new Date(),
    };
    this.organizationSettings.set(id, setting);
    return setting;
  }

  // SMS Templates
  async getSmsTemplates(): Promise<SmsTemplate[]> {
    return Array.from(this.smsTemplates.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  async getSmsTemplate(id: string): Promise<SmsTemplate | undefined> {
    return this.smsTemplates.get(id);
  }

  async getSmsTemplateByCategory(category: string): Promise<SmsTemplate | undefined> {
    return Array.from(this.smsTemplates.values()).find(
      t => t.category === category && t.isActive
    );
  }

  async createSmsTemplate(template: InsertSmsTemplate): Promise<SmsTemplate> {
    const id = randomUUID();
    const now = new Date();
    const newTemplate: SmsTemplate = {
      id,
      name: template.name,
      description: template.description ?? null,
      category: template.category ?? "general",
      content: template.content,
      isSystem: template.isSystem ?? false,
      isActive: template.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.smsTemplates.set(id, newTemplate);
    return newTemplate;
  }

  async updateSmsTemplate(id: string, template: Partial<InsertSmsTemplate>): Promise<SmsTemplate | undefined> {
    const existing = this.smsTemplates.get(id);
    if (!existing) return undefined;

    const updated: SmsTemplate = {
      ...existing,
      ...template,
      updatedAt: new Date(),
    };
    this.smsTemplates.set(id, updated);
    return updated;
  }

  async deleteSmsTemplate(id: string): Promise<boolean> {
    const template = this.smsTemplates.get(id);
    if (!template || template.isSystem) return false;
    return this.smsTemplates.delete(id);
  }
}

export const storage = new MemStorage();
