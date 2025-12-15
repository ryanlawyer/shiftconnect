import { useState } from "react";
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
import { EmployeeCard, type EmployeeCardProps, type EmployeeRole } from "@/components/EmployeeCard";
import { SMSComposePanel, type Recipient } from "@/components/SMSComposePanel";
import { Search, Send, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// todo: remove mock functionality
const mockEmployees: (EmployeeCardProps & { selected?: boolean })[] = [
  { id: "1", name: "John Smith", role: "supervisor", department: "Emergency Department", phone: "+1 (555) 123-4567" },
  { id: "2", name: "Emily Davis", role: "employee", department: "Pediatrics", phone: "+1 (555) 234-5678" },
  { id: "3", name: "Michael Brown", role: "employee", department: "Intensive Care Unit", phone: "+1 (555) 345-6789" },
  { id: "4", name: "Sarah Johnson", role: "admin", department: "Administration", phone: "+1 (555) 456-7890" },
  { id: "5", name: "Lisa Chen", role: "supervisor", department: "Radiology", phone: "+1 (555) 567-8901" },
  { id: "6", name: "David Wilson", role: "employee", department: "Laboratory", phone: "+1 (555) 678-9012" },
  { id: "7", name: "Anna Martinez", role: "employee", department: "Emergency Department", phone: "+1 (555) 789-0123" },
  { id: "8", name: "James Taylor", role: "employee", department: "Surgery", phone: "+1 (555) 890-1234" },
];

const roles = ["All Roles", "Admin", "Supervisor", "Employee"];
const departments = ["All Departments", "Emergency Department", "Intensive Care Unit", "Pediatrics", "Radiology", "Laboratory", "Surgery", "Administration"];

export default function Employees() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("All Roles");
  const [department, setDepartment] = useState("All Departments");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [directSmsEmployee, setDirectSmsEmployee] = useState<string | null>(null);

  const filteredEmployees = mockEmployees.filter((emp) => {
    const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) ||
                          emp.department.toLowerCase().includes(search.toLowerCase());
    const matchesRole = role === "All Roles" || emp.role === role.toLowerCase();
    const matchesDept = department === "All Departments" || emp.department === department;
    return matchesSearch && matchesRole && matchesDept;
  });

  const handleSendSMS = (id: string) => {
    setDirectSmsEmployee(id);
    setSmsModalOpen(true);
  };

  const getRecipients = (): Recipient[] => {
    if (directSmsEmployee) {
      const emp = mockEmployees.find(e => e.id === directSmsEmployee);
      return emp ? [{ id: emp.id, name: emp.name, phone: emp.phone }] : [];
    }
    return selectedEmployees.map(id => {
      const emp = mockEmployees.find(e => e.id === id)!;
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
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-[200px]" data-testid="select-department-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {departments.map((dept) => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
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
                {...emp}
                onSendSMS={(id) => {
                  // Prevent card selection when clicking SMS button
                  handleSendSMS(id);
                }}
                onViewProfile={(id) => console.log("View profile:", id)}
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
    </div>
  );
}
