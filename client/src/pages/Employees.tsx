import { useState } from "react";
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
import { Search, Send, UserPlus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Employee, Area } from "@shared/schema";

type EmployeeWithAreas = Employee & { areas: Area[] };

const roles = ["All Roles", "Admin", "Supervisor", "Employee"];

export default function Employees() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("All Roles");
  const [areaFilter, setAreaFilter] = useState("All Areas");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [directSmsEmployee, setDirectSmsEmployee] = useState<string | null>(null);
  const [editAreasEmployee, setEditAreasEmployee] = useState<EmployeeWithAreas | null>(null);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);

  const { data: employees = [], isLoading: loadingEmployees } = useQuery<EmployeeWithAreas[]>({
    queryKey: ["/api/employees"],
  });

  const { data: areas = [], isLoading: loadingAreas } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
  });

  const updateAreasMutation = useMutation({
    mutationFn: async ({ employeeId, areaIds }: { employeeId: string; areaIds: string[] }) => {
      return apiRequest("PUT", `/api/employees/${employeeId}/areas`, { areaIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setEditAreasEmployee(null);
    },
  });

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) ||
                          emp.position.toLowerCase().includes(search.toLowerCase());
    const matchesRole = role === "All Roles" || emp.position.toLowerCase().includes(role.toLowerCase());
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

  const handleSendComplete = (message: string) => {
    console.log("Sending SMS:", message, "to", getRecipients());
    setSmsModalOpen(false);
    setDirectSmsEmployee(null);
    setSelectedEmployees([]);
  };

  const toggleEmployeeSelection = (id: string) => {
    setSelectedEmployees(prev =>
      prev.includes(id)
        ? prev.filter(e => e !== id)
        : [...prev, id]
    );
  };

  const handleEditAreas = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (emp) {
      setEditAreasEmployee(emp);
      setSelectedAreaIds(emp.areas.map(a => a.id));
    }
  };

  const handleSaveAreas = () => {
    if (editAreasEmployee) {
      updateAreasMutation.mutate({
        employeeId: editAreasEmployee.id,
        areaIds: selectedAreaIds,
      });
    }
  };

  const toggleAreaSelection = (areaId: string) => {
    setSelectedAreaIds(prev =>
      prev.includes(areaId)
        ? prev.filter(id => id !== areaId)
        : [...prev, areaId]
    );
  };

  const mapPositionToRole = (position: string): EmployeeRole => {
    const lowerPosition = position.toLowerCase();
    if (lowerPosition.includes("admin") || lowerPosition.includes("manager")) return "admin";
    if (lowerPosition.includes("supervisor") || lowerPosition.includes("lead")) return "supervisor";
    return "employee";
  };

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
          <p className="text-muted-foreground">Manage employees and send notifications</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedEmployees.length > 0 && (
            <Button onClick={() => { setDirectSmsEmployee(null); setSmsModalOpen(true); }} data-testid="button-sms-selected">
              <Send className="h-4 w-4 mr-2" />
              SMS ({selectedEmployees.length})
            </Button>
          )}
          <Button variant="outline" data-testid="button-add-employee">
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
            {roles.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-area-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Areas">All Areas</SelectItem>
            {areas.map((area) => (
              <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Employee Directory ({filteredEmployees.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredEmployees.map((emp) => (
            <div
              key={emp.id}
              className={`cursor-pointer ${selectedEmployees.includes(emp.id) ? 'bg-primary/5' : ''}`}
              onClick={() => toggleEmployeeSelection(emp.id)}
            >
              <EmployeeCard
                id={emp.id}
                name={emp.name}
                role={mapPositionToRole(emp.position)}
                position={emp.position}
                phone={emp.phone}
                areas={emp.areas}
                onSendSMS={handleSendSMS}
                onViewProfile={(id) => console.log("View profile:", id)}
                onEditAreas={handleEditAreas}
              />
            </div>
          ))}
          {filteredEmployees.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No employees found matching your criteria.</p>
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
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editAreasEmployee} onOpenChange={(open) => {
        if (!open) setEditAreasEmployee(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Areas to {editAreasEmployee?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Select the areas this employee can be notified about for shift availability.
            </p>
            <div className="space-y-3">
              {areas.map((area) => (
                <div key={area.id} className="flex items-start gap-3">
                  <Checkbox
                    id={`area-${area.id}`}
                    checked={selectedAreaIds.includes(area.id)}
                    onCheckedChange={() => toggleAreaSelection(area.id)}
                    data-testid={`checkbox-area-${area.id}`}
                  />
                  <div className="grid gap-0.5">
                    <Label htmlFor={`area-${area.id}`} className="font-medium cursor-pointer">
                      {area.name}
                    </Label>
                    {area.description && (
                      <p className="text-xs text-muted-foreground">{area.description}</p>
                    )}
                  </div>
                </div>
              ))}
              {areas.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No areas configured. Add areas in Settings first.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAreasEmployee(null)} data-testid="button-cancel-areas">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveAreas} 
              disabled={updateAreasMutation.isPending}
              data-testid="button-save-areas"
            >
              {updateAreasMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Areas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
