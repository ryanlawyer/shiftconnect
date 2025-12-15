import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertAreaSchema,
  insertRoleSchema,
  insertPositionSchema,
  insertEmployeeSchema,
  insertShiftSchema,
  insertShiftInterestSchema,
  insertMessageSchema,
  insertTrainingSchema,
  insertUserSchema,
} from "@shared/schema";
import { scryptSync, randomBytes } from "crypto";
import { logAuditEvent, getClientIp } from "./audit";
import smsRoutes from "./routes/sms";
import { notifyNewShift, notifyShiftAssigned, notifyShiftFilledToOthers } from "./services/smsNotifications";
import { scheduleShiftReminder, startReminderChecker, cancelShiftReminder } from "./services/shiftReminderScheduler";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ error: "Unauthorized" });
  };

  // Diagnostics (Public)
  app.get("/diagnostics", async (req, res) => {
    const roles = await storage.getRoles();
    res.json({
      roleCount: roles.length,
      roles: roles,
      uptime: process.uptime(),
    });
  });

  // Twilio webhooks - MUST be registered before requireAuth middleware
  // These endpoints receive callbacks from Twilio and cannot have authentication
  app.post("/api/webhooks/twilio/status", smsRoutes);
  app.post("/api/webhooks/twilio/inbound", smsRoutes);

  // Protect all API routes defined here
  app.use("/api", requireAuth);

  // Roles
  app.get("/api/roles", async (req, res) => {
    const roles = await storage.getRoles();
    // console.log("GET /api/roles returning:", roles.length, "roles");
    res.json(roles);
  });

  app.post("/api/roles", async (req, res) => {
    console.log("POST /api/roles received:", req.body);
    const result = insertRoleSchema.safeParse(req.body);
    if (!result.success) {
      console.error("POST /api/roles validation failed:", result.error);
      return res.status(400).json({ error: result.error });
    }
    const role = await storage.createRole(result.data);
    console.log("POST /api/roles created:", role);

    await logAuditEvent({
      action: "role_created",
      actor: req.user as any,
      targetType: "role",
      targetId: role.id,
      targetName: role.name,
      details: { permissions: role.permissions },
      ipAddress: getClientIp(req),
    });

    res.status(201).json(role);
  });

  app.patch("/api/roles/:id", async (req, res) => {
    const oldRole = await storage.getRole(req.params.id);
    const role = await storage.updateRole(req.params.id, req.body);
    if (!role) return res.status(404).json({ error: "Role not found" });

    await logAuditEvent({
      action: "role_updated",
      actor: req.user as any,
      targetType: "role",
      targetId: role.id,
      targetName: role.name,
      details: { before: oldRole, after: role },
      ipAddress: getClientIp(req),
    });

    res.json(role);
  });

  app.delete("/api/roles/:id", async (req, res) => {
    const role = await storage.getRole(req.params.id);
    const success = await storage.deleteRole(req.params.id);
    if (!success) return res.status(404).json({ error: "Role not found or is system role" });

    await logAuditEvent({
      action: "role_deleted",
      actor: req.user as any,
      targetType: "role",
      targetId: req.params.id,
      targetName: role?.name,
      ipAddress: getClientIp(req),
    });

    res.sendStatus(204);
  });

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
    const { reassignToId } = req.body;
    const deleted = await storage.deleteArea(req.params.id, reassignToId);
    if (!deleted) return res.status(404).json({ error: "Area not found or reassignment target invalid" });
    res.status(204).send();
  });

  app.get("/api/areas/:id/employees", async (req, res) => {
    const employees = await storage.getAreaEmployees(req.params.id);
    res.json(employees);
  });

  app.get("/api/areas/:id/employees", async (req, res) => {
    const employees = await storage.getAreaEmployees(req.params.id);
    res.json(employees);
  });

  // Positions
  app.get("/api/positions", async (req, res) => {
    const positions = await storage.getPositions();
    res.json(positions);
  });

  app.get("/api/positions/:id", async (req, res) => {
    const position = await storage.getPosition(req.params.id);
    if (!position) return res.status(404).json({ error: "Position not found" });
    res.json(position);
  });

  app.post("/api/positions", async (req, res) => {
    const parsed = insertPositionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const position = await storage.createPosition(parsed.data);
    res.status(201).json(position);
  });

  app.patch("/api/positions/:id", async (req, res) => {
    const position = await storage.updatePosition(req.params.id, req.body);
    if (!position) return res.status(404).json({ error: "Position not found" });
    res.json(position);
  });

  app.delete("/api/positions/:id", async (req, res) => {
    const { reassignToId } = req.body;
    const deleted = await storage.deletePosition(req.params.id, reassignToId);
    if (!deleted) return res.status(404).json({ error: "Position not found or reassignment target invalid" });
    res.status(204).send();
  });

  // Employees
  app.get("/api/employees", async (req, res) => {
    const employees = await storage.getEmployees();
    // Include area info for each employee
    const employeesWithAreas = await Promise.all(
      employees.map(async (emp) => {
        const areas = await storage.getEmployeeAreas(emp.id);
        const user = await storage.getUserByEmployeeId(emp.id);
        return {
          ...emp,
          areas,
          user: user ? { id: user.id, username: user.username } : null
        };
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

  // User Management (Admin)
  app.get("/api/admin/users/by-employee/:employeeId", async (req, res) => {
    const user = await storage.getUserByEmployeeId(req.params.employeeId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });

  app.post("/api/admin/users", async (req, res) => {
    const { username, password, employeeId, roleId } = req.body;

    // Check constraints
    if (!username || !password || !employeeId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) return res.status(400).json({ error: "Username already exists" });

    const existingLink = await storage.getUserByEmployeeId(employeeId);
    if (existingLink) return res.status(400).json({ error: "Employee already has a user account" });

    // Hash password for creation (since storage.createUser doesn't hash)
    const salt = randomBytes(32).toString("hex");
    const hashedPassword = scryptSync(password, salt, 64).toString("hex");

    const user = await storage.createUser({
      username,
      password: `${hashedPassword}.${salt}`, // Use correct format
    });

    // Link employee and role
    const finalUser = await storage.updateUser(user.id, {
      employeeId,
      roleId
    });

    const employee = await storage.getEmployee(employeeId);

    await logAuditEvent({
      action: "user_created",
      actor: req.user as any,
      targetType: "user",
      targetId: finalUser?.id,
      targetName: username,
      details: { employeeId, employeeName: employee?.name, roleId },
      ipAddress: getClientIp(req),
    });

    res.status(201).json(finalUser);
  });

  app.post("/api/admin/users/:id/reset-password", async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Password is required" });

    // updateUser hashes the password automatically if present
    const user = await storage.updateUser(req.params.id, { password });
    if (!user) return res.status(404).json({ error: "User not found" });

    await logAuditEvent({
      action: "user_password_reset",
      actor: req.user as any,
      targetType: "user",
      targetId: user.id,
      targetName: user.username,
      ipAddress: getClientIp(req),
    });

    res.json({ message: "Password updated successfully" });
  });

  // Shifts
  app.get("/api/shifts", async (req, res) => {
    const shifts = await storage.getShifts();
    // Include area info, interest count, and assigned employee
    const shiftsWithInfo = await Promise.all(
      shifts.map(async (shift) => {
        const area = await storage.getArea(shift.areaId);
        const interests = await storage.getShiftInterests(shift.id);
        const assignedEmployee = shift.assignedEmployeeId
          ? await storage.getEmployee(shift.assignedEmployeeId)
          : null;
        const position = await storage.getPosition(shift.positionId);
        return {
          ...shift,
          area,
          position: position?.title || "Unknown Position",
          interestedCount: interests.length,
          assignedEmployee,
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
    const assignedEmployee = shift.assignedEmployeeId
      ? await storage.getEmployee(shift.assignedEmployeeId)
      : null;
    const position = await storage.getPosition(shift.positionId);
    res.json({
      ...shift,
      area,
      assignedEmployee,
      position: position?.title || "Unknown Position",
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
      let smsResult = { sent: 0, failed: 0 };

      if (sendNotification === true) {
        const area = await storage.getArea(shift.areaId);
        if (area && area.smsEnabled) {
          const areaEmployees = await storage.getAreaEmployees(shift.areaId);
          notificationRecipients = areaEmployees
            .filter(e => e.status === "active" && e.smsOptIn)
            .map(e => ({ id: e.id, name: e.name, phone: e.phone }));

          // Get webhook base URL for status callbacks
          const protocol = req.secure ? "https" : "http";
          const host = req.get("host");
          const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || `${protocol}://${host}`;

          // Send SMS notifications asynchronously
          notifyNewShift(shift, area, areaEmployees, webhookBaseUrl)
            .then(result => {
              console.log(`Shift notification sent: ${result.sent} successful, ${result.failed} failed`);
            })
            .catch(err => {
              console.error("Error sending shift notifications:", err);
            });
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
    const shift = await storage.getShift(req.params.id);
    const deleted = await storage.deleteShift(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Shift not found" });

    await logAuditEvent({
      action: "shift_deleted",
      actor: req.user as any,
      targetType: "shift",
      targetId: req.params.id,
      targetName: shift ? `${shift.date} ${shift.startTime}-${shift.endTime}` : undefined,
      details: shift ? { location: shift.location, areaId: shift.areaId } : undefined,
      ipAddress: getClientIp(req),
    });

    res.status(204).send();
  });

  // Assign shift to employee
  app.post("/api/shifts/:id/assign", async (req, res) => {
    const { employeeId, sendNotification, isForceAssignment } = req.body;
    const originalShift = await storage.getShift(req.params.id);
    const shift = await storage.updateShift(req.params.id, {
      status: "claimed",
      assignedEmployeeId: employeeId,
    });
    if (!shift) return res.status(404).json({ error: "Shift not found" });

    const employee = await storage.getEmployee(employeeId);
    const area = await storage.getArea(shift.areaId);

    await logAuditEvent({
      action: isForceAssignment ? "force_assignment" : "shift_assigned",
      actor: req.user as any,
      targetType: "shift",
      targetId: shift.id,
      targetName: `${shift.date} ${shift.startTime}-${shift.endTime}`,
      details: {
        employeeId,
        employeeName: employee?.name,
        location: shift.location,
        previousStatus: originalShift?.status,
        isForceAssignment: !!isForceAssignment,
      },
      ipAddress: getClientIp(req),
    });

    // Send SMS confirmation if enabled and employee exists
    const protocol = req.secure ? "https" : "http";
    const host = req.get("host");
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || `${protocol}://${host}`;

    if (sendNotification && employee) {
      // Send confirmation asynchronously
      notifyShiftAssigned(shift, employee, area, webhookBaseUrl)
        .then(result => {
          if (result.success) {
            console.log(`Shift confirmation sent to ${employee.name}`);
          } else {
            console.log(`Failed to send shift confirmation to ${employee.name}: ${result.errorMessage}`);
          }
        })
        .catch(err => {
          console.error("Error sending shift confirmation:", err);
        });
    }

    // Schedule shift reminder if employee exists
    if (employee) {
      scheduleShiftReminder(shift, employee, area, webhookBaseUrl)
        .catch(err => {
          console.error("Error scheduling shift reminder:", err);
        });
    }

    // Notify other interested employees that this shift has been filled
    notifyShiftFilledToOthers(shift, employeeId, webhookBaseUrl)
      .then(result => {
        if (result.sent > 0) {
          console.log(`Notified ${result.sent} other interested employees that shift was filled`);
        }
      })
      .catch(err => {
        console.error("Error notifying other interested employees:", err);
      });

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

  // Audit Logs (requires view_audit_log permission)
  app.get("/api/audit-logs", async (req, res) => {
    const user = req.user as any;
    // Check permission via role
    let hasPermission = false;
    if (user?.roleId) {
      const role = await storage.getRole(user.roleId);
      hasPermission = role?.permissions?.includes("view_audit_log") ?? false;
    }
    // Fallback: admin/supervisor roles have access
    if (!hasPermission && user?.role !== "admin" && user?.role !== "supervisor") {
      return res.status(403).json({ error: "Access denied" });
    }

    const { limit, offset, action, actorId, targetType } = req.query;
    const logs = await storage.getAuditLogs({
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      action: action as string,
      actorId: actorId as string,
      targetType: targetType as string,
    });
    res.json(logs);
  });

  app.get("/api/audit-logs/:id", async (req, res) => {
    const user = req.user as any;
    let hasPermission = false;
    if (user?.roleId) {
      const role = await storage.getRole(user.roleId);
      hasPermission = role?.permissions?.includes("view_audit_log") ?? false;
    }
    if (!hasPermission && user?.role !== "admin" && user?.role !== "supervisor") {
      return res.status(403).json({ error: "Access denied" });
    }

    const log = await storage.getAuditLog(req.params.id);
    if (!log) return res.status(404).json({ error: "Audit log not found" });
    res.json(log);
  });

  // Organization Settings
  app.get("/api/settings", async (req, res) => {
    const settings = await storage.getSettings();
    res.json(settings);
  });

  app.get("/api/settings/:key", async (req, res) => {
    const setting = await storage.getSetting(req.params.key);
    if (!setting) return res.status(404).json({ error: "Setting not found" });
    res.json(setting);
  });

  app.put("/api/settings/:key", async (req, res) => {
    const user = req.user as any;
    // Only admins can modify settings
    if (user?.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const { value, description } = req.body;
    if (typeof value !== "string") {
      return res.status(400).json({ error: "Value must be a string" });
    }

    const setting = await storage.setSetting(req.params.key, value, description);

    await logAuditEvent({
      action: "setting_updated" as any,
      actor: user,
      targetType: "setting" as any,
      targetId: setting.id,
      targetName: req.params.key,
      details: { value },
      ipAddress: getClientIp(req),
    });

    res.json(setting);
  });

  // SMS Routes (protected by requireAuth since they're under /api)
  app.use("/api/sms", smsRoutes);

  return httpServer;
}
