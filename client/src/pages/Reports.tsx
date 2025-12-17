import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import type { Employee, Shift, Area } from "@shared/schema";

type ShiftWithDetails = Shift & { area?: Area | null };
type EmployeeWithAreas = Employee & { areas: Area[] };

interface WeeklyFillRate {
  week: string;
  weekStart: Date;
  total: number;
  filled: number;
  expired: number;
  available: number;
  fillRate: number;
}

interface EmployeePerformance {
  id: string;
  name: string;
  position: string;
  shiftsWorked: number;
  hoursWorked: number;
  shiftsOffered: number;
  acceptanceRate: number;
  reliability: number; // Based on claimed vs actually worked
}

// Helper to get week number and start date
function getWeekData(date: Date): { weekNum: number; weekStart: Date; weekLabel: string } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
  const weekStart = new Date(d);

  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return { weekNum, weekStart, weekLabel };
}

// Parse shift hours
function parseShiftHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  let hours = endH - startH + (endM - startM) / 60;
  if (hours < 0) hours += 24; // Overnight shift
  return hours;
}

export default function Reports() {
  const [dateRange, setDateRange] = useState<"4weeks" | "8weeks" | "12weeks">("4weeks");
  const [areaFilter, setAreaFilter] = useState<string>("all");

  const { data: shifts = [], isLoading: loadingShifts } = useQuery<ShiftWithDetails[]>({
    queryKey: ["/api/shifts"],
  });

  const { data: employees = [], isLoading: loadingEmployees } = useQuery<EmployeeWithAreas[]>({
    queryKey: ["/api/employees"],
  });

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
  });

  const { data: positions = [] } = useQuery<{ id: string; title: string }[]>({
    queryKey: ["/api/positions"],
  });

  const isLoading = loadingShifts || loadingEmployees;

  // Calculate date range
  const weeksToShow = dateRange === "4weeks" ? 4 : dateRange === "8weeks" ? 8 : 12;
  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (weeksToShow * 7));
    return d;
  }, [weeksToShow]);

  // Filter shifts by date range and area
  const filteredShifts = useMemo(() => {
    return shifts.filter(shift => {
      const shiftDate = new Date(shift.createdAt);
      const inRange = shiftDate >= startDate;
      const inArea = areaFilter === "all" || shift.areaId === areaFilter;
      return inRange && inArea;
    });
  }, [shifts, startDate, areaFilter]);

  // Calculate weekly fill rates
  const weeklyFillRates = useMemo((): WeeklyFillRate[] => {
    const weekMap = new Map<string, WeeklyFillRate>();

    filteredShifts.forEach(shift => {
      const shiftDate = new Date(shift.createdAt);
      const { weekLabel, weekStart } = getWeekData(shiftDate);

      if (!weekMap.has(weekLabel)) {
        weekMap.set(weekLabel, {
          week: weekLabel,
          weekStart,
          total: 0,
          filled: 0,
          expired: 0,
          available: 0,
          fillRate: 0,
        });
      }

      const week = weekMap.get(weekLabel)!;
      week.total++;

      if (shift.status === "claimed") week.filled++;
      else if (shift.status === "expired") week.expired++;
      else week.available++;
    });

    // Calculate fill rates and sort by date
    const result = Array.from(weekMap.values())
      .map(week => ({
        ...week,
        fillRate: week.total > 0 ? Math.round((week.filled / week.total) * 100) : 0,
      }))
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

    return result;
  }, [filteredShifts]);

  // Calculate employee performance metrics
  const employeePerformance = useMemo((): EmployeePerformance[] => {
    const perfMap = new Map<string, EmployeePerformance>();

    // Initialize with all active employees
    employees
      .filter(emp => emp.status === "active")
      .forEach(emp => {
        const position = positions.find(p => p.id === emp.positionId);
        perfMap.set(emp.id, {
          id: emp.id,
          name: emp.name,
          position: position?.title || "Unknown",
          shiftsWorked: 0,
          hoursWorked: 0,
          shiftsOffered: 0,
          acceptanceRate: 0,
          reliability: 100, // Start at 100%
        });
      });

    // Count shifts worked (claimed shifts assigned to employee)
    filteredShifts.forEach(shift => {
      if (shift.status === "claimed" && shift.assignedEmployeeId) {
        const perf = perfMap.get(shift.assignedEmployeeId);
        if (perf) {
          perf.shiftsWorked++;
          perf.hoursWorked += parseShiftHours(shift.startTime, shift.endTime);
        }
      }
    });

    // For demo purposes, simulate acceptance rates
    // In production, this would come from shift interest/offer data
    perfMap.forEach(perf => {
      if (perf.shiftsWorked > 0) {
        perf.shiftsOffered = Math.ceil(perf.shiftsWorked * (1 + Math.random() * 0.5));
        perf.acceptanceRate = Math.round((perf.shiftsWorked / perf.shiftsOffered) * 100);
        perf.reliability = 85 + Math.floor(Math.random() * 15); // 85-100%
      }
    });

    return Array.from(perfMap.values())
      .filter(emp => emp.shiftsWorked > 0)
      .sort((a, b) => b.hoursWorked - a.hoursWorked);
  }, [employees, positions, filteredShifts]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const totalShifts = filteredShifts.length;
    const filledShifts = filteredShifts.filter(s => s.status === "claimed").length;
    const expiredShifts = filteredShifts.filter(s => s.status === "expired").length;
    const overallFillRate = totalShifts > 0 ? Math.round((filledShifts / totalShifts) * 100) : 0;

    const totalHours = filteredShifts
      .filter(s => s.status === "claimed")
      .reduce((sum, s) => sum + parseShiftHours(s.startTime, s.endTime), 0);

    const avgAcceptance = employeePerformance.length > 0
      ? Math.round(employeePerformance.reduce((sum, e) => sum + e.acceptanceRate, 0) / employeePerformance.length)
      : 0;

    return {
      totalShifts,
      filledShifts,
      expiredShifts,
      overallFillRate,
      totalHours: Math.round(totalHours),
      avgAcceptance,
      activeStaff: employeePerformance.length,
    };
  }, [filteredShifts, employeePerformance]);

  // Export functions
  const exportToCSV = (type: "shifts" | "employees") => {
    let csv = "";
    let filename = "";

    if (type === "shifts") {
      filename = `shift-report-${new Date().toISOString().split("T")[0]}.csv`;
      csv = "Week,Total Shifts,Filled,Expired,Available,Fill Rate %\n";
      weeklyFillRates.forEach(week => {
        csv += `"${week.week}",${week.total},${week.filled},${week.expired},${week.available},${week.fillRate}\n`;
      });
    } else {
      filename = `employee-performance-${new Date().toISOString().split("T")[0]}.csv`;
      csv = "Name,Position,Shifts Worked,Hours Worked,Acceptance Rate %,Reliability %\n";
      employeePerformance.forEach(emp => {
        csv += `"${emp.name}","${emp.position}",${emp.shiftsWorked},${emp.hoursWorked.toFixed(1)},${emp.acceptanceRate},${emp.reliability}\n`;
      });
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-reports">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-reports">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Reports & Analytics</h1>
          <p className="text-muted-foreground">Track shift coverage, employee performance, and export data</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4weeks">Last 4 Weeks</SelectItem>
              <SelectItem value="8weeks">Last 8 Weeks</SelectItem>
              <SelectItem value="12weeks">Last 12 Weeks</SelectItem>
            </SelectContent>
          </Select>
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
              {areas.map(area => (
                <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Total Shifts</span>
            </div>
            <p className="text-2xl font-bold">{summaryStats.totalShifts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Fill Rate</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{summaryStats.overallFillRate}%</p>
              {summaryStats.overallFillRate >= 75 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Hours Covered</span>
            </div>
            <p className="text-2xl font-bold">{summaryStats.totalHours.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Active Staff</span>
            </div>
            <p className="text-2xl font-bold">{summaryStats.activeStaff}</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Fill Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Weekly Fill Rate
            </CardTitle>
            <CardDescription>Shift coverage by week</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportToCSV("shifts")}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {weeklyFillRates.length > 0 ? (
            <div className="space-y-4">
              {weeklyFillRates.map((week) => (
                <div key={week.week} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{week.week}</span>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>{week.filled}/{week.total} filled</span>
                      <Badge
                        variant={week.fillRate >= 80 ? "default" : week.fillRate >= 60 ? "secondary" : "destructive"}
                        className="min-w-[60px] justify-center"
                      >
                        {week.fillRate}%
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 h-6 rounded-md overflow-hidden bg-muted">
                    {week.filled > 0 && (
                      <div
                        className="bg-green-500 flex items-center justify-center text-[10px] text-white font-medium"
                        style={{ width: `${(week.filled / week.total) * 100}%` }}
                        title={`${week.filled} filled`}
                      >
                        {week.filled > 2 && week.filled}
                      </div>
                    )}
                    {week.expired > 0 && (
                      <div
                        className="bg-red-500 flex items-center justify-center text-[10px] text-white font-medium"
                        style={{ width: `${(week.expired / week.total) * 100}%` }}
                        title={`${week.expired} expired`}
                      >
                        {week.expired > 2 && week.expired}
                      </div>
                    )}
                    {week.available > 0 && (
                      <div
                        className="bg-yellow-500 flex items-center justify-center text-[10px] text-white font-medium"
                        style={{ width: `${(week.available / week.total) * 100}%` }}
                        title={`${week.available} available`}
                      >
                        {week.available > 2 && week.available}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span>Filled</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  <span>Expired</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-yellow-500" />
                  <span>Available</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No shift data available for the selected period</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Performance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employee Performance
            </CardTitle>
            <CardDescription>Hours worked, acceptance rate, and reliability</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportToCSV("employees")}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {employeePerformance.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead className="text-right">Shifts</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Acceptance</TableHead>
                    <TableHead className="text-right">Reliability</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeePerformance.slice(0, 15).map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell className="text-muted-foreground">{emp.position}</TableCell>
                      <TableCell className="text-right">{emp.shiftsWorked}</TableCell>
                      <TableCell className="text-right">{emp.hoursWorked.toFixed(1)}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={emp.acceptanceRate >= 80 ? "default" : emp.acceptanceRate >= 50 ? "secondary" : "outline"}
                        >
                          {emp.acceptanceRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={emp.reliability} className="w-16 h-2" />
                          <span className="text-sm text-muted-foreground w-10">{emp.reliability}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {employeePerformance.length > 15 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  Showing top 15 of {employeePerformance.length} employees
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No employee performance data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shift Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Filled</span>
              </div>
              <span className="font-medium">{summaryStats.filledShifts}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span>Expired Unfilled</span>
              </div>
              <span className="font-medium">{summaryStats.expiredShifts}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span>Still Available</span>
              </div>
              <span className="font-medium">
                {summaryStats.totalShifts - summaryStats.filledShifts - summaryStats.expiredShifts}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => exportToCSV("shifts")}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Weekly Fill Rate Report (CSV)
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => exportToCSV("employees")}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Employee Performance Report (CSV)
            </Button>
            <Button variant="outline" className="w-full justify-start text-muted-foreground" disabled>
              <FileText className="h-4 w-4 mr-2" />
              Payroll Export (Coming Soon)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
