import { DashboardStats, type StatCardProps } from "../DashboardStats";
import { Calendar, Users, MessageSquare, Clock } from "lucide-react";

const mockStats: StatCardProps[] = [
  {
    title: "Open Shifts",
    value: 12,
    change: 8,
    changeLabel: "from last week",
    icon: Calendar,
  },
  {
    title: "Active Employees",
    value: 48,
    change: 2,
    changeLabel: "new this month",
    icon: Users,
  },
  {
    title: "SMS Sent Today",
    value: 156,
    change: -5,
    changeLabel: "from yesterday",
    icon: MessageSquare,
  },
  {
    title: "Shifts Filled",
    value: "85%",
    change: 12,
    changeLabel: "improvement",
    icon: Clock,
  },
];

export default function DashboardStatsExample() {
  return <DashboardStats stats={mockStats} />;
}
