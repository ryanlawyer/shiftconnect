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
  type Employee,
} from "@shared/schema";
import { generateDefaultUsername, generateUniqueUsername } from "./utils/usernameGenerator";
import { scryptSync, randomBytes } from "crypto";
import { logAuditEvent, getClientIp } from "./audit";
import smsRoutes from "./routes/sms";
import { notifyNewShift, notifyRepostedShift, notifyShiftAssigned, notifyShiftFilledToOthers, notifyShiftUnassigned } from "./services/smsNotifications";
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

  // RingCentral webhooks - MUST be registered before requireAuth middleware
  // These endpoints receive callbacks from RingCentral and cannot have authentication
  // We create simple passthrough handlers that forward to the smsRoutes router
  app.post("/api/sms/webhooks/ringcentral/status", (req, res, next) => {
    // Handle RingCentral validation token
    if (req.headers["validation-token"]) {
      res.set("Validation-Token", req.headers["validation-token"] as string);
      return res.status(200).send();
    }
    // Forward to the actual handler in smsRoutes
    req.url = "/webhooks/ringcentral/status";
    smsRoutes(req, res, next);
  });
  
  app.post("/api/sms/webhooks/ringcentral/inbound", (req, res, next) => {
    // Handle RingCentral validation token
    if (req.headers["validation-token"]) {
      res.set("Validation-Token", req.headers["validation-token"] as string);
      return res.status(200).send();
    }
    // Forward to the actual handler in smsRoutes
    req.url = "/webhooks/ringcentral/inbound";
    smsRoutes(req, res, next);
  });

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
    const { password, areaIds, ...employeeData } = req.body;
    
    // Validate employee data
    const parsed = insertEmployeeSchema.safeParse(employeeData);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    
    // If web access is enabled, validate username and password
    if (parsed.data.webAccessEnabled) {
      // Generate username if not provided
      if (!parsed.data.username) {
        const allUsers = await storage.getUsers();
        const existingUsernames = allUsers.map(u => u.username);
        parsed.data.username = generateUniqueUsername(parsed.data.name, existingUsernames);
      }
      
      // Check username is unique
      const existingUser = await storage.getUserByUsername(parsed.data.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      // Require password for new web access
      if (!password) {
        return res.status(400).json({ error: "Password is required when enabling web access" });
      }
    }
    
    // Create employee
    const employee = await storage.createEmployee(parsed.data);
    
    // Set area assignments if provided
    if (areaIds && Array.isArray(areaIds)) {
      await storage.setEmployeeAreas(employee.id, areaIds);
    }
    
    // Create user account if web access is enabled
    if (parsed.data.webAccessEnabled && password) {
      const salt = randomBytes(32).toString("hex");
      const hashedPassword = scryptSync(password, salt, 64).toString("hex");
      
      const user = await storage.createUser({
        username: parsed.data.username!,
        password: `${hashedPassword}.${salt}`,
      });
      
      // Link user to employee and set role
      await storage.updateUser(user.id, {
        employeeId: employee.id,
        roleId: parsed.data.roleId,
        role: parsed.data.role || "employee",
      });
    }
    
    const areas = await storage.getEmployeeAreas(employee.id);
    const user = await storage.getUserByEmployeeId(employee.id);
    res.status(201).json({ ...employee, areas, user: user ? { id: user.id, username: user.username } : null });
  });

  app.patch("/api/employees/:id", async (req, res) => {
    const { areaIds, password, ...updates } = req.body;
    
    // Get existing employee
    const existingEmployee = await storage.getEmployee(req.params.id);
    if (!existingEmployee) return res.status(404).json({ error: "Employee not found" });
    
    // Check if enabling web access
    const wasWebAccessEnabled = existingEmployee.webAccessEnabled;
    const isWebAccessEnabled = updates.webAccessEnabled !== undefined ? updates.webAccessEnabled : wasWebAccessEnabled;
    
    // If enabling web access, validate username
    if (isWebAccessEnabled) {
      // Generate username if not provided and not already set
      if (!updates.username && !existingEmployee.username) {
        const allUsers = await storage.getUsers();
        const existingUsernames = allUsers.map(u => u.username);
        updates.username = generateUniqueUsername(updates.name || existingEmployee.name, existingUsernames);
      }
      
      // Check username uniqueness (if changing)
      const newUsername = updates.username || existingEmployee.username;
      if (newUsername && newUsername !== existingEmployee.username) {
        const existingUser = await storage.getUserByUsername(newUsername);
        if (existingUser) {
          return res.status(400).json({ error: "Username already exists" });
        }
      }
      
      // If newly enabling web access, require password
      if (!wasWebAccessEnabled && !password) {
        return res.status(400).json({ error: "Password is required when enabling web access" });
      }
    }
    
    // Update employee
    const employee = await storage.updateEmployee(req.params.id, updates);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    
    // Handle area assignments
    if (areaIds) {
      await storage.setEmployeeAreas(req.params.id, areaIds);
    }
    
    // Handle user account
    let user: Awaited<ReturnType<typeof storage.getUserByEmployeeId>> | null = await storage.getUserByEmployeeId(employee.id);
    
    if (isWebAccessEnabled) {
      if (!user) {
        // Create new user account
        const salt = randomBytes(32).toString("hex");
        const hashedPassword = scryptSync(password!, salt, 64).toString("hex");
        
        user = await storage.createUser({
          username: employee.username!,
          password: `${hashedPassword}.${salt}`,
        });
        
        await storage.updateUser(user.id, {
          employeeId: employee.id,
          roleId: employee.roleId,
          role: employee.role,
        });
      } else {
        // Update existing user
        const userUpdates: any = {
          roleId: employee.roleId,
          role: employee.role,
        };
        
        // Update username if changed
        if (employee.username && employee.username !== user.username) {
          userUpdates.username = employee.username;
        }
        
        // Update password if provided
        if (password) {
          const salt = randomBytes(32).toString("hex");
          const hashedPassword = scryptSync(password, salt, 64).toString("hex");
          userUpdates.password = `${hashedPassword}.${salt}`;
        }
        
        await storage.updateUser(user.id, userUpdates);
        user = await storage.getUser(user.id);
      }
    } else if (wasWebAccessEnabled && !isWebAccessEnabled && user) {
      // Web access was disabled - delete user account
      await storage.deleteUser(user.id);
      user = null;
    }
    
    const areas = await storage.getEmployeeAreas(employee.id);
    res.json({ ...employee, areas, user: user ? { id: user.id, username: user.username } : null });
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
    
    // Server-side permission check for notifyAllAreas - only accept actual booleans
    const user = req.user as any;
    const userPermissions = user?.permissions || [];
    // Only accept true boolean values, reject strings/numbers to prevent accidental coercion
    const isValidBooleanTrue = shiftData.notifyAllAreas === true;
    if (isValidBooleanTrue && !userPermissions.includes("shifts:all_areas")) {
      // Silently remove the flag if user lacks permission
      shiftData.notifyAllAreas = false;
      console.warn(`User ${user?.username} attempted to set notifyAllAreas without permission`);
    } else if (typeof shiftData.notifyAllAreas !== "boolean") {
      // Non-boolean value, default to false
      shiftData.notifyAllAreas = false;
    }
    
    const parsed = insertShiftSchema.safeParse(shiftData);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });

    try {
      const shift = await storage.createShift(parsed.data);

      let notificationRecipients: { id: string; name: string; phone: string }[] = [];
      let smsResult = { sent: 0, failed: 0 };

      if (sendNotification === true) {
        const area = await storage.getArea(shift.areaId);
        const notifyAllAreas = shift.notifyAllAreas === true;
        console.log(`Shift notification requested - Area: ${area?.name || 'none'}, notifyAllAreas: ${notifyAllAreas}`);
        
        let employeesToNotify: Employee[] = [];
        
        if (notifyAllAreas) {
          // Get all active employees from all areas
          const allEmployees = await storage.getEmployees();
          employeesToNotify = allEmployees.filter(e => e.status === "active" && e.smsOptIn);
          console.log(`Notify All Areas enabled - Found ${employeesToNotify.length} eligible employees across all areas`);
        } else if (area) {
          // Get employees only from the specific area
          const areaEmployees = await storage.getAreaEmployees(shift.areaId);
          employeesToNotify = areaEmployees.filter(e => e.status === "active" && e.smsOptIn);
          console.log(`Found ${areaEmployees.length} employees in area, ${employeesToNotify.length} eligible for SMS`);
        }
        
        if (employeesToNotify.length > 0) {
          notificationRecipients = employeesToNotify.map(e => ({ id: e.id, name: e.name, phone: e.phone }));

          // Get webhook base URL for status callbacks
          const protocol = req.secure ? "https" : "http";
          const forwardedHost = req.headers["x-forwarded-host"] as string;
          const host = forwardedHost || process.env.REPLIT_DEV_DOMAIN || req.get("host");
          const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || `${protocol}://${host}`;

          // Track notification stats on the shift
          await storage.updateShift(shift.id, {
            lastNotifiedAt: new Date(),
            notificationCount: employeesToNotify.length,
          });

          // Send SMS notifications asynchronously
          notifyNewShift(shift, area, employeesToNotify, webhookBaseUrl)
            .then(result => {
              console.log(`Shift notification sent: ${result.sent} successful, ${result.failed} failed`);
            })
            .catch(err => {
              console.error("Error sending shift notifications:", err);
            });
        } else {
          console.log(`No eligible employees found for shift ${shift.id}, skipping notifications`);
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
    const updateData = { ...req.body };
    
    // Server-side permission check for notifyAllAreas - only accept actual booleans
    const user = req.user as any;
    const userPermissions = user?.permissions || [];
    if ("notifyAllAreas" in updateData) {
      // Only accept true boolean values, reject strings/numbers to prevent accidental coercion
      const isValidBooleanTrue = updateData.notifyAllAreas === true;
      const isValidBooleanFalse = updateData.notifyAllAreas === false;
      
      if (!isValidBooleanTrue && !isValidBooleanFalse) {
        // Non-boolean value, remove from update to prevent coercion issues
        delete updateData.notifyAllAreas;
      } else if (isValidBooleanTrue && !userPermissions.includes("shifts:all_areas")) {
        // User lacks permission, silently remove the flag
        delete updateData.notifyAllAreas;
        console.warn(`User ${user?.username} attempted to set notifyAllAreas via PATCH without permission`);
      }
      // If it's a valid boolean (true or false) and user has permission, keep it as-is
    }
    
    const shift = await storage.updateShift(req.params.id, updateData);
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

  // Repost shift - resend notifications to eligible employees
  app.post("/api/shifts/:id/repost", async (req, res) => {
    try {
      const shift = await storage.getShift(req.params.id);
      if (!shift) return res.status(404).json({ error: "Shift not found" });
      
      // Only repost available shifts
      if (shift.status !== "available") {
        return res.status(400).json({ error: "Can only repost available shifts" });
      }

      const { bonusAmount, customMessage } = req.body;

      // Update bonus if provided
      let updatedShift = shift;
      if (bonusAmount !== undefined) {
        updatedShift = await storage.updateShift(shift.id, { bonusAmount: bonusAmount || null }) || shift;
      }

      // Get area and employees for notification
      const area = await storage.getArea(updatedShift.areaId);
      const position = await storage.getPosition(updatedShift.positionId);
      
      // Server-side permission check for notifyAllAreas
      const user = req.user as any;
      const userPermissions = user?.permissions || [];
      let notifyAllAreas = updatedShift.notifyAllAreas === true;
      if (notifyAllAreas && !userPermissions.includes("shifts:all_areas")) {
        // User doesn't have permission, fall back to area-only notification
        notifyAllAreas = false;
        console.warn(`User ${user?.username} attempted to repost with notifyAllAreas without permission`);
      }
      
      let eligibleEmployees: Employee[] = [];
      
      if (notifyAllAreas) {
        // Get all active employees with matching position from all areas
        const allEmployees = await storage.getEmployees();
        eligibleEmployees = allEmployees.filter((emp: Employee) => 
          emp.positionId === updatedShift.positionId && 
          emp.status === "active" && 
          emp.smsOptIn
        );
        console.log(`Repost with All Areas - Found ${eligibleEmployees.length} eligible employees across all areas`);
      } else {
        // Get employees only from the specific area
        const areaEmployees = await storage.getAreaEmployees(updatedShift.areaId);
        eligibleEmployees = areaEmployees.filter((emp: Employee) => 
          emp.positionId === updatedShift.positionId && 
          emp.status === "active" && 
          emp.smsOptIn
        );
        console.log(`Repost - Found ${eligibleEmployees.length} eligible employees in area`);
      }

      // Send notifications
      const protocol = req.secure ? "https" : (req.headers["x-forwarded-proto"] as string) || "http";
      const forwardedHost = req.headers["x-forwarded-host"] as string;
      const host = forwardedHost || process.env.REPLIT_DEV_DOMAIN || req.get("host");
      const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || `${protocol}://${host}`;

      // Pass position for SMS template variables - use repost-specific notification
      if (eligibleEmployees.length > 0) {
        // Track notification stats on the shift
        updatedShift = await storage.updateShift(updatedShift.id, {
          lastNotifiedAt: new Date(),
          notificationCount: eligibleEmployees.length,
        }) || updatedShift;
        
        notifyRepostedShift(updatedShift, area, eligibleEmployees, webhookBaseUrl)
          .then(result => {
            console.log(`Shift repost notification sent: ${result.sent} successful, ${result.failed} failed`);
          })
          .catch(err => {
            console.error("Error sending shift repost notifications:", err);
          });
      } else {
        console.warn(`No eligible employees found for shift ${updatedShift.id}, skipping notifications`);
      }

      await logAuditEvent({
        action: "shift_created", // Using existing action type for repost
        actor: req.user as any,
        targetType: "shift",
        targetId: updatedShift.id,
        targetName: `${updatedShift.date} ${updatedShift.startTime}-${updatedShift.endTime} (reposted)`,
        details: {
          location: updatedShift.location,
          areaId: updatedShift.areaId,
          bonusAmount: updatedShift.bonusAmount,
          eligibleRecipients: eligibleEmployees.length,
          customMessage,
          isRepost: true,
        },
        ipAddress: getClientIp(req),
      });

      res.json({
        ...updatedShift,
        notificationRecipients: eligibleEmployees.map((e: Employee) => e.name),
        notificationCount: eligibleEmployees.length,
      });
    } catch (error) {
      console.error("Error reposting shift:", error);
      res.status(500).json({ error: "Failed to repost shift" });
    }
  });

  // Notify employees for a single shift (quick action)
  app.post("/api/shifts/:id/notify", async (req, res) => {
    const user = req.user as any;
    const userPermissions = user?.permissions || [];
    if (!userPermissions.includes("shifts:manage")) {
      return res.status(403).json({ error: "Permission denied. Shift management required." });
    }

    try {
      const shift = await storage.getShift(req.params.id);
      if (!shift) return res.status(404).json({ error: "Shift not found" });
      
      if (shift.status !== "available") {
        return res.status(400).json({ error: "Can only notify for available shifts" });
      }

      const area = await storage.getArea(shift.areaId);
      const notifyAllAreas = shift.notifyAllAreas === true;

      let eligibleEmployees: Employee[] = [];
      if (notifyAllAreas) {
        const allEmployees = await storage.getEmployees();
        eligibleEmployees = allEmployees.filter((emp: Employee) =>
          emp.positionId === shift.positionId &&
          emp.status === "active" &&
          emp.smsOptIn
        );
      } else {
        const areaEmployees = await storage.getAreaEmployees(shift.areaId);
        eligibleEmployees = areaEmployees.filter((emp: Employee) =>
          emp.positionId === shift.positionId &&
          emp.status === "active" &&
          emp.smsOptIn
        );
      }

      const protocol = req.secure ? "https" : (req.headers["x-forwarded-proto"] as string) || "http";
      const forwardedHost = req.headers["x-forwarded-host"] as string;
      const host = forwardedHost || process.env.REPLIT_DEV_DOMAIN || req.get("host");
      const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || `${protocol}://${host}`;

      if (eligibleEmployees.length > 0) {
        await storage.updateShift(shift.id, {
          lastNotifiedAt: new Date(),
          notificationCount: eligibleEmployees.length,
        });

        notifyNewShift(shift, area, eligibleEmployees, webhookBaseUrl)
          .then(result => {
            console.log(`Quick notify sent: ${result.sent} successful, ${result.failed} failed`);
          })
          .catch(err => {
            console.error("Error sending quick notifications:", err);
          });
      }

      await logAuditEvent({
        action: "shift_created",
        actor: req.user as any,
        targetType: "shift",
        targetId: shift.id,
        targetName: `${shift.date} ${shift.startTime}-${shift.endTime} (notify again)`,
        details: {
          location: shift.location,
          areaId: shift.areaId,
          eligibleRecipients: eligibleEmployees.length,
          isNotifyAgain: true,
        },
        ipAddress: getClientIp(req),
      });

      res.json({
        success: true,
        notificationCount: eligibleEmployees.length,
      });
    } catch (error) {
      console.error("Error notifying for shift:", error);
      res.status(500).json({ error: "Failed to send notifications" });
    }
  });

  // Assign shift to employee
  app.post("/api/shifts/:id/assign", async (req, res) => {
    console.log("Assign shift request:", { shiftId: req.params.id, body: req.body });
    const { employeeId, sendNotification, isForceAssignment } = req.body;
    const originalShift = await storage.getShift(req.params.id);
    console.log("Original shift:", originalShift);
    if (!originalShift) {
      console.log("Shift not found:", req.params.id);
      return res.status(404).json({ error: "Shift not found" });
    }
    const shift = await storage.updateShift(req.params.id, {
      status: "claimed",
      assignedEmployeeId: employeeId,
    });
    console.log("Updated shift:", shift);
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

  // Unassign employee from shift
  app.post("/api/shifts/:id/unassign", async (req, res) => {
    const { sendNotification = true } = req.body;
    const originalShift = await storage.getShift(req.params.id);
    
    if (!originalShift) {
      return res.status(404).json({ error: "Shift not found" });
    }
    
    if (originalShift.status !== "claimed" || !originalShift.assignedEmployeeId) {
      return res.status(400).json({ error: "Shift is not currently assigned to an employee" });
    }
    
    const unassignedEmployee = await storage.getEmployee(originalShift.assignedEmployeeId);
    const area = await storage.getArea(originalShift.areaId);
    
    // Cancel any scheduled reminder for this shift
    if (unassignedEmployee) {
      cancelShiftReminder(originalShift.id, unassignedEmployee.id);
    }
    
    // Update shift to be available again
    const shift = await storage.updateShift(req.params.id, {
      status: "available",
      assignedEmployeeId: null,
    });
    
    if (!shift) {
      return res.status(404).json({ error: "Failed to update shift" });
    }
    
    // Log audit event
    await logAuditEvent({
      action: "shift_unassigned",
      actor: req.user as any,
      targetType: "shift",
      targetId: shift.id,
      targetName: `${shift.date} ${shift.startTime}-${shift.endTime}`,
      details: {
        employeeId: originalShift.assignedEmployeeId,
        employeeName: unassignedEmployee?.name,
        location: shift.location,
        previousStatus: originalShift.status,
      },
      ipAddress: getClientIp(req),
    });
    
    // Send notification to unassigned employee
    if (sendNotification && unassignedEmployee) {
      const protocol = req.secure ? "https" : "http";
      const host = req.get("host");
      const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || `${protocol}://${host}`;
      
      notifyShiftUnassigned(shift, unassignedEmployee, area, webhookBaseUrl)
        .then(result => {
          if (result.success) {
            console.log(`Unassignment notification sent to ${unassignedEmployee.name}`);
          } else {
            console.log(`Failed to send unassignment notification to ${unassignedEmployee.name}: ${result.errorMessage}`);
          }
        })
        .catch(err => {
          console.error("Error sending unassignment notification:", err);
        });
    }
    
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

  // Bulk shift actions
  app.post("/api/shifts/bulk/cancel", async (req, res) => {
    const user = req.user as any;
    const userPermissions = user?.permissions || [];
    if (!userPermissions.includes("shifts:manage")) {
      return res.status(403).json({ error: "Permission denied. Shift management required." });
    }

    const { shiftIds } = req.body;
    if (!Array.isArray(shiftIds) || shiftIds.length === 0) {
      return res.status(400).json({ error: "shiftIds must be a non-empty array" });
    }

    let successCount = 0;
    let failedCount = 0;

    for (const shiftId of shiftIds) {
      try {
        const shift = await storage.getShift(shiftId);
        if (!shift) {
          failedCount++;
          continue;
        }
        
        // Cancel shift by deleting it
        const deleted = await storage.deleteShift(shiftId);
        if (deleted) {
          successCount++;
          await logAuditEvent({
            action: "shift_deleted",
            actor: req.user as any,
            targetType: "shift",
            targetId: shiftId,
            targetName: `${shift.date} ${shift.startTime}-${shift.endTime}`,
            details: { location: shift.location, areaId: shift.areaId, bulk: true },
            ipAddress: getClientIp(req),
          });
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`Error cancelling shift ${shiftId}:`, error);
        failedCount++;
      }
    }

    res.json({ successCount, failedCount });
  });

  app.post("/api/shifts/bulk/repost", async (req, res) => {
    const user = req.user as any;
    const userPermissions = user?.permissions || [];
    if (!userPermissions.includes("shifts:manage")) {
      return res.status(403).json({ error: "Permission denied. Shift management required." });
    }

    const { shiftIds, bonusAmount } = req.body;
    if (!Array.isArray(shiftIds) || shiftIds.length === 0) {
      return res.status(400).json({ error: "shiftIds must be a non-empty array" });
    }

    const protocol = req.secure ? "https" : (req.headers["x-forwarded-proto"] as string) || "http";
    const forwardedHost = req.headers["x-forwarded-host"] as string;
    const host = forwardedHost || process.env.REPLIT_DEV_DOMAIN || req.get("host");
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || `${protocol}://${host}`;

    let successCount = 0;
    let failedCount = 0;
    let totalNotifications = 0;

    for (const shiftId of shiftIds) {
      try {
        const shift = await storage.getShift(shiftId);
        if (!shift || shift.status !== "available") {
          failedCount++;
          continue;
        }

        let updatedShift = shift;
        if (bonusAmount !== undefined) {
          updatedShift = await storage.updateShift(shift.id, { bonusAmount: bonusAmount || null }) || shift;
        }

        const area = await storage.getArea(updatedShift.areaId);
        const notifyAllAreas = updatedShift.notifyAllAreas === true;

        let eligibleEmployees: Employee[] = [];
        if (notifyAllAreas) {
          const allEmployees = await storage.getEmployees();
          eligibleEmployees = allEmployees.filter((emp: Employee) =>
            emp.positionId === updatedShift.positionId &&
            emp.status === "active" &&
            emp.smsOptIn
          );
        } else {
          const areaEmployees = await storage.getAreaEmployees(updatedShift.areaId);
          eligibleEmployees = areaEmployees.filter((emp: Employee) =>
            emp.positionId === updatedShift.positionId &&
            emp.status === "active" &&
            emp.smsOptIn
          );
        }

        if (eligibleEmployees.length > 0) {
          await storage.updateShift(updatedShift.id, {
            lastNotifiedAt: new Date(),
            notificationCount: eligibleEmployees.length,
          });

          notifyRepostedShift(updatedShift, area, eligibleEmployees, webhookBaseUrl)
            .catch(err => console.error(`Error sending repost notifications for shift ${shiftId}:`, err));
          
          totalNotifications += eligibleEmployees.length;
        }

        successCount++;

        await logAuditEvent({
          action: "shift_created",
          actor: req.user as any,
          targetType: "shift",
          targetId: updatedShift.id,
          targetName: `${updatedShift.date} ${updatedShift.startTime}-${updatedShift.endTime} (bulk repost)`,
          details: {
            location: updatedShift.location,
            areaId: updatedShift.areaId,
            bonusAmount: updatedShift.bonusAmount,
            eligibleRecipients: eligibleEmployees.length,
            isBulkRepost: true,
          },
          ipAddress: getClientIp(req),
        });
      } catch (error) {
        console.error(`Error reposting shift ${shiftId}:`, error);
        failedCount++;
      }
    }

    res.json({ successCount, failedCount, totalNotifications });
  });

  app.post("/api/shifts/bulk/notify", async (req, res) => {
    const user = req.user as any;
    const userPermissions = user?.permissions || [];
    if (!userPermissions.includes("shifts:manage")) {
      return res.status(403).json({ error: "Permission denied. Shift management required." });
    }

    const { shiftIds } = req.body;
    if (!Array.isArray(shiftIds) || shiftIds.length === 0) {
      return res.status(400).json({ error: "shiftIds must be a non-empty array" });
    }

    const protocol = req.secure ? "https" : (req.headers["x-forwarded-proto"] as string) || "http";
    const forwardedHost = req.headers["x-forwarded-host"] as string;
    const host = forwardedHost || process.env.REPLIT_DEV_DOMAIN || req.get("host");
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || `${protocol}://${host}`;

    let successCount = 0;
    let failedCount = 0;
    let totalNotifications = 0;

    for (const shiftId of shiftIds) {
      try {
        const shift = await storage.getShift(shiftId);
        if (!shift || shift.status !== "available") {
          failedCount++;
          continue;
        }

        const area = await storage.getArea(shift.areaId);
        const notifyAllAreas = shift.notifyAllAreas === true;

        let eligibleEmployees: Employee[] = [];
        if (notifyAllAreas) {
          const allEmployees = await storage.getEmployees();
          eligibleEmployees = allEmployees.filter((emp: Employee) =>
            emp.positionId === shift.positionId &&
            emp.status === "active" &&
            emp.smsOptIn
          );
        } else {
          const areaEmployees = await storage.getAreaEmployees(shift.areaId);
          eligibleEmployees = areaEmployees.filter((emp: Employee) =>
            emp.positionId === shift.positionId &&
            emp.status === "active" &&
            emp.smsOptIn
          );
        }

        if (eligibleEmployees.length > 0) {
          await storage.updateShift(shift.id, {
            lastNotifiedAt: new Date(),
            notificationCount: eligibleEmployees.length,
          });

          notifyNewShift(shift, area, eligibleEmployees, webhookBaseUrl)
            .catch(err => console.error(`Error sending notifications for shift ${shiftId}:`, err));
          
          totalNotifications += eligibleEmployees.length;
        }

        successCount++;
      } catch (error) {
        console.error(`Error notifying for shift ${shiftId}:`, error);
        failedCount++;
      }
    }

    res.json({ successCount, failedCount, totalNotifications });
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

  // Shift Templates CRUD
  app.get("/api/shift-templates", async (req, res) => {
    const templates = await storage.getShiftTemplates();
    res.json(templates);
  });

  app.get("/api/shift-templates/:id", async (req, res) => {
    const template = await storage.getShiftTemplate(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  });

  app.post("/api/shift-templates", async (req, res) => {
    const user = req.user as any;
    const userPermissions = user?.permissions || [];
    if (!userPermissions.includes("shifts:manage")) {
      return res.status(403).json({ error: "Permission denied. Shift management required." });
    }

    const templateData = {
      ...req.body,
      createdById: user?.id || null,
    };
    
    const template = await storage.createShiftTemplate(templateData);
    
    await logAuditEvent({
      action: "template_created" as any,
      actor: user,
      targetType: "template" as any,
      targetId: template.id,
      targetName: template.name,
      details: { positionId: template.positionId, areaId: template.areaId },
      ipAddress: getClientIp(req),
    });
    
    res.status(201).json(template);
  });

  app.patch("/api/shift-templates/:id", async (req, res) => {
    const user = req.user as any;
    const userPermissions = user?.permissions || [];
    if (!userPermissions.includes("shifts:manage")) {
      return res.status(403).json({ error: "Permission denied. Shift management required." });
    }

    const template = await storage.updateShiftTemplate(req.params.id, req.body);
    if (!template) return res.status(404).json({ error: "Template not found" });
    
    await logAuditEvent({
      action: "template_updated" as any,
      actor: user,
      targetType: "template" as any,
      targetId: template.id,
      targetName: template.name,
      details: req.body,
      ipAddress: getClientIp(req),
    });
    
    res.json(template);
  });

  app.delete("/api/shift-templates/:id", async (req, res) => {
    const user = req.user as any;
    const userPermissions = user?.permissions || [];
    if (!userPermissions.includes("shifts:manage")) {
      return res.status(403).json({ error: "Permission denied. Shift management required." });
    }

    const template = await storage.getShiftTemplate(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });
    
    const deleted = await storage.deleteShiftTemplate(req.params.id);
    
    await logAuditEvent({
      action: "template_deleted" as any,
      actor: user,
      targetType: "template" as any,
      targetId: template.id,
      targetName: template.name,
      details: {},
      ipAddress: getClientIp(req),
    });
    
    res.json({ success: deleted });
  });

  // Documentation Downloads
  app.get("/api/docs/:docName", async (req, res) => {
    const { docName } = req.params;
    const fs = await import("fs");
    const path = await import("path");
    
    const docFiles: Record<string, string> = {
      "user-guide": "docs/user-guide.md",
      "admin-guide": "docs/admin-guide.md",
      "features": "docs/features.md",
    };
    
    const filePath = docFiles[docName];
    if (!filePath) {
      return res.status(404).json({ error: "Document not found" });
    }
    
    const fullPath = path.resolve(process.cwd(), filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "Document file not found" });
    }
    
    const content = fs.readFileSync(fullPath, "utf-8");
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${docName}.md"`);
    res.send(content);
  });

  return httpServer;
}
