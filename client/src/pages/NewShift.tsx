import { CreateShiftForm } from "@/components/CreateShiftForm";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function NewShift() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: currentUser } = useQuery<{ username: string; role: string; employeeId?: string }>({
    queryKey: ["/api/user"],
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

  const handleSubmit = (data: any) => {
    createShiftMutation.mutate(data);
  };

  const handleCancel = () => {
    setLocation("/shifts");
  };

  return (
    <div className="p-6 max-w-2xl mx-auto" data-testid="page-new-shift">
      <CreateShiftForm onSubmit={handleSubmit} onCancel={handleCancel} />
    </div>
  );
}
