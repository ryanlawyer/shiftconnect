import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { Employee } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Bell, MessageSquare, Shield, User, MapPin, Plus, Pencil, Trash2, Loader2, Clock, Phone, Eye, EyeOff, CheckCircle2, XCircle, BarChart3, Send, AlertTriangle, FileText, Copy, RotateCcw, Info } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Area, Position, Role, OrganizationSetting, SmsTemplate } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Briefcase, Lock } from "lucide-react";

const AVAILABLE_PERMISSIONS = [
  { id: "manage_shifts", label: "Manage Shifts", description: "Create, edit, and delete shifts" },
  { id: "view_shifts", label: "View Shifts", description: "View available shifts" },
  { id: "manage_employees", label: "Manage Employees", description: "Add, edit, and manage employee records" },
  { id: "view_reports", label: "View Reports", description: "Access reporting and analytics" },
  { id: "export_reports", label: "Export Reports", description: "Export data to CSV/PDF" },
  { id: "view_audit_log", label: "View Audit Log", description: "Access system audit log and activity history" },
  { id: "manage_settings", label: "Manage Settings", description: "Configure organization settings" },
];

export default function Settings() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState({
    shiftUpdates: true,
    trainingReminders: true,
    directMessages: true,
    smsAlerts: true,
  });

  const { user } = useAuth();

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const { data: employee } = useQuery<Employee>({
    queryKey: [`/api/employees/${user?.employeeId}`],
    enabled: !!user?.employeeId,
  });

  useEffect(() => {
    if (employee) {
      setProfile({
        name: employee.name,
        email: employee.email || "",
        phone: employee.phone,
      });
    }
  }, [employee]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<Employee>) =>
      apiRequest("PATCH", `/api/employees/${user?.employeeId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${user?.employeeId}`] });
      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Area management state
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [areaForm, setAreaForm] = useState({ name: "", description: "", smsEnabled: true });

  const { data: areas = [], isLoading: areasLoading } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
  });

  const createAreaMutation = useMutation({
    mutationFn: (data: { name: string; description: string; smsEnabled: boolean }) =>
      apiRequest("POST", "/api/areas", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      setAreaDialogOpen(false);
      setAreaForm({ name: "", description: "", smsEnabled: true });
      toast({ title: "Area Created", description: "The new area has been added." });
    },
  });

  const updateAreaMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Area> }) =>
      apiRequest("PATCH", `/api/areas/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      setAreaDialogOpen(false);
      setEditingArea(null);
      setAreaForm({ name: "", description: "", smsEnabled: true });
      toast({ title: "Area Updated", description: "The area has been updated." });
    },
  });

  // Role management state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState<{
    name: string;
    description: string;
    permissions: string[];
  }>({ name: "", description: "", permissions: [] });
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const createRoleMutation = useMutation({
    mutationFn: (data: typeof roleForm) =>
      apiRequest("POST", "/api/roles", { ...data, isSystem: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setRoleDialogOpen(false);
      setRoleForm({ name: "", description: "", permissions: [] });
      toast({ title: "Role Created", description: "New role has been added successfully." });
    },
    onError: (error) => {
      toast({ title: "Failed to create role", description: error.message, variant: "destructive" });
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Role> }) =>
      apiRequest("PATCH", `/api/roles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setRoleDialogOpen(false);
      setEditingRole(null);
      setRoleForm({ name: "", description: "", permissions: [] });
      toast({ title: "Role Updated", description: "Role has been updated successfully." });
    },
    onError: (error) => {
      toast({ title: "Failed to update role", description: error.message, variant: "destructive" });
    }
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({ title: "Role Deleted", description: "Role has been removed." });
    },
    onError: (error) => {
      toast({ title: "Failed to delete role", description: error.message, variant: "destructive" });
    }
  });

  // Position management state
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [positionForm, setPositionForm] = useState({ title: "", description: "" });

  // Reassignment state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'area' | 'position', name: string } | null>(null);
  const [reassignToId, setReassignToId] = useState<string>("");

  const { data: positions = [], isLoading: positionsLoading } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
  });

  const createPositionMutation = useMutation({
    mutationFn: (data: { title: string; description: string }) =>
      apiRequest("POST", "/api/positions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      setPositionDialogOpen(false);
      setPositionForm({ title: "", description: "" });
      toast({ title: "Position Created", description: "The new position has been added." });
    },
  });

  const updatePositionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Position> }) =>
      apiRequest("PATCH", `/api/positions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      setPositionDialogOpen(false);
      setEditingPosition(null);
      setPositionForm({ title: "", description: "" });
      toast({ title: "Position Updated", description: "The position has been updated." });
    },
  });

  const deletePositionMutation = useMutation({
    mutationFn: (data: { id: string, reassignToId?: string }) =>
      apiRequest("DELETE", `/api/positions/${data.id}`, { reassignToId: data.reassignToId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setReassignToId("");
      toast({ title: "Position Deleted", description: "The position has been removed." });
    },
  });

  const deleteAreaMutationWithReassign = useMutation({
    mutationFn: (data: { id: string, reassignToId?: string }) =>
      apiRequest("DELETE", `/api/areas/${data.id}`, { reassignToId: data.reassignToId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setReassignToId("");
      toast({ title: "Area Deleted", description: "The area has been removed." });
    },
  });

  // Organization Settings
  const [urgentThreshold, setUrgentThreshold] = useState("48");

  // SMS Settings (provider-agnostic)
  const [smsSettings, setSmsSettings] = useState({
    // Provider selection
    smsProvider: "twilio" as "twilio" | "ringcentral",
    // Twilio credentials
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioFromNumber: "",
    twilioMessagingServiceSid: "",
    // RingCentral credentials
    ringcentralClientId: "",
    ringcentralClientSecret: "",
    ringcentralJwt: "",
    ringcentralFromNumber: "",
    ringcentralServerUrl: "https://platform.ringcentral.com",
    // General settings
    smsEnabled: false,
    smsDailyLimit: "1000",
    notifyOnNewShift: true,
    notifyOnShiftClaimed: true,
    shiftReminderEnabled: true,
    shiftReminderHours: "24",
    smsQuietHoursStart: "22:00",
    smsQuietHoursEnd: "07:00",
    smsRespectQuietHours: true,
  });
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [showRcSecret, setShowRcSecret] = useState(false);
  const [showRcJwt, setShowRcJwt] = useState(false);

  // SMS Status check
  const { data: smsStatus } = useQuery<{
    enabled: boolean;
    provider: "twilio" | "ringcentral";
    configured: boolean;
    initialized: boolean;
    fromNumber: string | null;
  }>({
    queryKey: ["/api/sms/status"],
  });

  // SMS Analytics
  const { data: smsAnalytics } = useQuery<{
    totals: { sent: number; received: number; delivered: number; failed: number; segments: number };
    today: { sent: number; segments: number };
    thisWeek: { sent: number; segments: number };
    thisMonth: { sent: number; segments: number };
    rates: { deliveryRate: number; failureRate: number };
    byType: { general: number; shiftNotification: number; shiftReminder: number; shiftConfirmation: number; bulk: number };
  }>({
    queryKey: ["/api/sms/analytics"],
    enabled: user?.role === "admin",
  });

  // SMS Templates
  const { data: smsTemplates = [], isLoading: templatesLoading } = useQuery<SmsTemplate[]>({
    queryKey: ["/api/sms/templates"],
    enabled: user?.role === "admin",
  });

  const { data: templateVariables } = useQuery<Record<string, Array<{ name: string; description: string }>>>({
    queryKey: ["/api/sms/templates/variables"],
    enabled: user?.role === "admin",
  });

  // Template management state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    category: "general",
    content: "",
    isActive: true,
  });
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const [templateValidation, setTemplateValidation] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<SmsTemplate | null>(null);
  const [isDraggingVariable, setIsDraggingVariable] = useState(false);
  const [draggedVariable, setDraggedVariable] = useState<string | null>(null);
  const templateTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: (data: typeof templateForm) =>
      apiRequest("POST", "/api/sms/templates", { ...data, isSystem: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms/templates"] });
      setTemplateDialogOpen(false);
      resetTemplateForm();
      toast({ title: "Template Created", description: "New SMS template has been added." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create template", description: error.message || "Unknown error", variant: "destructive" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof templateForm> }) =>
      apiRequest("PATCH", `/api/sms/templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms/templates"] });
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
      resetTemplateForm();
      toast({ title: "Template Updated", description: "SMS template has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update template", description: error.message || "Unknown error", variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/sms/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms/templates"] });
      setTemplateToDelete(null);
      toast({ title: "Template Deleted", description: "SMS template has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete template", description: error.message || "Unknown error", variant: "destructive" });
    },
  });

  const validateTemplateMutation = useMutation({
    mutationFn: async (data: { content: string; category: string }) => {
      const response = await apiRequest("POST", "/api/sms/templates/validate", data);
      return response.json() as Promise<{ valid: boolean; errors: string[]; preview: string }>;
    },
    onSuccess: (result) => {
      setTemplateValidation({ valid: result.valid, errors: result.errors });
      setTemplatePreview(result.preview);
    },
  });

  const resetTemplateForm = () => {
    setTemplateForm({
      name: "",
      description: "",
      category: "general",
      content: "",
      isActive: true,
    });
    setTemplatePreview(null);
    setTemplateValidation(null);
  };

  const openNewTemplate = () => {
    setEditingTemplate(null);
    resetTemplateForm();
    setTemplateDialogOpen(true);
  };

  const openEditTemplate = (template: SmsTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || "",
      category: template.category,
      content: template.content,
      isActive: template.isActive,
    });
    setTemplatePreview(null);
    setTemplateValidation(null);
    setTemplateDialogOpen(true);
  };

  const handleTemplateSubmit = () => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data: templateForm });
    } else {
      createTemplateMutation.mutate(templateForm);
    }
  };

  const insertVariable = (varName: string) => {
    const textarea = templateTextareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? templateForm.content.length;
      const end = textarea.selectionEnd ?? templateForm.content.length;
      const text = templateForm.content;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newContent = `${before}{{${varName}}}${after}`;
      setTemplateForm({ ...templateForm, content: newContent });
      setTemplatePreview(null);
      setTemplateValidation(null);
      // Reset cursor position after state update
      setTimeout(() => {
        textarea.focus();
        const newPos = start + varName.length + 4;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    }
  };

  const handleVariableDragStart = (e: React.DragEvent, varName: string) => {
    e.dataTransfer.setData("text/plain", `{{${varName}}}`);
    e.dataTransfer.effectAllowed = "copy";
    setDraggedVariable(varName);
    setIsDraggingVariable(true);
  };

  const handleVariableDragEnd = () => {
    setDraggedVariable(null);
    setIsDraggingVariable(false);
  };

  const handleTextareaDragOver = (e: React.DragEvent) => {
    if (isDraggingVariable) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleTextareaDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedVariable) return;

    const textarea = templateTextareaRef.current;
    if (!textarea) return;

    // Insert at end of content since drop position is unreliable
    const text = templateForm.content;
    const newContent = `${text}{{${draggedVariable}}}`;

    setTemplateForm({ ...templateForm, content: newContent });
    setTemplatePreview(null);
    setTemplateValidation(null);
    setDraggedVariable(null);
    setIsDraggingVariable(false);

    // Focus and position cursor at end
    setTimeout(() => {
      textarea.focus();
      const newPos = newContent.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      general: "General",
      shift_notification: "New Shift Notification",
      shift_confirmation: "Shift Confirmation",
      shift_reminder: "Shift Reminder",
      bulk: "Bulk Message",
    };
    return labels[category] || category;
  };

  const getCategoryBadgeVariant = (category: string): "default" | "secondary" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      shift_notification: "default",
      shift_confirmation: "default",
      shift_reminder: "secondary",
      general: "outline",
      bulk: "outline",
    };
    return variants[category] || "outline";
  };

  const { data: settings = [] } = useQuery<OrganizationSetting[]>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    const thresholdSetting = settings.find(s => s.key === "urgent_shift_threshold_hours");
    if (thresholdSetting) {
      setUrgentThreshold(thresholdSetting.value);
    }

    // Load SMS settings
    const getValue = (key: string, defaultValue: string) => {
      const setting = settings.find(s => s.key === key);
      return setting?.value ?? defaultValue;
    };

    setSmsSettings({
      // Provider selection
      smsProvider: (getValue("sms_provider", "twilio") as "twilio" | "ringcentral"),
      // Twilio credentials
      twilioAccountSid: getValue("twilio_account_sid", ""),
      twilioAuthToken: getValue("twilio_auth_token", ""),
      twilioFromNumber: getValue("twilio_from_number", ""),
      twilioMessagingServiceSid: getValue("twilio_messaging_service_sid", ""),
      // RingCentral credentials
      ringcentralClientId: getValue("ringcentral_client_id", ""),
      ringcentralClientSecret: getValue("ringcentral_client_secret", ""),
      ringcentralJwt: getValue("ringcentral_jwt", ""),
      ringcentralFromNumber: getValue("ringcentral_from_number", ""),
      ringcentralServerUrl: getValue("ringcentral_server_url", "https://platform.ringcentral.com"),
      // General settings
      smsEnabled: getValue("sms_enabled", "false") === "true",
      smsDailyLimit: getValue("sms_daily_limit", "1000"),
      notifyOnNewShift: getValue("notify_on_new_shift", "true") === "true",
      notifyOnShiftClaimed: getValue("notify_on_shift_claimed", "true") === "true",
      shiftReminderEnabled: getValue("shift_reminder_enabled", "true") === "true",
      shiftReminderHours: getValue("shift_reminder_hours", "24"),
      smsQuietHoursStart: getValue("sms_quiet_hours_start", "22:00"),
      smsQuietHoursEnd: getValue("sms_quiet_hours_end", "07:00"),
      smsRespectQuietHours: getValue("sms_respect_quiet_hours", "true") === "true",
    });
  }, [settings]);

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiRequest("PUT", `/api/settings/${key}`, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Setting Updated", description: "The setting has been saved." });
    },
    onError: (error) => {
      toast({ title: "Failed to update setting", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!user?.employeeId) return;
    updateProfileMutation.mutate({
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
    });
  };

  const openEditArea = (area: Area) => {
    setEditingArea(area);
    setAreaForm({ name: area.name, description: area.description || "", smsEnabled: area.smsEnabled });
    setAreaDialogOpen(true);
  };

  const openNewArea = () => {
    setEditingArea(null);
    setAreaForm({ name: "", description: "", smsEnabled: true });
    setAreaDialogOpen(true);
  };

  const handleAreaSubmit = () => {
    if (editingArea) {
      updateAreaMutation.mutate({ id: editingArea.id, data: areaForm });
    } else {
      createAreaMutation.mutate(areaForm);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-settings">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and organization preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className={`grid w-full ${user?.role === "admin" ? "grid-cols-5" : "grid-cols-4"}`}>
          <TabsTrigger value="profile" data-testid="tab-profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="organization" data-testid="tab-organization">
            <MapPin className="h-4 w-4 mr-2" />
            Organization
          </TabsTrigger>
          {user?.role === "admin" && (
            <TabsTrigger value="sms" data-testid="tab-sms">
              <Phone className="h-4 w-4 mr-2" />
              SMS
            </TabsTrigger>
          )}
          <TabsTrigger value="security" data-testid="tab-security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <CardTitle>Personal Information</CardTitle>
              </div>
              <CardDescription>Update your personal details and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    data-testid="input-phone"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  data-testid="input-email"
                />
              </div>
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSave}
                  data-testid="button-save-profile"
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <CardTitle>Notification Preferences</CardTitle>
              </div>
              <CardDescription>Choose what notifications you receive and how</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Shift Updates</Label>
                  <p className="text-sm text-muted-foreground">Get notified about new shift openings</p>
                </div>
                <Switch
                  checked={notifications.shiftUpdates}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, shiftUpdates: checked })}
                  data-testid="switch-shift-updates"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Training Reminders</Label>
                  <p className="text-sm text-muted-foreground">Receive reminders for upcoming training sessions</p>
                </div>
                <Switch
                  checked={notifications.trainingReminders}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, trainingReminders: checked })}
                  data-testid="switch-training-reminders"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Direct Messages</Label>
                  <p className="text-sm text-muted-foreground">Get notified when someone messages you</p>
                </div>
                <Switch
                  checked={notifications.directMessages}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, directMessages: checked })}
                  data-testid="switch-direct-messages"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <Label>SMS Alerts</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">Receive important updates via text message</p>
                </div>
                <Switch
                  checked={notifications.smsAlerts}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, smsAlerts: checked })}
                  data-testid="switch-sms-alerts"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  <CardTitle>Areas</CardTitle>
                </div>
                <Button size="sm" onClick={openNewArea} data-testid="button-add-area">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Area
                </Button>
              </div>
              <CardDescription>Manage work areas for shift assignments and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              {areasLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : areas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No areas defined yet. Add your first area to get started.</p>
              ) : (
                <div className="space-y-2">
                  {areas.map((area) => (
                    <div
                      key={area.id}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                      data-testid={`area-item-${area.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{area.name}</p>
                          {area.description && (
                            <p className="text-sm text-muted-foreground">{area.description}</p>
                          )}
                        </div>
                        {area.smsEnabled ? (
                          <Badge variant="secondary" className="text-xs">SMS enabled</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">SMS disabled</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditArea(area)}
                          data-testid={`button-edit-area-${area.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setItemToDelete({ id: area.id, type: 'area', name: area.name });
                            setDeleteDialogOpen(true);
                          }}
                          disabled={deleteAreaMutationWithReassign.isPending}
                          data-testid={`button-delete-area-${area.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  <CardTitle>Access Roles</CardTitle>
                </div>
                <Button size="sm" onClick={() => {
                  setEditingRole(null);
                  setRoleForm({ name: "", description: "", permissions: [] });
                  setRoleDialogOpen(true);
                }} data-testid="button-add-role">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Role
                </Button>
              </div>
              <CardDescription>Manage user roles and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              {rolesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : roles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No roles defined.</p>
              ) : (
                <div className="space-y-2">
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{role.name}</p>
                            {role.isSystem && <Badge variant="secondary" className="text-xs">System</Badge>}
                          </div>
                          {role.description && <p className="text-sm text-muted-foreground">{role.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => {
                          setEditingRole(role);
                          setRoleForm({
                            name: role.name,
                            description: role.description || "",
                            permissions: (role.permissions as string[]) || []
                          });
                          setRoleDialogOpen(true);
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!role.isSystem && (
                          <Button size="icon" variant="ghost" onClick={() => setRoleToDelete(role)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <CardTitle>Dashboard Settings</CardTitle>
              </div>
              <CardDescription>Configure how urgent shifts are displayed on the dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="urgent-threshold">Urgent Shift Threshold</Label>
                  <p className="text-sm text-muted-foreground">
                    Shifts starting within this many hours will be shown as urgent on the dashboard
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="urgent-threshold"
                    type="number"
                    min="1"
                    max="168"
                    value={urgentThreshold}
                    onChange={(e) => setUrgentThreshold(e.target.value)}
                    className="w-20"
                    data-testid="input-urgent-threshold"
                  />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => updateSettingMutation.mutate({
                    key: "urgent_shift_threshold_hours",
                    value: urgentThreshold
                  })}
                  disabled={updateSettingMutation.isPending}
                  data-testid="button-save-threshold"
                >
                  {updateSettingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Threshold
                </Button>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* SMS Tab - Admin Only */}
        {user?.role === "admin" && (
          <TabsContent value="sms" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    <CardTitle>SMS Messaging</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {smsStatus?.provider || smsSettings.smsProvider}
                    </Badge>
                    {smsStatus?.configured ? (
                      smsStatus.initialized ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Configured
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline">
                        <XCircle className="h-3 w-3 mr-1" />
                        Not Configured
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription>Configure SMS provider integration for notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Master Toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Enable SMS Messaging</Label>
                    <p className="text-sm text-muted-foreground">
                      Turn on SMS notifications for shift alerts
                    </p>
                  </div>
                  <Switch
                    checked={smsSettings.smsEnabled}
                    onCheckedChange={(checked) => {
                      setSmsSettings(prev => ({ ...prev, smsEnabled: checked }));
                      updateSettingMutation.mutate({ key: "sms_enabled", value: checked.toString() });
                    }}
                    data-testid="switch-sms-enabled"
                  />
                </div>

                <Separator />

                {/* Provider Selection */}
                <div className="space-y-4">
                  <h4 className="font-medium">SMS Provider</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSmsSettings(prev => ({ ...prev, smsProvider: "twilio" }));
                        updateSettingMutation.mutate({ key: "sms_provider", value: "twilio" });
                        queryClient.invalidateQueries({ queryKey: ["/api/sms/status"] });
                      }}
                      className={`p-4 rounded-lg border-2 transition-colors text-left ${
                        smsSettings.smsProvider === "twilio"
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-muted-foreground/30"
                      }`}
                      data-testid="button-provider-twilio"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">Twilio</span>
                        {smsSettings.smsProvider === "twilio" && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Industry-leading SMS API with global reach and excellent deliverability
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSmsSettings(prev => ({ ...prev, smsProvider: "ringcentral" }));
                        updateSettingMutation.mutate({ key: "sms_provider", value: "ringcentral" });
                        queryClient.invalidateQueries({ queryKey: ["/api/sms/status"] });
                      }}
                      className={`p-4 rounded-lg border-2 transition-colors text-left ${
                        smsSettings.smsProvider === "ringcentral"
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-muted-foreground/30"
                      }`}
                      data-testid="button-provider-ringcentral"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">RingCentral</span>
                        {smsSettings.smsProvider === "ringcentral" && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Unified communications platform with SMS, voice, and team messaging
                      </p>
                    </button>
                  </div>
                </div>

                <Separator />

                {/* Twilio Credentials */}
                {smsSettings.smsProvider === "twilio" && (
                  <div className="space-y-4">
                    <h4 className="font-medium">Twilio Credentials</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="twilio-sid">Account SID</Label>
                        <Input
                          id="twilio-sid"
                          value={smsSettings.twilioAccountSid}
                          onChange={(e) => setSmsSettings(prev => ({ ...prev, twilioAccountSid: e.target.value }))}
                          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          data-testid="input-twilio-sid"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="twilio-token">Auth Token</Label>
                        <div className="relative">
                          <Input
                            id="twilio-token"
                            type={showAuthToken ? "text" : "password"}
                            value={smsSettings.twilioAuthToken}
                            onChange={(e) => setSmsSettings(prev => ({ ...prev, twilioAuthToken: e.target.value }))}
                            placeholder="Enter auth token"
                            data-testid="input-twilio-token"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowAuthToken(!showAuthToken)}
                          >
                            {showAuthToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="twilio-from">From Phone Number</Label>
                        <Input
                          id="twilio-from"
                          value={smsSettings.twilioFromNumber}
                          onChange={(e) => setSmsSettings(prev => ({ ...prev, twilioFromNumber: e.target.value }))}
                          placeholder="+15551234567"
                          data-testid="input-twilio-from"
                        />
                        <p className="text-xs text-muted-foreground">Your Twilio phone number in E.164 format</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="twilio-service">Messaging Service SID (Optional)</Label>
                        <Input
                          id="twilio-service"
                          value={smsSettings.twilioMessagingServiceSid}
                          onChange={(e) => setSmsSettings(prev => ({ ...prev, twilioMessagingServiceSid: e.target.value }))}
                          placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          data-testid="input-twilio-service"
                        />
                        <p className="text-xs text-muted-foreground">For high-volume sending</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={async () => {
                          await updateSettingMutation.mutateAsync({ key: "twilio_account_sid", value: smsSettings.twilioAccountSid });
                          await updateSettingMutation.mutateAsync({ key: "twilio_auth_token", value: smsSettings.twilioAuthToken });
                          await updateSettingMutation.mutateAsync({ key: "twilio_from_number", value: smsSettings.twilioFromNumber });
                          await updateSettingMutation.mutateAsync({ key: "twilio_messaging_service_sid", value: smsSettings.twilioMessagingServiceSid });
                          queryClient.invalidateQueries({ queryKey: ["/api/sms/status"] });
                        }}
                        disabled={updateSettingMutation.isPending}
                        data-testid="button-save-twilio"
                      >
                        {updateSettingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Save Twilio Credentials
                      </Button>
                    </div>
                  </div>
                )}

                {/* RingCentral Credentials */}
                {smsSettings.smsProvider === "ringcentral" && (
                  <div className="space-y-4">
                    <h4 className="font-medium">RingCentral Credentials</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="rc-client-id">Client ID</Label>
                        <Input
                          id="rc-client-id"
                          value={smsSettings.ringcentralClientId}
                          onChange={(e) => setSmsSettings(prev => ({ ...prev, ringcentralClientId: e.target.value }))}
                          placeholder="Enter client ID"
                          data-testid="input-rc-client-id"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rc-client-secret">Client Secret</Label>
                        <div className="relative">
                          <Input
                            id="rc-client-secret"
                            type={showRcSecret ? "text" : "password"}
                            value={smsSettings.ringcentralClientSecret}
                            onChange={(e) => setSmsSettings(prev => ({ ...prev, ringcentralClientSecret: e.target.value }))}
                            placeholder="Enter client secret"
                            data-testid="input-rc-client-secret"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowRcSecret(!showRcSecret)}
                          >
                            {showRcSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="rc-jwt">JWT Token</Label>
                        <div className="relative">
                          <Input
                            id="rc-jwt"
                            type={showRcJwt ? "text" : "password"}
                            value={smsSettings.ringcentralJwt}
                            onChange={(e) => setSmsSettings(prev => ({ ...prev, ringcentralJwt: e.target.value }))}
                            placeholder="Enter JWT token for authentication"
                            data-testid="input-rc-jwt"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowRcJwt(!showRcJwt)}
                          >
                            {showRcJwt ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Generate a JWT token in your RingCentral Developer Portal</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rc-from">From Phone Number</Label>
                        <Input
                          id="rc-from"
                          value={smsSettings.ringcentralFromNumber}
                          onChange={(e) => setSmsSettings(prev => ({ ...prev, ringcentralFromNumber: e.target.value }))}
                          placeholder="+15551234567"
                          data-testid="input-rc-from"
                        />
                        <p className="text-xs text-muted-foreground">Your RingCentral SMS-enabled phone number</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rc-server">Server URL</Label>
                        <Select
                          value={smsSettings.ringcentralServerUrl}
                          onValueChange={(value) => setSmsSettings(prev => ({ ...prev, ringcentralServerUrl: value }))}
                        >
                          <SelectTrigger data-testid="select-rc-server">
                            <SelectValue placeholder="Select server" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="https://platform.ringcentral.com">Production</SelectItem>
                            <SelectItem value="https://platform.devtest.ringcentral.com">Sandbox</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Use Sandbox for testing, Production for live</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={async () => {
                          await updateSettingMutation.mutateAsync({ key: "ringcentral_client_id", value: smsSettings.ringcentralClientId });
                          await updateSettingMutation.mutateAsync({ key: "ringcentral_client_secret", value: smsSettings.ringcentralClientSecret });
                          await updateSettingMutation.mutateAsync({ key: "ringcentral_jwt", value: smsSettings.ringcentralJwt });
                          await updateSettingMutation.mutateAsync({ key: "ringcentral_from_number", value: smsSettings.ringcentralFromNumber });
                          await updateSettingMutation.mutateAsync({ key: "ringcentral_server_url", value: smsSettings.ringcentralServerUrl });
                          queryClient.invalidateQueries({ queryKey: ["/api/sms/status"] });
                        }}
                        disabled={updateSettingMutation.isPending}
                        data-testid="button-save-ringcentral"
                      >
                        {updateSettingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Save RingCentral Credentials
                      </Button>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Notification Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium">Notification Settings</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Notify on New Shift</Label>
                        <p className="text-sm text-muted-foreground">Send SMS when new shifts are posted</p>
                      </div>
                      <Switch
                        checked={smsSettings.notifyOnNewShift}
                        onCheckedChange={(checked) => {
                          setSmsSettings(prev => ({ ...prev, notifyOnNewShift: checked }));
                          updateSettingMutation.mutate({ key: "notify_on_new_shift", value: checked.toString() });
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Notify on Shift Claimed</Label>
                        <p className="text-sm text-muted-foreground">Send confirmation when employee claims a shift</p>
                      </div>
                      <Switch
                        checked={smsSettings.notifyOnShiftClaimed}
                        onCheckedChange={(checked) => {
                          setSmsSettings(prev => ({ ...prev, notifyOnShiftClaimed: checked }));
                          updateSettingMutation.mutate({ key: "notify_on_shift_claimed", value: checked.toString() });
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Shift Reminders</Label>
                        <p className="text-sm text-muted-foreground">Send reminder before shift starts</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          max="72"
                          value={smsSettings.shiftReminderHours}
                          onChange={(e) => setSmsSettings(prev => ({ ...prev, shiftReminderHours: e.target.value }))}
                          onBlur={() => updateSettingMutation.mutate({ key: "shift_reminder_hours", value: smsSettings.shiftReminderHours })}
                          className="w-16"
                          disabled={!smsSettings.shiftReminderEnabled}
                        />
                        <span className="text-sm text-muted-foreground">hours before</span>
                        <Switch
                          checked={smsSettings.shiftReminderEnabled}
                          onCheckedChange={(checked) => {
                            setSmsSettings(prev => ({ ...prev, shiftReminderEnabled: checked }));
                            updateSettingMutation.mutate({ key: "shift_reminder_enabled", value: checked.toString() });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Quiet Hours */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Quiet Hours</h4>
                      <p className="text-sm text-muted-foreground">Delay non-urgent SMS during these hours</p>
                    </div>
                    <Switch
                      checked={smsSettings.smsRespectQuietHours}
                      onCheckedChange={(checked) => {
                        setSmsSettings(prev => ({ ...prev, smsRespectQuietHours: checked }));
                        updateSettingMutation.mutate({ key: "sms_respect_quiet_hours", value: checked.toString() });
                      }}
                    />
                  </div>
                  {smsSettings.smsRespectQuietHours && (
                    <div className="flex items-center gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quiet-start">Start</Label>
                        <Input
                          id="quiet-start"
                          type="time"
                          value={smsSettings.smsQuietHoursStart}
                          onChange={(e) => setSmsSettings(prev => ({ ...prev, smsQuietHoursStart: e.target.value }))}
                          onBlur={() => updateSettingMutation.mutate({ key: "sms_quiet_hours_start", value: smsSettings.smsQuietHoursStart })}
                          className="w-32"
                        />
                      </div>
                      <span className="text-muted-foreground mt-6">to</span>
                      <div className="space-y-2">
                        <Label htmlFor="quiet-end">End</Label>
                        <Input
                          id="quiet-end"
                          type="time"
                          value={smsSettings.smsQuietHoursEnd}
                          onChange={(e) => setSmsSettings(prev => ({ ...prev, smsQuietHoursEnd: e.target.value }))}
                          onBlur={() => updateSettingMutation.mutate({ key: "sms_quiet_hours_end", value: smsSettings.smsQuietHoursEnd })}
                          className="w-32"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Usage Limits */}
                <div className="space-y-4">
                  <h4 className="font-medium">Usage Limits</h4>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Daily Message Limit</Label>
                      <p className="text-sm text-muted-foreground">Maximum SMS messages per day</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="10000"
                        value={smsSettings.smsDailyLimit}
                        onChange={(e) => setSmsSettings(prev => ({ ...prev, smsDailyLimit: e.target.value }))}
                        onBlur={() => updateSettingMutation.mutate({ key: "sms_daily_limit", value: smsSettings.smsDailyLimit })}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">messages</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SMS Analytics Card */}
            {smsAnalytics && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    <CardTitle>SMS Analytics</CardTitle>
                  </div>
                  <CardDescription>Message delivery statistics and usage metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg border bg-muted/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Send className="h-4 w-4" />
                        <span className="text-sm">Today</span>
                      </div>
                      <p className="text-2xl font-semibold">{smsAnalytics.today.sent}</p>
                      <p className="text-xs text-muted-foreground">{smsAnalytics.today.segments} segments</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-muted/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Send className="h-4 w-4" />
                        <span className="text-sm">This Week</span>
                      </div>
                      <p className="text-2xl font-semibold">{smsAnalytics.thisWeek.sent}</p>
                      <p className="text-xs text-muted-foreground">{smsAnalytics.thisWeek.segments} segments</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-muted/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Delivery Rate</span>
                      </div>
                      <p className="text-2xl font-semibold">{smsAnalytics.rates.deliveryRate}%</p>
                      <p className="text-xs text-muted-foreground">{smsAnalytics.totals.delivered} delivered</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-muted/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <span className="text-sm">Failed</span>
                      </div>
                      <p className="text-2xl font-semibold">{smsAnalytics.totals.failed}</p>
                      <p className="text-xs text-muted-foreground">{smsAnalytics.rates.failureRate}% failure rate</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Message Types Breakdown */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Messages by Type</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <div className="p-3 rounded-lg border text-center">
                        <p className="text-lg font-semibold">{smsAnalytics.byType.shiftNotification}</p>
                        <p className="text-xs text-muted-foreground">New Shift</p>
                      </div>
                      <div className="p-3 rounded-lg border text-center">
                        <p className="text-lg font-semibold">{smsAnalytics.byType.shiftConfirmation}</p>
                        <p className="text-xs text-muted-foreground">Confirmations</p>
                      </div>
                      <div className="p-3 rounded-lg border text-center">
                        <p className="text-lg font-semibold">{smsAnalytics.byType.shiftReminder}</p>
                        <p className="text-xs text-muted-foreground">Reminders</p>
                      </div>
                      <div className="p-3 rounded-lg border text-center">
                        <p className="text-lg font-semibold">{smsAnalytics.byType.bulk}</p>
                        <p className="text-xs text-muted-foreground">Bulk</p>
                      </div>
                      <div className="p-3 rounded-lg border text-center">
                        <p className="text-lg font-semibold">{smsAnalytics.byType.general}</p>
                        <p className="text-xs text-muted-foreground">General</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Totals */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">All time:</span>
                      <span><strong>{smsAnalytics.totals.sent}</strong> sent</span>
                      <span><strong>{smsAnalytics.totals.received}</strong> received</span>
                      <span><strong>{smsAnalytics.totals.segments}</strong> segments</span>
                    </div>
                    <span className="text-muted-foreground">
                      This month: {smsAnalytics.thisMonth.sent} messages ({smsAnalytics.thisMonth.segments} segments)
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SMS Templates Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    <CardTitle>Message Templates</CardTitle>
                  </div>
                  <Button size="sm" onClick={openNewTemplate} data-testid="button-add-template">
                    <Plus className="h-4 w-4 mr-1" />
                    New Template
                  </Button>
                </div>
                <CardDescription>
                  Customize SMS message templates with dynamic variables. Templates are used for automatic notifications.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {templatesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : smsTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No templates configured. Create your first template to customize SMS messages.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {smsTemplates.map((template) => (
                      <div
                        key={template.id}
                        className={`p-4 rounded-lg border ${!template.isActive ? "opacity-60 bg-muted/30" : "bg-muted/50"}`}
                        data-testid={`template-item-${template.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium">{template.name}</p>
                              <Badge variant={getCategoryBadgeVariant(template.category)} className="text-xs">
                                {getCategoryLabel(template.category)}
                              </Badge>
                              {template.isSystem && (
                                <Badge variant="secondary" className="text-xs">System</Badge>
                              )}
                              {!template.isActive && (
                                <Badge variant="outline" className="text-xs text-orange-600">Inactive</Badge>
                              )}
                            </div>
                            {template.description && (
                              <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                            )}
                            <div className="bg-background rounded p-2 border text-sm font-mono whitespace-pre-wrap break-words">
                              {template.content.length > 150
                                ? `${template.content.substring(0, 150)}...`
                                : template.content}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => openEditTemplate(template)}
                                    data-testid={`button-edit-template-${template.id}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit template</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {!template.isSystem && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setTemplateToDelete(template)}
                                      disabled={deleteTemplateMutation.isPending}
                                      data-testid={`button-delete-template-${template.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete template</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle>Account Security</CardTitle>
              </div>
              <CardDescription>Manage your password and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-0.5">
                  <p className="font-medium">Password</p>
                  <p className="text-sm text-muted-foreground">Change your account password</p>
                </div>
                <Button variant="outline" data-testid="button-change-password">
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={areaDialogOpen} onOpenChange={setAreaDialogOpen}>
        <DialogContent data-testid="dialog-area">
          <DialogHeader>
            <DialogTitle>{editingArea ? "Edit Area" : "Add New Area"}</DialogTitle>
            <DialogDescription>
              {editingArea ? "Update the area details below." : "Create a new area for shift assignments."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="area-name">Area Name</Label>
              <Input
                id="area-name"
                value={areaForm.name}
                onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                placeholder="e.g., Emergency Department"
                data-testid="input-area-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-description">Description (Optional)</Label>
              <Input
                id="area-description"
                value={areaForm.description}
                onChange={(e) => setAreaForm({ ...areaForm, description: e.target.value })}
                placeholder="Brief description of this area"
                data-testid="input-area-description"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">Send SMS to employees in this area for new shifts</p>
              </div>
              <Switch
                checked={areaForm.smsEnabled}
                onCheckedChange={(checked) => setAreaForm({ ...areaForm, smsEnabled: checked })}
                data-testid="switch-area-sms"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAreaDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAreaSubmit}
              disabled={!areaForm.name || createAreaMutation.isPending || updateAreaMutation.isPending}
              data-testid="button-save-area"
            >
              {(createAreaMutation.isPending || updateAreaMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingArea ? "Save Changes" : "Create Area"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={positionDialogOpen} onOpenChange={setPositionDialogOpen}>
        <DialogContent data-testid="dialog-position">
          <DialogHeader>
            <DialogTitle>{editingPosition ? "Edit Position" : "Add New Position"}</DialogTitle>
            <DialogDescription>
              {editingPosition ? "Update the position details below." : "Create a new position role."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="position-title">Job Title</Label>
              <Input
                id="position-title"
                value={positionForm.title}
                onChange={(e) => setPositionForm({ ...positionForm, title: e.target.value })}
                placeholder="e.g., DSP"
                data-testid="input-position-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position-description">Description (Optional)</Label>
              <Input
                id="position-description"
                value={positionForm.description}
                onChange={(e) => setPositionForm({ ...positionForm, description: e.target.value })}
                placeholder="Brief description of this role"
                data-testid="input-position-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPositionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingPosition) {
                  updatePositionMutation.mutate({ id: editingPosition.id, data: positionForm });
                } else {
                  createPositionMutation.mutate(positionForm);
                }
              }}
              disabled={!positionForm.title || createPositionMutation.isPending || updatePositionMutation.isPending}
              data-testid="button-save-position"
            >
              {(createPositionMutation.isPending || updatePositionMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingPosition ? "Save Changes" : "Create Position"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {itemToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>This action cannot be undone. To prevent orphan records, you must reassign any associated employees or shifts to a new {itemToDelete?.type}.</p>

              <div className="space-y-2">
                <Label>Reassign to:</Label>
                <Select value={reassignToId} onValueChange={setReassignToId}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select a new ${itemToDelete?.type}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {itemToDelete?.type === 'area' ? (
                      areas.filter(a => a.id !== itemToDelete.id).map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))
                    ) : (
                      positions.filter(p => p.id !== itemToDelete?.id).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setReassignToId("");
              setItemToDelete(null);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!reassignToId}
              onClick={() => {
                if (!itemToDelete || !reassignToId) return;

                if (itemToDelete.type === 'area') {
                  deleteAreaMutationWithReassign.mutate({ id: itemToDelete.id, reassignToId });
                } else {
                  deletePositionMutation.mutate({ id: itemToDelete.id, reassignToId });
                }
              }}
            >
              Reassign & Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent data-testid="dialog-role">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Add New Role"}</DialogTitle>
            <DialogDescription>
              {editingRole ? "Update the role details and permissions." : "Create a new role with specific permissions."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                placeholder="e.g., Shift Lead"
                data-testid="input-role-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                placeholder="Brief description of this access level"
                data-testid="input-role-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="space-y-3 border rounded-md p-3 max-h-64 overflow-y-auto">
                {AVAILABLE_PERMISSIONS.map((perm) => (
                  <div key={perm.id} className="flex items-start gap-2">
                    <Checkbox
                      id={`perm-${perm.id}`}
                      checked={roleForm.permissions.includes(perm.id)}
                      onCheckedChange={(checked) => {
                        const newPerms = checked
                          ? [...roleForm.permissions, perm.id]
                          : roleForm.permissions.filter(p => p !== perm.id);
                        setRoleForm({ ...roleForm, permissions: newPerms });
                      }}
                      className="mt-0.5"
                    />
                    <div>
                      <Label htmlFor={`perm-${perm.id}`} className="cursor-pointer">{perm.label}</Label>
                      <p className="text-xs text-muted-foreground">{perm.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingRole) {
                  updateRoleMutation.mutate({ id: editingRole.id, data: roleForm });
                } else {
                  createRoleMutation.mutate(roleForm);
                }
              }}
              disabled={!roleForm.name || createRoleMutation.isPending || updateRoleMutation.isPending}
              data-testid="button-save-role"
            >
              {(createRoleMutation.isPending || updateRoleMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingRole ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{roleToDelete?.name}" role?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Users assigned to this role will need to be reassigned to a different role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoleToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRoleMutation.isPending}
              onClick={() => {
                if (roleToDelete) {
                  deleteRoleMutation.mutate(roleToDelete.id, {
                    onSuccess: () => setRoleToDelete(null),
                  });
                }
              }}
            >
              {deleteRoleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SMS Template Editor Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setTemplateDialogOpen(false);
          setEditingTemplate(null);
          resetTemplateForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-template">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create New Template"}
              {editingTemplate?.isSystem && (
                <Badge variant="secondary" className="ml-2">System Template</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Modify the template content and settings. System templates cannot be deleted but can be edited."
                : "Create a reusable SMS template with dynamic variables."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Template Name */}
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="e.g., Shift Reminder"
                disabled={editingTemplate?.isSystem}
                data-testid="input-template-name"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="template-description">Description (Optional)</Label>
              <Input
                id="template-description"
                value={templateForm.description}
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                placeholder="Brief description of when this template is used"
                data-testid="input-template-description"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="template-category">Category</Label>
              <Select
                value={templateForm.category}
                onValueChange={(value) => {
                  setTemplateForm({ ...templateForm, category: value });
                  setTemplatePreview(null);
                  setTemplateValidation(null);
                }}
                disabled={editingTemplate?.isSystem}
              >
                <SelectTrigger data-testid="select-template-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shift_notification">New Shift Notification</SelectItem>
                  <SelectItem value="shift_confirmation">Shift Confirmation</SelectItem>
                  <SelectItem value="shift_reminder">Shift Reminder</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="bulk">Bulk Message</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Category determines which variables are available and when the template is used
              </p>
            </div>

            {/* Available Variables */}
            {templateVariables && templateVariables[templateForm.category] && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Available Variables</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <strong>Drag & drop</strong> variables into the message, or <strong>click</strong> to insert at cursor. Variables are replaced with actual values when sent.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-muted/30">
                  {templateVariables[templateForm.category].map((variable) => (
                    <TooltipProvider key={variable.name}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            draggable="true"
                            onDragStart={(e) => handleVariableDragStart(e, variable.name)}
                            onDragEnd={handleVariableDragEnd}
                            onClick={() => insertVariable(variable.name)}
                            className={`
                              inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border
                              font-mono text-xs cursor-grab active:cursor-grabbing
                              bg-background hover:bg-accent hover:border-primary/50
                              transition-colors select-none
                              ${draggedVariable === variable.name ? "opacity-50 border-primary" : ""}
                            `}
                          >
                            <span className="text-muted-foreground">{"{{"}</span>
                            <span className="font-semibold text-primary">{variable.name}</span>
                            <span className="text-muted-foreground">{"}}"}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p className="font-medium">{variable.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">Click or drag to insert</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="inline-block w-4 h-4 rounded bg-muted border text-center text-[10px] leading-4">⇅</span>
                  Drag variables into the message box below, or click to insert at cursor
                </p>
              </div>
            )}

            {/* Template Content */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="template-content">Message Content</Label>
                <span className="text-xs text-muted-foreground">
                  {templateForm.content.length} characters
                  {templateForm.content.length > 160 && (
                    <span className="text-orange-500 ml-1">
                      (~{Math.ceil(templateForm.content.length / 160)} SMS segments)
                    </span>
                  )}
                </span>
              </div>
              <div className={`relative rounded-md transition-all ${isDraggingVariable ? "ring-2 ring-primary ring-offset-2" : ""}`}>
                <Textarea
                  ref={templateTextareaRef}
                  id="template-content"
                  value={templateForm.content}
                  onChange={(e) => {
                    setTemplateForm({ ...templateForm, content: e.target.value });
                    setTemplatePreview(null);
                    setTemplateValidation(null);
                  }}
                  onDragOver={handleTextareaDragOver}
                  onDrop={handleTextareaDrop}
                  placeholder="Enter your message template here. Use {{variable}} syntax for dynamic content, or drag variables from above."
                  className={`font-mono min-h-[120px] transition-colors ${isDraggingVariable ? "bg-primary/5 border-primary" : ""}`}
                  data-testid="textarea-template-content"
                />
                {isDraggingVariable && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-primary/90 text-primary-foreground px-3 py-2 rounded-md text-sm font-medium shadow-lg">
                      Drop to insert {`{{${draggedVariable}}}`}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Preview & Validation */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => validateTemplateMutation.mutate({
                  content: templateForm.content,
                  category: templateForm.category,
                })}
                disabled={!templateForm.content || validateTemplateMutation.isPending}
              >
                {validateTemplateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                Preview & Validate
              </Button>
              {templatePreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTemplatePreview(null);
                    setTemplateValidation(null);
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Validation Errors */}
            {templateValidation && !templateValidation.valid && (
              <div className="p-3 rounded-lg border border-destructive bg-destructive/10">
                <div className="flex items-center gap-2 text-destructive font-medium mb-2">
                  <XCircle className="h-4 w-4" />
                  Validation Errors
                </div>
                <ul className="list-disc list-inside space-y-1 text-sm text-destructive">
                  {templateValidation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview */}
            {templatePreview && templateValidation?.valid && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Preview (with sample data)
                </div>
                <div className="p-3 rounded-lg border bg-muted/50">
                  <p className="text-sm font-mono whitespace-pre-wrap">{templatePreview}</p>
                </div>
              </div>
            )}

            {/* Active Toggle */}
            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive templates won't be used for automatic messages
                </p>
              </div>
              <Switch
                checked={templateForm.isActive}
                onCheckedChange={(checked) => setTemplateForm({ ...templateForm, isActive: checked })}
                data-testid="switch-template-active"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setTemplateDialogOpen(false);
                setEditingTemplate(null);
                resetTemplateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTemplateSubmit}
              disabled={
                !templateForm.name ||
                !templateForm.content ||
                createTemplateMutation.isPending ||
                updateTemplateMutation.isPending
              }
              data-testid="button-save-template"
            >
              {(createTemplateMutation.isPending || updateTemplateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirmation */}
      <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{templateToDelete?.name}" template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Messages that would have used this template will fall back to the default format.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTemplateMutation.isPending}
              onClick={() => {
                if (templateToDelete) {
                  deleteTemplateMutation.mutate(templateToDelete.id);
                }
              }}
            >
              {deleteTemplateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
