import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertAreaSchema,
  insertEmployeeSchema,
  insertShiftSchema,
  insertShiftInterestSchema,
  insertMessageSchema,
  insertTrainingSchema,
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Areas
  app.get("/api/areas", async (req, res) => {
    const areas = await storage.getAreas();
    res.json(areas);
  });

  app.get("/api/areas/:id", async (req, res) => {
    const area = await storage.getArea(req.params.id);
    if (!area) return res.status(404).json({ error: "Area not found" });
    res.json(area);
  });

  app.post("/api/areas", async (req, res) => {
    const parsed = insertAreaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const area = await storage.createArea(parsed.data);
    res.status(201).json(area);
  });

  app.patch("/api/areas/:id", async (req, res) => {
    const area = await storage.updateArea(req.params.id, req.body);
    if (!area) return res.status(404).json({ error: "Area not found" });
    res.json(area);
  });

  app.delete("/api/areas/:id", async (req, res) => {
    const deleted = await storage.deleteArea(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Area not found" });
    res.status(204).send();
  });

  app.get("/api/areas/:id/employees", async (req, res) => {
    const employees = await storage.getAreaEmployees(req.params.id);
    res.json(employees);
  });

  // Employees
  app.get("/api/employees", async (req, res) => {
    const employees = await storage.getEmployees();
    // Include area info for each employee
    const employeesWithAreas = await Promise.all(
      employees.map(async (emp) => {
        const areas = await storage.getEmployeeAreas(emp.id);
        return { ...emp, areas };
      })
    );
    res.json(employeesWithAreas);
  });

  app.get("/api/employees/:id", async (req, res) => {
    const employee = await storage.getEmployee(req.params.id);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    const areas = await storage.getEmployeeAreas(employee.id);
    res.json({ ...employee, areas });
  });

  app.post("/api/employees", async (req, res) => {
    const parsed = insertEmployeeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const employee = await storage.createEmployee(parsed.data);
    res.status(201).json(employee);
  });

  app.patch("/api/employees/:id", async (req, res) => {
    const { areaIds, ...updates } = req.body;
    const employee = await storage.updateEmployee(req.params.id, updates);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    if (areaIds) {
      await storage.setEmployeeAreas(req.params.id, areaIds);
    }
    const areas = await storage.getEmployeeAreas(employee.id);
    res.json({ ...employee, areas });
  });

  app.delete("/api/employees/:id", async (req, res) => {
    const deleted = await storage.deleteEmployee(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Employee not found" });
    res.status(204).send();
  });

  app.get("/api/employees/:id/areas", async (req, res) => {
    const areas = await storage.getEmployeeAreas(req.params.id);
    res.json(areas);
  });

  app.put("/api/employees/:id/areas", async (req, res) => {
    const { areaIds } = req.body;
    if (!Array.isArray(areaIds)) return res.status(400).json({ error: "areaIds must be an array" });
    await storage.setEmployeeAreas(req.params.id, areaIds);
    const areas = await storage.getEmployeeAreas(req.params.id);
    res.json(areas);
  });

  // Shifts
  app.get("/api/shifts", async (req, res) => {
    const shifts = await storage.getShifts();
    // Include area info and interest count
    const shiftsWithInfo = await Promise.all(
      shifts.map(async (shift) => {
        const area = await storage.getArea(shift.areaId);
        const interests = await storage.getShiftInterests(shift.id);
        return {
          ...shift,
          area,
          interestedCount: interests.length,
        };
      })
    );
    res.json(shiftsWithInfo);
  });

  app.get("/api/shifts/:id", async (req, res) => {
    const shift = await storage.getShift(req.params.id);
    if (!shift) return res.status(404).json({ error: "Shift not found" });
    const area = await storage.getArea(shift.areaId);
    const interests = await storage.getShiftInterests(shift.id);
    res.json({
      ...shift,
      area,
      interestedEmployees: interests.map((i) => ({
        id: i.employeeId,
        name: i.employee.name,
        timestamp: i.createdAt.toISOString(),
      })),
    });
  });

  app.post("/api/shifts", async (req, res) => {
    const { sendNotification = false, ...shiftData } = req.body;
    const parsed = insertShiftSchema.safeParse(shiftData);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    
    try {
      const shift = await storage.createShift(parsed.data);
      
      let notificationRecipients: { id: string; name: string; phone: string }[] = [];
      
      if (sendNotification === true) {
        const area = await storage.getArea(shift.areaId);
        if (area && area.smsEnabled) {
          const areaEmployees = await storage.getAreaEmployees(shift.areaId);
          notificationRecipients = areaEmployees
            .filter(e => e.status === "active" && e.smsOptIn)
            .map(e => ({ id: e.id, name: e.name, phone: e.phone }));
        }
      }
      
      res.status(201).json({
        ...shift,
        notificationRecipients,
        notificationCount: notificationRecipients.length,
      });
    } catch (error) {
      console.error("Error creating shift:", error);
      res.status(500).json({ error: "Failed to create shift" });
    }
  });

  app.patch("/api/shifts/:id", async (req, res) => {
    const shift = await storage.updateShift(req.params.id, req.body);
    if (!shift) return res.status(404).json({ error: "Shift not found" });
    res.json(shift);
  });

  app.delete("/api/shifts/:id", async (req, res) => {
    const deleted = await storage.deleteShift(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Shift not found" });
    res.status(204).send();
  });

  // Assign shift to employee
  app.post("/api/shifts/:id/assign", async (req, res) => {
    const { employeeId, sendNotification } = req.body;
    const shift = await storage.updateShift(req.params.id, {
      status: "claimed",
      assignedEmployeeId: employeeId,
    });
    if (!shift) return res.status(404).json({ error: "Shift not found" });

    // TODO: Send SMS notification if sendNotification is true
    // This will be implemented with Twilio integration

    res.json(shift);
  });

  // Shift interests
  app.get("/api/shifts/:id/interests", async (req, res) => {
    const interests = await storage.getShiftInterests(req.params.id);
    res.json(interests);
  });

  app.post("/api/shifts/:id/interests", async (req, res) => {
    const parsed = insertShiftInterestSchema.safeParse({
      shiftId: req.params.id,
      employeeId: req.body.employeeId,
    });
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const interest = await storage.createShiftInterest(parsed.data);
    res.status(201).json(interest);
  });

  // Messages
  app.get("/api/messages", async (req, res) => {
    const messages = await storage.getMessages();
    res.json(messages);
  });

  app.get("/api/employees/:id/messages", async (req, res) => {
    const messages = await storage.getEmployeeMessages(req.params.id);
    res.json(messages);
  });

  app.post("/api/messages", async (req, res) => {
    const parsed = insertMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const message = await storage.createMessage(parsed.data);
    // TODO: Send via Twilio if direction is outbound
    res.status(201).json(message);
  });

  // Trainings
  app.get("/api/trainings", async (req, res) => {
    const trainings = await storage.getTrainings();
    res.json(trainings);
  });

  app.get("/api/trainings/:id", async (req, res) => {
    const training = await storage.getTraining(req.params.id);
    if (!training) return res.status(404).json({ error: "Training not found" });
    res.json(training);
  });

  app.post("/api/trainings", async (req, res) => {
    const parsed = insertTrainingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const training = await storage.createTraining(parsed.data);
    res.status(201).json(training);
  });

  app.patch("/api/trainings/:id", async (req, res) => {
    const training = await storage.updateTraining(req.params.id, req.body);
    if (!training) return res.status(404).json({ error: "Training not found" });
    res.json(training);
  });

  app.delete("/api/trainings/:id", async (req, res) => {
    const deleted = await storage.deleteTraining(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Training not found" });
    res.status(204).send();
  });

  // Get employees eligible for notifications for a specific area
  app.get("/api/areas/:id/notification-recipients", async (req, res) => {
    const area = await storage.getArea(req.params.id);
    if (!area) return res.status(404).json({ error: "Area not found" });
    if (!area.smsEnabled) return res.json([]);
    
    const employees = await storage.getAreaEmployees(req.params.id);
    // Filter for active, opted-in employees
    const eligible = employees.filter(e => e.status === "active" && e.smsOptIn);
    res.json(eligible);
  });

  return httpServer;
}
