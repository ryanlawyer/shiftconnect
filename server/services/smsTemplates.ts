import { storage } from "../storage";
import type { SmsTemplate, Shift, Employee, Area } from "@shared/schema";

// Available template variables by category
export const TEMPLATE_VARIABLES: Record<string, Array<{ name: string; description: string }>> = {
  shift_notification: [
    { name: "date", description: "Shift date" },
    { name: "startTime", description: "Shift start time" },
    { name: "endTime", description: "Shift end time" },
    { name: "location", description: "Shift location" },
    { name: "area", description: "Area name (with parentheses if present)" },
    { name: "position", description: "Position title" },
    { name: "shiftType", description: "Same as position - the type of shift (e.g., RN, CNA)" },
    { name: "bonus", description: "Bonus amount with $ sign (e.g., '$50 bonus') - empty if no bonus" },
    { name: "employeeName", description: "Employee's name" },
    { name: "smsCode", description: "Shift SMS code for replies (e.g., ABC123)" },
    { name: "appUrl", description: "Application URL for viewing shift details" },
    { name: "claimLink", description: "Direct link to claim shift via web (e.g., https://yourapp.com/shift/ABC123)" },
  ],
  shift_repost: [
    { name: "date", description: "Shift date" },
    { name: "startTime", description: "Shift start time" },
    { name: "endTime", description: "Shift end time" },
    { name: "location", description: "Shift location" },
    { name: "area", description: "Area name (with parentheses if present)" },
    { name: "position", description: "Position title" },
    { name: "shiftType", description: "Same as position - the type of shift (e.g., RN, CNA)" },
    { name: "bonus", description: "Bonus amount with $ sign (e.g., '$50 bonus') - empty if no bonus" },
    { name: "employeeName", description: "Employee's name" },
    { name: "smsCode", description: "Shift SMS code for replies (e.g., ABC123)" },
    { name: "appUrl", description: "Application URL for viewing shift details" },
    { name: "claimLink", description: "Direct link to claim shift via web (e.g., https://yourapp.com/shift/ABC123)" },
  ],
  shift_confirmation: [
    { name: "date", description: "Shift date" },
    { name: "startTime", description: "Shift start time" },
    { name: "endTime", description: "Shift end time" },
    { name: "location", description: "Shift location" },
    { name: "area", description: "Area name (with parentheses if present)" },
    { name: "position", description: "Position title" },
    { name: "shiftType", description: "Same as position - the type of shift (e.g., RN, CNA)" },
    { name: "employeeName", description: "Employee's name" },
    { name: "smsCode", description: "Shift SMS code for replies (e.g., ABC123)" },
  ],
  shift_reminder: [
    { name: "date", description: "Shift date" },
    { name: "startTime", description: "Shift start time" },
    { name: "endTime", description: "Shift end time" },
    { name: "location", description: "Shift location" },
    { name: "area", description: "Area name (with parentheses if present)" },
    { name: "position", description: "Position title" },
    { name: "shiftType", description: "Same as position - the type of shift (e.g., RN, CNA)" },
    { name: "employeeName", description: "Employee's name" },
    { name: "smsCode", description: "Shift SMS code for replies (e.g., ABC123)" },
  ],
  shift_interest: [
    { name: "date", description: "Shift date" },
    { name: "startTime", description: "Shift start time" },
    { name: "endTime", description: "Shift end time" },
    { name: "location", description: "Shift location" },
    { name: "area", description: "Area name (with parentheses if present)" },
    { name: "position", description: "Position title" },
    { name: "shiftType", description: "Same as position - the type of shift (e.g., RN, CNA)" },
    { name: "employeeName", description: "Employee's name" },
  ],
  shift_cancellation: [
    { name: "date", description: "Shift date" },
    { name: "startTime", description: "Shift start time" },
    { name: "endTime", description: "Shift end time" },
    { name: "location", description: "Shift location" },
    { name: "area", description: "Area name (with parentheses if present)" },
    { name: "position", description: "Position title" },
    { name: "shiftType", description: "Same as position - the type of shift (e.g., RN, CNA)" },
    { name: "employeeName", description: "Employee's name" },
  ],
  training_reminder: [
    { name: "trainingTitle", description: "Training session title" },
    { name: "date", description: "Training date" },
    { name: "time", description: "Training time" },
    { name: "location", description: "Training location" },
    { name: "employeeName", description: "Employee's name" },
  ],
  welcome: [
    { name: "employeeName", description: "Employee's name" },
    { name: "appUrl", description: "Application URL" },
  ],
  general: [
    { name: "message", description: "Custom message content" },
    { name: "employeeName", description: "Employee's name" },
  ],
  bulk: [
    { name: "message", description: "Custom message content" },
    { name: "employeeName", description: "Employee's name" },
  ],
};

export type TemplateCategory = string;

