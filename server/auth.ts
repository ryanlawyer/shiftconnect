import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

// Extended user type with permissions and areas for session
export interface AuthUser extends SelectUser {
  permissions: string[];
  areaIds: string[];
  employeeName?: string;
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "shift_connect_secret_key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      console.log(`Login attempt for username: ${username}`);
      const user = await storage.getUserByUsername(username);
      if (!user) {
        console.log(`Login failed: user not found for ${username}`);
        return done(null, false);
      }
      
      const passwordMatch = await comparePasswords(password, user.password);
      if (!passwordMatch) {
        console.log(`Login failed: password mismatch for ${username}`);
        return done(null, false);
      }
      
      // Check if linked employee is deleted (soft delete check)
      if (user.employeeId) {
        const employee = await storage.getEmployee(user.employeeId);
        if (employee && employee.status === 'deleted') {
          console.log(`Login failed: employee deleted for ${username}`);
          return done(null, false);
        }
      }
      
      console.log(`Login successful for ${username}`);
      return done(null, user);
    }),
  );

  passport.serializeUser((user, done) => done(null, (user as SelectUser).id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      
      // Check if linked employee is deleted (invalidate existing sessions)
      if (user.employeeId) {
        const employee = await storage.getEmployee(user.employeeId);
        if (employee && employee.status === 'deleted') {
          return done(null, false);
        }
      }
      
      // Get role permissions
      let permissions: string[] = [];
      if (user.roleId) {
        const role = await storage.getRole(user.roleId);
        if (role) {
          permissions = role.permissions || [];
        }
      }
      
      // Get employee area assignments
      let areaIds: string[] = [];
      let employeeName: string | undefined;
      if (user.employeeId) {
        const areas = await storage.getEmployeeAreas(user.employeeId);
        areaIds = areas.map(a => a.id);
        const employee = await storage.getEmployee(user.employeeId);
        employeeName = employee?.name;
      }
      
      const authUser: AuthUser = {
        ...user,
        permissions,
        areaIds,
        employeeName,
      };
      
      done(null, authUser);
    } catch (error) {
      done(error, null);
    }
  });

  app.post("/api/register", (_req, res) => {
    res.status(403).json({ error: "Registration is disabled. Please contact an administrator." });
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as AuthUser;
    // Return user info without password
    const { password, ...safeUser } = user;
    res.json(safeUser);
  });
}
