import {
  type User, type InsertUser,
  type Area, type InsertArea,
  type Employee, type InsertEmployee,
  type EmployeeArea, type InsertEmployeeArea,
  type Shift, type InsertShift,
  type ShiftInterest, type InsertShiftInterest,
  type Message, type InsertMessage,
  type Training, type InsertTraining,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Areas
  getAreas(): Promise<Area[]>;
  getArea(id: string): Promise<Area | undefined>;
  createArea(area: InsertArea): Promise<Area>;
  updateArea(id: string, area: Partial<InsertArea>): Promise<Area | undefined>;
  deleteArea(id: string): Promise<boolean>;

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
  getShiftsByArea(areaId: string): Promise<Shift[]>;
  createShift(shift: InsertShift): Promise<Shift>;
  updateShift(id: string, shift: Partial<InsertShift>): Promise<Shift | undefined>;
  deleteShift(id: string): Promise<boolean>;

  // Shift interests
  getShiftInterests(shiftId: string): Promise<(ShiftInterest & { employee: Employee })[]>;
  createShiftInterest(interest: InsertShiftInterest): Promise<ShiftInterest>;
  deleteShiftInterest(shiftId: string, employeeId: string): Promise<boolean>;

  // Messages
  getMessages(): Promise<Message[]>;
  getEmployeeMessages(employeeId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Trainings
  getTrainings(): Promise<Training[]>;
  getTraining(id: string): Promise<Training | undefined>;
  createTraining(training: InsertTraining): Promise<Training>;
  updateTraining(id: string, training: Partial<InsertTraining>): Promise<Training | undefined>;
  deleteTraining(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private areas: Map<string, Area>;
  private employees: Map<string, Employee>;
  private employeeAreas: Map<string, EmployeeArea>;
  private shifts: Map<string, Shift>;
  private shiftInterests: Map<string, ShiftInterest>;
  private messages: Map<string, Message>;
  private trainings: Map<string, Training>;

  constructor() {
    this.users = new Map();
    this.areas = new Map();
    this.employees = new Map();
    this.employeeAreas = new Map();
    this.shifts = new Map();
    this.shiftInterests = new Map();
    this.messages = new Map();
    this.trainings = new Map();

    // Seed some sample areas
    const sampleAreas: Area[] = [
      { id: "area-1", name: "Emergency Department", description: "ER and trauma care", smsEnabled: true },
      { id: "area-2", name: "Intensive Care Unit", description: "Critical care patients", smsEnabled: true },
      { id: "area-3", name: "Laboratory", description: "Medical testing and diagnostics", smsEnabled: true },
      { id: "area-4", name: "Radiology", description: "Imaging services", smsEnabled: true },
    ];
    sampleAreas.forEach(a => this.areas.set(a.id, a));

    // Seed some sample employees
    const sampleEmployees: Employee[] = [
      { id: "emp-1", name: "John Smith", phone: "+15551234567", email: "john@example.com", position: "Registered Nurse", status: "active", smsOptIn: true },
      { id: "emp-2", name: "Emily Davis", phone: "+15551234568", email: "emily@example.com", position: "CNA", status: "active", smsOptIn: true },
      { id: "emp-3", name: "Michael Chen", phone: "+15551234569", email: "michael@example.com", position: "Medical Technologist", status: "active", smsOptIn: true },
      { id: "emp-4", name: "Sarah Wilson", phone: "+15551234570", email: "sarah@example.com", position: "Radiology Tech", status: "active", smsOptIn: true },
    ];
    sampleEmployees.forEach(e => this.employees.set(e.id, e));

    // Assign employees to areas
    const areaAssignments: EmployeeArea[] = [
      { id: "ea-1", employeeId: "emp-1", areaId: "area-1" },
      { id: "ea-2", employeeId: "emp-1", areaId: "area-2" },
      { id: "ea-3", employeeId: "emp-2", areaId: "area-2" },
      { id: "ea-4", employeeId: "emp-3", areaId: "area-3" },
      { id: "ea-5", employeeId: "emp-4", areaId: "area-4" },
    ];
    areaAssignments.forEach(ea => this.employeeAreas.set(ea.id, ea));
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
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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

  async deleteArea(id: string): Promise<boolean> {
    return this.areas.delete(id);
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
      position: insertEmployee.position,
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

  async getShiftsByArea(areaId: string): Promise<Shift[]> {
    return Array.from(this.shifts.values()).filter(s => s.areaId === areaId);
  }

  async createShift(insertShift: InsertShift): Promise<Shift> {
    const id = randomUUID();
    const shift: Shift = {
      id,
      position: insertShift.position,
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
  async getMessages(): Promise<Message[]> {
    return Array.from(this.messages.values()).sort((a, b) => 
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
      status: insertMessage.status ?? "sent",
      twilioSid: insertMessage.twilioSid ?? null,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
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
}

export const storage = new MemStorage();
