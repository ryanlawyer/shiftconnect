import { CreateShiftForm } from "@/components/CreateShiftForm";
import { useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Shift } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

interface NewShiftProps {
  editId?: string;
}

export default function NewShift({ editId }: NewShiftProps) {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const isEditing = !!editId;

  const cloneData = useMemo(() => {
    if (!search || isEditing) return null;
    const params = new URLSearchParams(search);
    const positionId = params.get("positionId");
    const areaId = params.get("areaId");
    
    if (!positionId || !areaId) return null;
    
    return {
      id: "",
      positionId,
      areaId,
      location: params.get("location") || "",
      date: "",
      startTime: params.get("startTime") || "",
      endTime: params.get("endTime") || "",
      requirements: params.get("requirements") || null,
      bonusAmount: params.get("bonusAmount") ? parseInt(params.get("bonusAmount")!, 10) : null,
      notifyAllAreas: false,
      status: "available" as const,
      postedById: null,
      postedByName: "",
      assignedEmployeeId: null,
      createdAt: new Date(),
      lastNotifiedAt: null,
      notificationCount: null,
    } as Shift;
  }, [search, isEditing]);

  const { data: currentUser } = useQuery<{ username: string; role: string; employeeId?: string }>({
    queryKey: ["/api/user"],
  });

  const { data: existingShift, isLoading: shiftLoading } = useQuery<Shift>({
    queryKey: ["/api/shifts", editId],
    enabled: isEditing,
  });

  const createShiftMutation = useMutation({
    mutationFn: async (data: {
      positionId: string;
      areaId: string;
      location: string;
      date: string;
      startTime: string;
      endTime: string;
      requirements?: string;
      sendNotification: boolean;
    }) => {
      const response = await apiRequest("POST", "/api/shifts", {
        ...data,
        postedByName: currentUser?.username || "Unknown",
      });
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Shift Posted",
        description: result.notificationCount 
          ? `Shift created and ${result.notificationCount} employees will be notified.`
          : "The shift has been posted successfully.",
      });
      setLocation("/shifts");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Shift",
        description: error.message || "An error occurred while creating the shift.",
        variant: "destructive",
      });
    },
  });

  const updateShiftMutation = useMutation({
    mutationFn: async (data: {
      positionId: string;
      areaId: string;
      location: string;
      date: string;
      startTime: string;
      endTime: string;
      requirements?: string;
    }) => {
      const response = await apiRequest("PATCH", `/api/shifts/${editId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Shift Updated",
        description: "The shift has been updated successfully.",
      });
      setLocation("/shifts");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Shift",
        description: error.message || "An error occurred while updating the shift.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: any) => {
    if (isEditing) {
      updateShiftMutation.mutate(data);
    } else {
      createShiftMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    setLocation("/shifts");
  };

  if (isEditing && shiftLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initialFormData = isEditing ? existingShift : cloneData;

  return (
    <div className="p-6 max-w-2xl mx-auto" data-testid="page-new-shift">
      <CreateShiftForm 
        onSubmit={handleSubmit} 
        onCancel={handleCancel}
        initialData={initialFormData || undefined}
        isEditing={isEditing}
        isCloning={!!cloneData}
      />
    </div>
  );
}
