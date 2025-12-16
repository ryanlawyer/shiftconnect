import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmployeeCard, type EmployeeRole } from "@/components/EmployeeCard";
import { SMSComposePanel, type Recipient } from "@/components/SMSComposePanel";
import { Search, Send, UserPlus, Loader2, Trash2, CheckSquare, Square, Users, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserManagementDialog } from "@/components/UserManagementDialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Employee, Area, Position, Role } from "@shared/schema";

type EmployeeWithAreas = Employee & { areas: Area[], user?: { id: string, username: string } | null };

interface EmployeeFormData {
  name: string;
  phone: string;
  email: string;
  positionId: string;
  roleId: string;
  status: string;
  smsOptIn: boolean;
  areaIds: string[];
}


export default function Employees() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("All Roles");
  const [areaFilter, setAreaFilter] = useState("All Areas");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [directSmsEmployee, setDirectSmsEmployee] = useState<string | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithAreas | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>({
    name: "",
    phone: "",
    email: "",
    positionId: "",
    roleId: "",
    status: "active",
    smsOptIn: true,
    areaIds: [],
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);

  // User Management State
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userDialogEmployee, setUserDialogEmployee] = useState<EmployeeWithAreas | null>(null);

  const { data: employees = [], isLoading: loadingEmployees } = useQuery<EmployeeWithAreas[]>({
    queryKey: ["/api/employees"],
  });

  const { data: areas = [], isLoading: loadingAreas } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
  });

  const { data: positions = [], isLoading: loadingPositions } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
  });

  const { data: roles = [], isLoading: loadingRoles } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: Omit<EmployeeFormData, "areaIds"> & { areaIds?: string[] }) => {
      const { areaIds, ...employeeData } = data;
      const response = await apiRequest("POST", "/api/employees", employeeData);
      const newEmployee = await response.json();
      if (areaIds && areaIds.length > 0) {
        await apiRequest("PUT", `/api/employees/${newEmployee.id}/areas`, { areaIds });
      }
      return newEmployee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setEditDialogOpen(false);
      resetForm();
      toast({ title: "Employee created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create employee", variant: "destructive" });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EmployeeFormData }) => {
      const { areaIds, ...employeeData } = data;
      await apiRequest("PATCH", `/api/employees/${id}`, { ...employeeData, areaIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setEditDialogOpen(false);
      resetForm();
      toast({ title: "Employee updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update employee", variant: "destructive" });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setEditDialogOpen(false);
      setDeleteConfirmOpen(false);
      resetForm();
      toast({ title: "Employee deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete employee", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setEditingEmployee(null);
    setFormData({
      name: "",
      phone: "",
      email: "",
      positionId: "",
      roleId: "",
      status: "active",
      smsOptIn: true,
      areaIds: [],
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setEditDialogOpen(true);
  };

  const openEditDialog = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (emp) {
      setEditingEmployee(emp);
      setFormData({
        name: emp.name,
        phone: emp.phone,
        email: emp.email || "",
        positionId: emp.positionId,
        roleId: emp.roleId || "",
        status: emp.status,
        smsOptIn: emp.smsOptIn,
        areaIds: emp.areas.map(a => a.id),
      });
      setEditDialogOpen(true);
    }
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.phone.trim() || !formData.positionId) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    if (editingEmployee) {
      updateEmployeeMutation.mutate({ id: editingEmployee.id, data: formData });
    } else {
      createEmployeeMutation.mutate(formData);
    }
  };

  const toggleAreaSelection = (areaId: string) => {
    setFormData(prev => ({
      ...prev,
      areaIds: prev.areaIds.includes(areaId)
        ? prev.areaIds.filter(id => id !== areaId)
        : [...prev.areaIds, areaId],
    }));
  };

  const filteredEmployees = employees.filter((emp) => {
    const position = positions.find(p => p.id === emp.positionId);
    const positionTitle = position?.title || "";

    const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) ||
      positionTitle.toLowerCase().includes(search.toLowerCase());
    const matchesRole = role === "All Roles" || emp.roleId === role;
    const matchesArea = areaFilter === "All Areas" || emp.areas.some(a => a.id === areaFilter);
    return matchesSearch && matchesRole && matchesArea;
  });

  const handleSendSMS = (id: string) => {
    setDirectSmsEmployee(id);
    setSmsModalOpen(true);
  };

  const getRecipients = (): Recipient[] => {
    if (directSmsEmployee) {
      const emp = employees.find(e => e.id === directSmsEmployee);
      return emp ? [{ id: emp.id, name: emp.name, phone: emp.phone }] : [];
    }
    return selectedEmployees.map(id => {
      const emp = employees.find(e => e.id === id)!;
      return { id: emp.id, name: emp.name, phone: emp.phone };
    });
  };

  const sendSmsMutation = useMutation({
    mutationFn: async ({ recipients, message }: { recipients: Recipient[]; message: string }) => {
      const results = await Promise.all(
        recipients.map(async (recipient) => {
          try {
            const response = await apiRequest("POST", "/api/sms/send", {
              employeeId: recipient.id,
              content: message,
              messageType: "general",
            });
            
            // Check if response is ok (apiRequest throws on non-2xx, but double-check)
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
              return { success: false, recipient, error: errorData.error || "Failed to send" };
            }
            
            return { success: true, recipient };
          } catch (error: any) {
            // apiRequest throws on non-2xx responses
            let errorMessage = "Failed to send SMS";
            if (error instanceof Response) {
              try {
                const errorData = await error.json();
                errorMessage = errorData.error || errorData.message || "Failed to send";
              } catch {
                errorMessage = `HTTP ${error.status}`;
              }
            } else if (error?.message) {
              errorMessage = error.message;
            }
            return { success: false, recipient, error: errorMessage };
          }
        })
      );
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      const failedRecipients = results.filter(r => !r.success);
      
      if (successCount > 0 && failCount === 0) {
        toast({
          title: "SMS Sent",
          description: `Successfully sent to ${successCount} recipient${successCount > 1 ? 's' : ''}`,
        });
        setSmsModalOpen(false);
        setDirectSmsEmployee(null);
        setSelectedEmployees([]);
      } else if (successCount > 0 && failCount > 0) {
        const failedNames = failedRecipients.map(r => r.recipient.name).join(", ");
        toast({
          title: "Partially Sent",
          description: `Sent to ${successCount}, failed for: ${failedNames}`,
          variant: "destructive",
        });
        setSmsModalOpen(false);
        setDirectSmsEmployee(null);
        setSelectedEmployees([]);
      } else {
        const errorDetail = failedRecipients[0]?.error || "Unknown error";
        toast({
          title: "SMS Failed",
          description: errorDetail,
          variant: "destructive",
        });
        // Keep modal open so user can retry
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
    onError: (error: any) => {
      const message = error?.message || "An unexpected error occurred";
      toast({
        title: "Failed to send SMS",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleSendComplete = (message: string) => {
    const recipients = getRecipients();
    if (recipients.length > 0 && message.trim()) {
      sendSmsMutation.mutate({ recipients, message });
    }
  };

  const toggleEmployeeSelection = (id: string) => {
    setSelectedEmployees(prev =>
      prev.includes(id)
        ? prev.filter(e => e !== id)
        : [...prev, id]
    );
  };

  const handleManageUser = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (emp) {
      setUserDialogEmployee(emp);
      setUserDialogOpen(true);
    }
  };


  const isPending = createEmployeeMutation.isPending || updateEmployeeMutation.isPending;

  if (loadingEmployees || loadingAreas) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-employees">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-employees">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Employees</h1>
          <p className="text-muted-foreground">Manage staff and send notifications</p>
        </div>
        <div className="flex items-center gap-2">
          {selectionMode && selectedEmployees.length > 0 && (
            <Button onClick={() => { setDirectSmsEmployee(null); setSmsModalOpen(true); }} data-testid="button-sms-selected">
              <Send className="h-4 w-4 mr-2" />
              SMS ({selectedEmployees.length})
            </Button>
          )}
          <Button
            variant={selectionMode ? "secondary" : "outline"}
            onClick={() => {
              setSelectionMode(!selectionMode);
              if (selectionMode) setSelectedEmployees([]);
            }}
            data-testid="button-toggle-selection"
          >
            {selectionMode ? (
              <>
                <CheckSquare className="h-4 w-4 mr-2" />
                Done Selecting
              </>
            ) : (
              <>
                <Square className="h-4 w-4 mr-2" />
                Select Multiple
              </>
            )}
          </Button>
          <Button onClick={openCreateDialog} data-testid="button-add-employee">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-employees"
          />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-[150px]" data-testid="select-role-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Roles">All Roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-area-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Areas">All Placement Types</SelectItem>
            {areas.map((area) => (
              <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Employee Directory ({filteredEmployees.length})</CardTitle>
            {selectionMode && filteredEmployees.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (selectedEmployees.length === filteredEmployees.length) {
                    setSelectedEmployees([]);
                  } else {
                    setSelectedEmployees(filteredEmployees.map(e => e.id));
                  }
                }}
                data-testid="button-select-all"
              >
                {selectedEmployees.length === filteredEmployees.length ? "Deselect All" : "Select All"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredEmployees.map((emp) => (
            <div
              key={emp.id}
              className={`flex items-stretch ${selectedEmployees.includes(emp.id) ? 'bg-primary/5' : ''}`}
            >
              {selectionMode && (
                <div
                  className="flex items-center px-4 cursor-pointer hover:bg-muted/50 border-r"
                  onClick={() => toggleEmployeeSelection(emp.id)}
                  data-testid={`checkbox-select-${emp.id}`}
                >
                  <Checkbox
                    checked={selectedEmployees.includes(emp.id)}
                    onCheckedChange={() => toggleEmployeeSelection(emp.id)}
                  />
                </div>
              )}
              <div className="flex-1">
                <EmployeeCard
                  id={emp.id}
                  name={emp.name}
                  role={roles.find(r => r.id === emp.roleId)?.name || "Employee"}
                  position={positions.find(p => p.id === emp.positionId)?.title || "Unknown Position"}
                  phone={emp.phone}
                  areas={emp.areas}
                  onSendSMS={handleSendSMS}
                  onViewProfile={openEditDialog}
                  onEditAreas={openEditDialog}
                  onManageUser={handleManageUser}
                  hasUserAccount={!!emp.user}
                />
              </div>
            </div>
          ))}
          {filteredEmployees.length === 0 && employees.length === 0 && (
            <div className="text-center py-16">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No employees yet</h3>
              <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
                Add your first team member to start managing shifts and sending notifications.
              </p>
              <Button onClick={openCreateDialog}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add First Employee
              </Button>
            </div>
          )}
          {filteredEmployees.length === 0 && employees.length > 0 && (
            <div className="text-center py-16">
              <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No matching employees</h3>
              <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
                No employees match your current filters. Try adjusting your search or filter criteria.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setRole("All Roles");
                  setAreaFilter("All Areas");
                }}
              >
                Clear All Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={smsModalOpen} onOpenChange={(open) => {
        setSmsModalOpen(open);
        if (!open) setDirectSmsEmployee(null);
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Compose SMS</DialogTitle>
          </DialogHeader>
          <SMSComposePanel
            recipients={getRecipients()}
            onRemoveRecipient={(id) => {
              if (directSmsEmployee === id) {
                setDirectSmsEmployee(null);
                setSmsModalOpen(false);
              } else {
                setSelectedEmployees(prev => prev.filter(e => e !== id));
              }
            }}
            onSend={handleSendComplete}
            onCancel={() => {
              setSmsModalOpen(false);
              setDirectSmsEmployee(null);
            }}
            isSending={sendSmsMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          resetForm();
        }
        setEditDialogOpen(open);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Edit Employee" : "Add New Employee"}</DialogTitle>
            <DialogDescription>
              {editingEmployee
                ? "Update employee information and placement assignments."
                : "Add a new staff member to your team."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter full name"
                data-testid="input-employee-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1 (555) 123-4567"
                data-testid="input-employee-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
                data-testid="input-employee-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Position *</Label>
              <Select
                value={formData.positionId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, positionId: value }))}
              >
                <SelectTrigger data-testid="select-employee-position">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((pos) => (
                    <SelectItem key={pos.id} value={pos.id}>{pos.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Access Role *</Label>
              <Select
                value={formData.roleId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, roleId: value }))}
              >
                <SelectTrigger data-testid="select-employee-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger data-testid="select-employee-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>SMS Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Receive shift availability notifications via text
                </p>
              </div>
              <Switch
                checked={formData.smsOptIn}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, smsOptIn: checked }))}
                data-testid="switch-sms-optin"
              />
            </div>

            <div className="space-y-3">
              <Label>Placement Assignments</Label>
              <p className="text-xs text-muted-foreground">
                Select which placement types this employee can work in
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {areas.map((area) => (
                  <div key={area.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`edit-area-${area.id}`}
                      checked={formData.areaIds.includes(area.id)}
                      onCheckedChange={() => toggleAreaSelection(area.id)}
                      data-testid={`checkbox-area-${area.id}`}
                    />
                    <Label htmlFor={`edit-area-${area.id}`} className="cursor-pointer text-sm">
                      {area.name}
                    </Label>
                  </div>
                ))}
                {areas.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No placement types configured. Add them in Settings first.
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-between gap-2 sm:justify-between">
            <div>
              {editingEmployee && (
                <Button
                  variant="destructive"
                  onClick={() => setDeleteConfirmOpen(true)}
                  data-testid="button-delete-employee"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} data-testid="button-cancel-employee">
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-employee">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingEmployee ? "Save Changes" : "Add Employee"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {editingEmployee?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => editingEmployee && deleteEmployeeMutation.mutate(editingEmployee.id)}
              disabled={deleteEmployeeMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteEmployeeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {userDialogEmployee && (
        <UserManagementDialog
          open={userDialogOpen}
          onOpenChange={setUserDialogOpen}
          employee={userDialogEmployee}
        />
      )}
    </div>
  );
}