// Variable context for template rendering
export interface TemplateContext {
  shift?: Shift;
  employee?: Employee;
  area?: Area | null;
  position?: { title: string };
  message?: string;
  custom?: Record<string, string>;
}

/**
 * Replace template variables with actual values
 * Variables are in the format {{variableName}}
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  let rendered = template;

  // Build variable map from context
  const variables: Record<string, string> = {};

  if (context.shift) {
    variables.date = context.shift.date;
    variables.startTime = context.shift.startTime;
    variables.endTime = context.shift.endTime;
    variables.location = context.shift.location;
    variables.smsCode = context.shift.smsCode || "";
    // Format bonus amount with $ sign
    if (context.shift.bonusAmount && context.shift.bonusAmount > 0) {
      variables.bonus = `$${context.shift.bonusAmount} bonus`;
    } else {
      variables.bonus = "";
    }
  }

  if (context.area) {
    variables.area = ` (${context.area.name})`;
  } else {
    variables.area = "";
  }

  if (context.position) {
    variables.position = context.position.title;
    variables.shiftType = context.position.title; // Alias for position
  }
  
  // Add appUrl - first check database setting, then environment variables
  // The appUrl will be populated by getRenderedTemplate which fetches from settings
  let appUrl = context.custom?.appUrl || "";
  if (!appUrl) {
    appUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.APP_URL || "";
  }
  variables.appUrl = appUrl;
  
  // Add claimLink - direct link to claim shift via web
  if (context.shift?.smsCode && appUrl) {
    variables.claimLink = `${appUrl}/shift/${context.shift.smsCode}`;
  } else {
    variables.claimLink = "";
  }

  if (context.employee) {
    variables.employeeName = context.employee.name;
  }

  if (context.message) {
    variables.message = context.message;
  }

  // Add any custom variables
  if (context.custom) {
    Object.assign(variables, context.custom);
  }

  // Replace all {{variable}} patterns
  rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] !== undefined ? variables[varName] : match;
  });

  return rendered;
}

/**
 * Get template by category and render it with context
 * Automatically fetches app_url from settings and adds to context
 */
export async function getRenderedTemplate(
  category: TemplateCategory,
  context: TemplateContext
): Promise<string | null> {
  const template = await storage.getSmsTemplateByCategory(category);

  if (!template) {
    return null;
  }

  // Fetch app_url setting and add to custom context
  const appUrlSetting = await storage.getSetting("app_url");
  if (appUrlSetting?.value) {
    context.custom = context.custom || {};
    context.custom.appUrl = appUrlSetting.value;
  }

  return renderTemplate(template.content, context);
}

/**
 * Validate a template string for syntax errors
 */
export function validateTemplate(
  template: string,
  category: TemplateCategory
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const validVariables = TEMPLATE_VARIABLES[category]?.map(v => v.name) || [];

  // Find all variables in the template
  const variablePattern = /\{\{(\w+)\}\}/g;
  let match;

  while ((match = variablePattern.exec(template)) !== null) {
    const varName = match[1];
    if (!validVariables.includes(varName)) {
      errors.push(`Unknown variable: {{${varName}}}. Valid variables for ${category}: ${validVariables.join(", ")}`);
    }
  }

  // Check for unclosed braces
  const openBraces = (template.match(/\{\{/g) || []).length;
  const closeBraces = (template.match(/\}\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push("Mismatched braces in template");
  }

  // Check template length (SMS limit considerations)
  if (template.length > 1600) {
    errors.push("Template is very long and may result in multiple SMS segments");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Preview a template with sample data
 */
export function previewTemplate(template: string, category: TemplateCategory): string {
  const sampleContext: TemplateContext = {
    shift: {
      id: "sample",
      date: "2024-01-15",
      startTime: "07:00",
      endTime: "15:00",
      location: "Main Building",
      positionId: "pos-1",
      areaId: "area-1",
      requirements: null,
      postedById: null,
      postedByName: "Admin",
      status: "available",
      assignedEmployeeId: null,
      smsCode: "ABC123",
      bonusAmount: 50,
      createdAt: new Date(),
      notifyAllAreas: false,
      lastNotifiedAt: null,
      notificationCount: 0,
    },
    employee: {
      id: "emp-sample",
      name: "John Smith",
      phone: "+15551234567",
      email: "john@example.com",
      positionId: "pos-1",
      role: "employee",
      roleId: null,
      status: "active",
      smsOptIn: true,
      username: null,
      webAccessEnabled: false,
    },
    area: {
      id: "area-1",
      name: "Emergency",
      description: "Emergency Department",
      smsEnabled: true,
    },
    position: {
      title: "DSP",
    },
    message: "This is a sample message.",
  };

  return renderTemplate(template, sampleContext);
}

export { TEMPLATE_VARIABLES as templateVariables };
