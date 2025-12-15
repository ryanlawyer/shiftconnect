import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  Calendar,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  UserPlus,
  Key,
  Trash2,
  Edit,
  UserCheck,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AuditLog {
  id: string;
  action: string;
  actorId: string | null;
  actorName: string;
  targetType: string;
  targetId: string | null;
  targetName: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "destructive" | "secondary" | "outline" }> = {
  role_created: { label: "Role Created", icon: <Shield className="h-4 w-4" />, variant: "default" },
  role_updated: { label: "Role Updated", icon: <Edit className="h-4 w-4" />, variant: "secondary" },
  role_deleted: { label: "Role Deleted", icon: <Trash2 className="h-4 w-4" />, variant: "destructive" },
  shift_created: { label: "Shift Created", icon: <Calendar className="h-4 w-4" />, variant: "default" },
  shift_deleted: { label: "Shift Deleted", icon: <Trash2 className="h-4 w-4" />, variant: "destructive" },
  shift_assigned: { label: "Shift Assigned", icon: <UserCheck className="h-4 w-4" />, variant: "default" },
  force_assignment: { label: "Force Assignment", icon: <AlertTriangle className="h-4 w-4" />, variant: "destructive" },
  user_created: { label: "User Created", icon: <UserPlus className="h-4 w-4" />, variant: "default" },
  user_password_reset: { label: "Password Reset", icon: <Key className="h-4 w-4" />, variant: "secondary" },
  employee_created: { label: "Employee Created", icon: <UserPlus className="h-4 w-4" />, variant: "default" },
  employee_updated: { label: "Employee Updated", icon: <Edit className="h-4 w-4" />, variant: "secondary" },
  employee_deleted: { label: "Employee Deleted", icon: <Trash2 className="h-4 w-4" />, variant: "destructive" },
  area_created: { label: "Area Created", icon: <FileText className="h-4 w-4" />, variant: "default" },
  area_updated: { label: "Area Updated", icon: <Edit className="h-4 w-4" />, variant: "secondary" },
  area_deleted: { label: "Area Deleted", icon: <Trash2 className="h-4 w-4" />, variant: "destructive" },
  position_created: { label: "Position Created", icon: <FileText className="h-4 w-4" />, variant: "default" },
  position_updated: { label: "Position Updated", icon: <Edit className="h-4 w-4" />, variant: "secondary" },
  position_deleted: { label: "Position Deleted", icon: <Trash2 className="h-4 w-4" />, variant: "destructive" },
};

const TARGET_TYPES = [
  { value: "all", label: "All Types" },
  { value: "role", label: "Roles" },
  { value: "shift", label: "Shifts" },
  { value: "user", label: "Users" },
  { value: "employee", label: "Employees" },
  { value: "area", label: "Areas" },
  { value: "position", label: "Positions" },
];

const ACTIONS = [
  { value: "all", label: "All Actions" },
  { value: "role_created", label: "Role Created" },
  { value: "role_updated", label: "Role Updated" },
  { value: "role_deleted", label: "Role Deleted" },
  { value: "shift_deleted", label: "Shift Deleted" },
  { value: "shift_assigned", label: "Shift Assigned" },
  { value: "force_assignment", label: "Force Assignment" },
  { value: "user_created", label: "User Created" },
  { value: "user_password_reset", label: "Password Reset" },
];

export default function AuditLog() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const pageSize = 20;

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: [
      "/api/audit-logs",
      {
        limit: pageSize,
        offset: page * pageSize,
        action: actionFilter !== "all" ? actionFilter : undefined,
        targetType: targetTypeFilter !== "all" ? targetTypeFilter : undefined,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", pageSize.toString());
      params.set("offset", (page * pageSize).toString());
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (targetTypeFilter !== "all") params.set("targetType", targetTypeFilter);

      const res = await fetch(`/api/audit-logs?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getActionConfig = (action: string) => {
    return ACTION_CONFIG[action] || {
      label: action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: <FileText className="h-4 w-4" />,
      variant: "outline" as const,
    };
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">
          Track critical system actions and changes
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Activity History
          </CardTitle>
          <CardDescription>
            View all tracked actions including role changes, shift deletions, and force assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.map((action) => (
                  <SelectItem key={action.value} value={action.value}>
                    {action.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                {TARGET_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs && logs.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead className="hidden md:table-cell">Target</TableHead>
                      <TableHead className="hidden lg:table-cell">IP Address</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const config = getActionConfig(log.action);
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge variant={config.variant} className="gap-1">
                              {config.icon}
                              <span className="hidden sm:inline">{config.label}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate max-w-[100px]">{log.actorName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="text-sm">
                              <span className="text-muted-foreground capitalize">{log.targetType}:</span>{" "}
                              <span className="truncate">{log.targetName || log.targetId || "-"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-muted-foreground text-sm font-mono">
                              {log.ipAddress || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatDate(log.createdAt)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {logs.length} entries
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={logs.length < pageSize}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No audit logs found</p>
              <p className="text-sm">
                Actions will be recorded here as they occur
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLog && getActionConfig(selectedLog.action).icon}
              {selectedLog && getActionConfig(selectedLog.action).label}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Actor</p>
                  <p className="font-medium">{selectedLog.actorName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium">{formatDate(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Target Type</p>
                  <p className="font-medium capitalize">{selectedLog.targetType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Target</p>
                  <p className="font-medium">{selectedLog.targetName || selectedLog.targetId || "-"}</p>
                </div>
                {selectedLog.ipAddress && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">IP Address</p>
                    <p className="font-medium font-mono">{selectedLog.ipAddress}</p>
                  </div>
                )}
              </div>

              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-sm mb-2">Details</p>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-[200px]">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
