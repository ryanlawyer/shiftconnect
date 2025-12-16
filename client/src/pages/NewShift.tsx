import { CreateShiftForm } from "@/components/CreateShiftForm";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Shift } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface NewShiftProps {
  editId?: string;
}

export default function NewShift({ editId }: NewShiftProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isEditing = !!editId;

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

  return (
    <div className="p-6 max-w-2xl mx-auto" data-testid="page-new-shift">
      <CreateShiftForm 
        onSubmit={handleSubmit} 
        onCancel={handleCancel}
        initialData={existingShift}
        isEditing={isEditing}
      />
    </div>
  );
}
