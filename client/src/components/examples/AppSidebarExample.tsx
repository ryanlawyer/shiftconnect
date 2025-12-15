import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "../AppSidebar";

export default function AppSidebarExample() {
  return (
    <SidebarProvider>
      <div className="flex h-[500px] w-full border rounded-lg overflow-hidden">
        <AppSidebar userRole="admin" userName="Sarah Johnson" unreadMessages={3} />
        <div className="flex-1 p-6 bg-background">
          <p className="text-muted-foreground">Main content area</p>
        </div>
      </div>
    </SidebarProvider>
  );
}
